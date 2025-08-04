/**
 * ETL Pipeline Engine - Orchestrates data processing pipelines
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');
const { MetricsCollector } = require('../quality/metrics-collector');
const { ErrorHandler } = require('./error-handler');
const { StateManager } = require('./state-manager');

class PipelineEngine extends EventEmitter {
	constructor(config = {}) {
		super();
		
		this.config = {
			maxConcurrency: config.maxConcurrency || 5,
			maxRetries: config.maxRetries || 3,
			healthCheckInterval: config.healthCheckInterval || 30000,
			enableMetrics: config.enableMetrics !== false,
			...config
		};

		// Core components
		this.pipelines = new Map();
		this.runningPipelines = new Map();
		this.activePipelines = new Map(); // For backward compatibility
		this.executionQueue = [];
		
		// Services
		this.errorHandler = new ErrorHandler(this.config.errorHandler);
		this.stateManager = new StateManager(this.config.stateManager);
		this.metricsCollector = this.config.enableMetrics ? new MetricsCollector(this.config.metrics) : null;
		
		// Stats
		this.stats = {
			totalExecutions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			totalExecutionTime: 0,
			startTime: Date.now()
		};

		this.healthCheckTimer = null;
		this.initialized = false;
	}

	/**
	 * Initialize the pipeline engine
	 */
	async initialize() {
		try {
			logger.info('Initializing Pipeline Engine...');
			
			await this.errorHandler.initialize();
			await this.stateManager.initialize();
			
			if (this.metricsCollector) {
				await this.metricsCollector.initialize();
			}
			
			this.initialized = true;
			logger.info('Pipeline Engine initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Pipeline Engine:', error);
			throw error;
		}
	}

	/**
	 * Register a new pipeline
	 */
	async registerPipeline(pipelineId, config) {
		if (this.pipelines.has(pipelineId)) {
			throw new Error(`Pipeline ${pipelineId} is already registered`);
		}

		// Validate required components
		if (!config.extractor || !config.transformer || !config.loader) {
			throw new Error('Pipeline configuration must include extractor, transformer, and loader');
		}

		const pipeline = {
			id: pipelineId,
			extractor: config.extractor,
			transformer: config.transformer,
			loader: config.loader,
			config: config.config || {},
			schedule: config.schedule,
			dependencies: config.dependencies || [],
			enabled: config.enabled !== false,
			retries: config.retries || this.config.maxRetries,
			lastExecution: null,
			status: 'idle'
		};

		this.pipelines.set(pipelineId, pipeline);
		
		logger.info(`Pipeline registered: ${pipelineId}`);
		this.emit('pipeline_registered', { pipelineId, config });
	}

	/**
	 * Unregister a pipeline
	 */
	async unregisterPipeline(pipelineId) {
		if (!this.pipelines.has(pipelineId)) {
			return false;
		}

		this.pipelines.delete(pipelineId);
		
		logger.info(`Pipeline unregistered: ${pipelineId}`);
		this.emit('pipeline_unregistered', { pipelineId });
		
		return true;
	}

	/**
	 * Execute a pipeline
	 */
	async executePipeline(pipelineId, options = {}) {
		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			throw new Error(`Pipeline not found: ${pipelineId}`);
		}

		if (!pipeline.enabled) {
			throw new Error(`Pipeline ${pipelineId} is disabled`);
		}

		// Check if already running
		if (this.runningPipelines.has(pipelineId)) {
			throw new Error(`Pipeline ${pipelineId} is already running`);
		}

		// Check concurrent execution limit
		if (this.runningPipelines.size >= this.config.maxConcurrency) {
			throw new Error('Maximum concurrent pipelines limit reached');
		}

		const executionId = `${pipelineId}-${Date.now()}`;
		const startTime = Date.now();
		
		logger.info(`Starting pipeline execution: ${executionId}`);
		
		// Update pipeline status
		pipeline.status = 'running';
		pipeline.lastExecution = {
			id: executionId,
			startTime,
			status: 'running'
		};

		this.emit('pipeline_started', {
			pipelineId,
			executionId,
			timestamp: new Date(startTime)
		});

		this.emit('pipeline_status_changed', {
			pipelineId,
			status: 'running',
			timestamp: new Date(startTime)
		});

		// Create execution promise
		const executionPromise = this._executeWithRetries(pipeline, executionId, options);
		this.runningPipelines.set(pipelineId, executionPromise);
		this.activePipelines.set(pipelineId, executionPromise); // For backward compatibility

		try {
			const result = await executionPromise;
			
			// Update stats
			this.stats.totalExecutions++;
			this.stats.totalExecutionTime += result.executionTime;
			
			if (result.status === 'completed') {
				this.stats.successfulExecutions++;
			} else {
				this.stats.failedExecutions++;
			}

			// Update pipeline status
			pipeline.status = 'idle';
			pipeline.lastExecution.status = result.status;
			pipeline.lastExecution.endTime = Date.now();
			pipeline.lastExecution.result = result;

			this.emit('pipeline_completed', {
				pipelineId,
				executionId,
				result,
				timestamp: new Date()
			});

			this.emit('pipeline_status_changed', {
				pipelineId,
				status: 'completed',
				timestamp: new Date()
			});

			logger.info(`Pipeline execution completed: ${executionId}`, { result });
			
			return result;
		} catch (error) {
			// Update stats
			this.stats.totalExecutions++;
			this.stats.failedExecutions++;

			// Update pipeline status
			pipeline.status = 'failed';
			pipeline.lastExecution.status = 'failed';
			pipeline.lastExecution.endTime = Date.now();
			pipeline.lastExecution.error = error;

			this.emit('pipeline_failed', {
				pipelineId,
				executionId,
				error,
				timestamp: new Date()
			});

			this.emit('pipeline_status_changed', {
				pipelineId,
				status: 'failed',
				timestamp: new Date()
			});

			logger.error(`Pipeline execution failed: ${executionId}`, error);
			
			return {
				status: 'failed',
				error,
				executionTime: Date.now() - startTime,
				recordsProcessed: 0,
				recordsSuccessful: 0,
				recordsFailed: 0
			};
		} finally {
			this.runningPipelines.delete(pipelineId);
			this.activePipelines.delete(pipelineId);
		}
	}

	/**
	 * Execute pipeline with retries
	 */
	async _executeWithRetries(pipeline, executionId, options) {
		const maxRetries = options.maxRetries || pipeline.retries;
		let lastError;
		
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					const delay = this.errorHandler.getRetryDelay ? this.errorHandler.getRetryDelay(attempt) : 1000 * attempt;
					logger.info(`Retrying pipeline ${pipeline.id}, attempt ${attempt}/${maxRetries}, delay: ${delay}ms`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}

				return await this._executePipelineSteps(pipeline, executionId, options);
			} catch (error) {
				lastError = error;
				
				// Report error to error handler
				if (this.errorHandler && this.errorHandler.handleError) {
					this.errorHandler.handleError(error, {
						pipelineId: pipeline.id,
						executionId,
						attempt,
						context: 'pipeline_execution'
					});
				}

				// Check if we should retry
				const shouldRetry = this.errorHandler && this.errorHandler.shouldRetry ? 
					this.errorHandler.shouldRetry(error) : attempt < maxRetries;
				
				if (attempt < maxRetries && shouldRetry) {
					continue;
				}
				
				break;
			}
		}

		throw lastError;
	}

	/**
	 * Execute the actual pipeline steps
	 */
	async _executePipelineSteps(pipeline, executionId, options) {
		const startTime = Date.now();
		
		try {
			// Save execution state
			if (this.stateManager && this.stateManager.saveState) {
				await this.stateManager.saveState(executionId, {
					pipelineId: pipeline.id,
					status: 'started',
					startTime
				});
			}

			// Step 1: Extract
			logger.debug(`${executionId}: Starting extraction`);
			const extractedData = await pipeline.extractor.extract(pipeline.config);
			
			if (!Array.isArray(extractedData)) {
				throw new Error('Extractor must return an array');
			}

			logger.debug(`${executionId}: Extracted ${extractedData.length} records`);

			// Handle empty data
			if (extractedData.length === 0) {
				return {
					status: 'completed',
					executionTime: Date.now() - startTime,
					recordsProcessed: 0,
					recordsSuccessful: 0,
					recordsFailed: 0,
					message: 'No data to process'
				};
			}

			// Step 2: Transform
			logger.debug(`${executionId}: Starting transformation`);
			const transformedData = await pipeline.transformer.transform(extractedData, pipeline.config);
			
			if (!Array.isArray(transformedData)) {
				throw new Error('Transformer must return an array');
			}

			logger.debug(`${executionId}: Transformed ${transformedData.length} records`);

			// Step 3: Load
			logger.debug(`${executionId}: Starting load`);
			const loadResult = await pipeline.loader.load(transformedData, pipeline.config);
			
			logger.debug(`${executionId}: Load completed`, loadResult);

			// Clean up components
			await this._cleanupComponents(pipeline);

			// Clear execution state
			if (this.stateManager && this.stateManager.clearState) {
				await this.stateManager.clearState(executionId);
			}

			const executionTime = Date.now() - startTime;
			
			return {
				status: 'completed',
				executionTime,
				recordsProcessed: extractedData.length,
				recordsSuccessful: loadResult.successful || 0,
				recordsFailed: loadResult.failed || 0,
				metrics: loadResult.metrics || {}
			};
		} catch (error) {
			// Clean up components on error
			await this._cleanupComponents(pipeline);
			throw error;
		}
	}

	/**
	 * Clean up pipeline components
	 */
	async _cleanupComponents(pipeline) {
		const components = [pipeline.extractor, pipeline.transformer, pipeline.loader];
		
		for (const component of components) {
			if (component && typeof component.cleanup === 'function') {
				try {
					await component.cleanup();
				} catch (error) {
					logger.warn(`Component cleanup failed for pipeline ${pipeline.id}:`, error);
				}
			}
		}
	}

	/**
	 * Execute pipeline with dependencies
	 */
	async executeWithDependencies(pipelineId, visited = new Set()) {
		if (visited.has(pipelineId)) {
			throw new Error('Circular dependency detected');
		}

		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			throw new Error(`Pipeline ${pipelineId} not found`);
		}

		visited.add(pipelineId);

		// Execute dependencies first
		for (const depId of pipeline.dependencies) {
			await this.executeWithDependencies(depId, visited);
		}

		// Execute this pipeline
		return await this.executePipeline(pipelineId);
	}

	/**
	 * Pause a pipeline
	 */
	async pausePipeline(pipelineId) {
		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			return false;
		}

		pipeline.enabled = false;
		
		logger.info(`Pipeline paused: ${pipelineId}`);
		this.emit('pipeline_paused', { pipelineId });
		
		return true;
	}

	/**
	 * Resume a pipeline
	 */
	async resumePipeline(pipelineId) {
		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			return false;
		}

		pipeline.enabled = true;
		
		logger.info(`Pipeline resumed: ${pipelineId}`);
		this.emit('pipeline_resumed', { pipelineId });
		
		return true;
	}

	/**
	 * Stop a running pipeline
	 */
	async stopPipeline(pipelineId) {
		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			return false;
		}

		// Mark as disabled to prevent new executions
		pipeline.enabled = false;
		
		logger.info(`Pipeline stop requested: ${pipelineId}`);
		this.emit('pipeline_stop_requested', { pipelineId });
		
		return true;
	}

	/**
	 * Get system health
	 */
	getHealth() {
		const uptime = Date.now() - this.stats.startTime;
		const avgExecutionTime = this.stats.totalExecutions > 0 
			? this.stats.totalExecutionTime / this.stats.totalExecutions 
			: 0;

		return {
			status: 'healthy',
			uptime,
			registeredPipelines: this.pipelines.size,
			runningPipelines: this.runningPipelines.size,
			totalExecutions: this.stats.totalExecutions,
			successfulExecutions: this.stats.successfulExecutions,
			failedExecutions: this.stats.failedExecutions,
			averageExecutionTime: Math.round(avgExecutionTime)
		};
	}

	/**
	 * Get pipeline status
	 */
	getPipelineStatus(pipelineId) {
		const pipeline = this.pipelines.get(pipelineId);
		return pipeline ? pipeline.status : null;
	}

	/**
	 * List all pipelines
	 */
	listPipelines() {
		return Array.from(this.pipelines.entries()).map(([id, pipeline]) => ({
			id,
			enabled: pipeline.enabled,
			status: pipeline.status,
			schedule: pipeline.schedule,
			dependencies: pipeline.dependencies,
			lastExecution: pipeline.lastExecution
		}));
	}

	/**
	 * Get metrics
	 */
	getMetrics() {
		const health = this.getHealth();
		
		return {
			...health,
			pipelines: this.listPipelines().reduce((acc, pipeline) => {
				acc[pipeline.id] = {
					status: pipeline.status,
					lastExecution: pipeline.lastExecution
				};
				return acc;
			}, {})
		};
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		try {
			if (this.healthCheckTimer) {
				clearInterval(this.healthCheckTimer);
				this.healthCheckTimer = null;
			}
			
			// Wait for running pipelines to complete
			const runningPromises = Array.from(this.runningPipelines.values());
			if (runningPromises.length > 0) {
				logger.info(`Waiting for ${runningPromises.length} running pipelines to complete...`);
				await Promise.allSettled(runningPromises);
			}
			
			if (this.errorHandler && this.errorHandler.cleanup) {
				await this.errorHandler.cleanup();
			}
			
			if (this.stateManager && this.stateManager.cleanup) {
				await this.stateManager.cleanup();
			}
			
			if (this.metricsCollector && this.metricsCollector.cleanup) {
				await this.metricsCollector.cleanup();
			}
			
			this.initialized = false;
			logger.info('Pipeline Engine cleanup completed');
		} catch (error) {
			logger.error('Pipeline Engine cleanup failed:', error);
		}
	}
}

module.exports = { PipelineEngine };

			await this.metricsCollector.initialize();
			await this.errorHandler.initialize();
			await this.stateManager.initialize();

			// Start health monitoring
			if (this.config.healthCheck.enabled) {
				this.startHealthMonitoring();
			}

			// Start metrics collection
			if (this.config.monitoring.enabled) {
				this.startMetricsCollection();
			}

			this.initialized = true;
			this.emit('initialized');

			logger.info('Pipeline Engine initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Pipeline Engine:', error);
			throw error;
		}
	}

	/**
	 * Register a pipeline configuration
	 */
	registerPipeline(pipelineConfig) {
		const pipelineId = pipelineConfig.id || uuidv4();

		const pipeline = {
			id: pipelineId,
			name: pipelineConfig.name,
			description: pipelineConfig.description,
			extractors: pipelineConfig.extractors || [],
			transformers: pipelineConfig.transformers || [],
			loaders: pipelineConfig.loaders || [],
			schedule: pipelineConfig.schedule,
			dependencies: pipelineConfig.dependencies || [],
			config: pipelineConfig.config || {},
			enabled: pipelineConfig.enabled !== false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.pipelines.set(pipelineId, pipeline);
		this.emit('pipelineRegistered', { pipelineId, pipeline });

		logger.info(`Pipeline registered: ${pipeline.name} (${pipelineId})`);
		return pipelineId;
	}

	/**
	 * Execute a pipeline
	 */
	async executePipeline(pipelineId, options = {}) {
		if (!this.initialized) {
			throw new Error('Pipeline engine not initialized');
		}

		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			throw new Error(`Pipeline not found: ${pipelineId}`);
		}

		if (!pipeline.enabled) {
			throw new Error(`Pipeline is disabled: ${pipelineId}`);
		}

		const executionId = uuidv4();
		const execution = {
			id: executionId,
			pipelineId,
			status: 'running',
			startTime: new Date(),
			endTime: null,
			metrics: {
				recordsProcessed: 0,
				recordsSuccessful: 0,
				recordsFailed: 0,
				errors: [],
			},
			context: options.context || {},
			checkpoints: [],
		};

		this.activePipelines.set(executionId, execution);
		this.emit('pipelineStarted', { executionId, pipelineId });

		try {
			// Check dependencies
			await this.checkDependencies(pipeline);

			// Execute pipeline stages
			const result = await this.executePipelineStages(
				pipeline,
				execution,
				options
			);

			execution.status = 'completed';
			execution.endTime = new Date();
			execution.result = result;

			this.emit('pipelineCompleted', { executionId, pipelineId, result });
			logger.info(
				`Pipeline completed successfully: ${pipeline.name} (${executionId})`
			);

			return result;
		} catch (error) {
			execution.status = 'failed';
			execution.endTime = new Date();
			execution.error = error;

			await this.errorHandler.handleError(error, {
				pipelineId,
				executionId,
				pipeline,
				execution,
			});

			this.emit('pipelineFailed', { executionId, pipelineId, error });
			logger.error(`Pipeline failed: ${pipeline.name} (${executionId})`, error);

			throw error;
		} finally {
			this.activePipelines.delete(executionId);
		}
	}

	/**
	 * Execute pipeline stages
	 */
	async executePipelineStages(pipeline, execution, options) {
		let data = options.initialData || null;
		const stageResults = [];

		// Extraction phase
		logger.info(`Starting extraction phase for pipeline: ${pipeline.name}`);
		for (const extractorConfig of pipeline.extractors) {
			const extractorResult = await this.executeExtractor(
				extractorConfig,
				execution
			);
			stageResults.push({
				stage: 'extract',
				extractor: extractorConfig.type,
				result: extractorResult,
			});

			if (data === null) {
				data = extractorResult;
			} else {
				// Merge data from multiple extractors
				data = this.mergeData(
					data,
					extractorResult,
					extractorConfig.mergeStrategy
				);
			}

			// Create checkpoint
			await this.createCheckpoint(
				execution,
				'extract',
				extractorConfig.type,
				data
			);
		}

		// Transformation phase
		logger.info(`Starting transformation phase for pipeline: ${pipeline.name}`);
		for (const transformerConfig of pipeline.transformers) {
			data = await this.executeTransformer(transformerConfig, data, execution);
			stageResults.push({
				stage: 'transform',
				transformer: transformerConfig.type,
				recordCount: Array.isArray(data) ? data.length : 1,
			});

			// Create checkpoint
			await this.createCheckpoint(
				execution,
				'transform',
				transformerConfig.type,
				data
			);
		}

		// Loading phase
		logger.info(`Starting loading phase for pipeline: ${pipeline.name}`);
		const loadResults = [];
		for (const loaderConfig of pipeline.loaders) {
			const loadResult = await this.executeLoader(
				loaderConfig,
				data,
				execution
			);
			loadResults.push(loadResult);
			stageResults.push({
				stage: 'load',
				loader: loaderConfig.type,
				result: loadResult,
			});

			// Create checkpoint
			await this.createCheckpoint(
				execution,
				'load',
				loaderConfig.type,
				loadResult
			);
		}

		return {
			stages: stageResults,
			loadResults,
			totalRecords: Array.isArray(data) ? data.length : 1,
			executionId: execution.id,
		};
	}

	/**
	 * Execute an extractor
	 */
	async executeExtractor(extractorConfig, execution) {
		const Extractor = require(`../extractors/${extractorConfig.type}`);
		const extractor = new Extractor(extractorConfig.config);

		try {
			await extractor.initialize();
			const result = await extractor.extract();

			execution.metrics.recordsProcessed += Array.isArray(result)
				? result.length
				: 1;
			this.metricsCollector.recordExtraction(extractorConfig.type, result);

			return result;
		} catch (error) {
			execution.metrics.errors.push({
				stage: 'extract',
				extractor: extractorConfig.type,
				error: error.message,
				timestamp: new Date(),
			});
			throw error;
		} finally {
			await extractor.cleanup();
		}
	}

	/**
	 * Execute a transformer
	 */
	async executeTransformer(transformerConfig, data, execution) {
		const Transformer = require(`../transformers/${transformerConfig.type}`);
		const transformer = new Transformer(transformerConfig.config);

		try {
			await transformer.initialize();
			const result = await transformer.transform(data);

			this.metricsCollector.recordTransformation(
				transformerConfig.type,
				data,
				result
			);
			return result;
		} catch (error) {
			execution.metrics.errors.push({
				stage: 'transform',
				transformer: transformerConfig.type,
				error: error.message,
				timestamp: new Date(),
			});
			throw error;
		} finally {
			await transformer.cleanup();
		}
	}

	/**
	 * Execute a loader
	 */
	async executeLoader(loaderConfig, data, execution) {
		const Loader = require(`../loaders/${loaderConfig.type}`);
		const loader = new Loader(loaderConfig.config);

		try {
			await loader.initialize();
			const result = await loader.load(data);

			execution.metrics.recordsSuccessful += Array.isArray(data)
				? data.length
				: 1;
			this.metricsCollector.recordLoad(loaderConfig.type, data, result);

			return result;
		} catch (error) {
			execution.metrics.recordsFailed += Array.isArray(data) ? data.length : 1;
			execution.metrics.errors.push({
				stage: 'load',
				loader: loaderConfig.type,
				error: error.message,
				timestamp: new Date(),
			});
			throw error;
		} finally {
			await loader.cleanup();
		}
	}

	/**
	 * Create a checkpoint for pipeline state
	 */
	async createCheckpoint(execution, stage, component, data) {
		const checkpoint = {
			id: uuidv4(),
			executionId: execution.id,
			stage,
			component,
			timestamp: new Date(),
			dataSize: this.calculateDataSize(data),
		};

		execution.checkpoints.push(checkpoint);
		await this.stateManager.saveCheckpoint(checkpoint, data);
	}

	/**
	 * Merge data from multiple sources
	 */
	mergeData(existingData, newData, strategy = 'append') {
		switch (strategy) {
			case 'append':
				return Array.isArray(existingData)
					? existingData.concat(Array.isArray(newData) ? newData : [newData])
					: [existingData].concat(Array.isArray(newData) ? newData : [newData]);
			case 'merge':
				return { ...existingData, ...newData };
			case 'replace':
				return newData;
			default:
				return existingData;
		}
	}

	/**
	 * Check pipeline dependencies
	 */
	async checkDependencies(pipeline) {
		for (const dependency of pipeline.dependencies) {
			const dependencyPipeline = this.pipelines.get(dependency.pipelineId);
			if (!dependencyPuleline) {
				throw new Error(
					`Dependency pipeline not found: ${dependency.pipelineId}`
				);
			}

			// Check if dependency completed successfully within time window
			const lastExecution = await this.stateManager.getLastExecution(
				dependency.pipelineId
			);
			if (!lastExecution || lastExecution.status !== 'completed') {
				throw new Error(`Dependency not satisfied: ${dependency.pipelineId}`);
			}

			if (dependency.maxAge) {
				const ageMs = Date.now() - lastExecution.endTime.getTime();
				if (ageMs > dependency.maxAge) {
					throw new Error(`Dependency too old: ${dependency.pipelineId}`);
				}
			}
		}
	}

	/**
	 * Get pipeline status
	 */
	getPipelineStatus(pipelineId) {
		const pipeline = this.pipelines.get(pipelineId);
		if (!pipeline) {
			return null;
		}

		const activePipeline = Array.from(this.activePipelines.values()).find(
			(exec) => exec.pipelineId === pipelineId
		);

		return {
			id: pipelineId,
			name: pipeline.name,
			enabled: pipeline.enabled,
			status: activePipeline ? activePipeline.status : 'idle',
			lastExecution: this.stateManager.getLastExecution(pipelineId),
			metrics: this.metricsCollector.getPipelineMetrics(pipelineId),
		};
	}

	/**
	 * Start health monitoring
	 */
	startHealthMonitoring() {
		this.healthCheckInterval = setInterval(async () => {
			try {
				const health = await this.performHealthCheck();
				this.emit('healthCheck', health);
			} catch (error) {
				logger.error('Health check failed:', error);
				this.emit('healthCheckFailed', error);
			}
		}, this.config.healthCheck.interval);
	}

	/**
	 * Start metrics collection
	 */
	startMetricsCollection() {
		this.metricsInterval = setInterval(() => {
			const metrics = this.metricsCollector.getSystemMetrics();
			this.emit('metrics', metrics);
		}, this.config.monitoring.metricsInterval);
	}

	/**
	 * Perform health check
	 */
	async performHealthCheck() {
		const health = {
			status: 'healthy',
			timestamp: new Date(),
			pipelines: {
				total: this.pipelines.size,
				active: this.activePipelines.size,
				enabled: Array.from(this.pipelines.values()).filter((p) => p.enabled)
					.length,
			},
			components: {},
		};

		// Check component health
		try {
			health.components.metricsCollector =
				await this.metricsCollector.healthCheck();
		} catch (error) {
			health.components.metricsCollector = {
				status: 'unhealthy',
				error: error.message,
			};
			health.status = 'degraded';
		}

		try {
			health.components.stateManager = await this.stateManager.healthCheck();
		} catch (error) {
			health.components.stateManager = {
				status: 'unhealthy',
				error: error.message,
			};
			health.status = 'degraded';
		}

		return health;
	}

	/**
	 * Calculate data size for metrics
	 */
	calculateDataSize(data) {
		if (!data) return 0;
		if (Array.isArray(data)) return data.length;
		if (typeof data === 'object') return Object.keys(data).length;
		return 1;
	}

	/**
	 * Shutdown the pipeline engine
	 */
	async shutdown() {
		logger.info('Shutting down Pipeline Engine...');

		// Clear intervals
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
		}

		// Wait for active pipelines to complete or timeout
		const activeExecutions = Array.from(this.activePipelines.keys());
		if (activeExecutions.length > 0) {
			logger.info(
				`Waiting for ${activeExecutions.length} active pipelines to complete...`
			);

			// Wait up to 30 seconds for graceful shutdown
			const timeout = setTimeout(() => {
				logger.warn('Forced shutdown of active pipelines');
			}, 30000);

			await Promise.allSettled(
				activeExecutions.map(
					(id) =>
						new Promise((resolve) => {
							const checkComplete = () => {
								if (!this.activePipelines.has(id)) {
									resolve();
								} else {
									setTimeout(checkComplete, 100);
								}
							};
							checkComplete();
						})
				)
			);

			clearTimeout(timeout);
		}

		// Cleanup components
		await this.metricsCollector.shutdown();
		await this.stateManager.shutdown();

		this.emit('shutdown');
		logger.info('Pipeline Engine shutdown complete');
	}
}

module.exports = { PipelineEngine };
