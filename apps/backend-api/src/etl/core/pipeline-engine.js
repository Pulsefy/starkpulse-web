/**
 * ETL Pipeline Engine - Orchestrates data processing pipelines
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');
const { MetricsCollector } = require('../quality/metrics-collector');
const ErrorHandler = require('./error-handler');
const StateManager = require('./state-manager');

class PipelineEngine extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			maxConcurrency: config.maxConcurrency || 5,
			maxRetries: config.maxRetries || 3,
			healthCheckInterval: config.healthCheckInterval || 30000,
			enableMetrics: config.enableMetrics !== false,
			...config,
		};

		// Core components
		this.pipelines = new Map();
		this.runningPipelines = new Map();
		this.activePipelines = new Map(); // For backward compatibility
		this.executionQueue = [];

		// Services
		this.errorHandler = new ErrorHandler(this.config.errorHandler);
		this.stateManager = new StateManager(this.config.stateManager);
		this.metricsCollector = this.config.enableMetrics
			? new MetricsCollector(this.config.metrics)
			: null;

		// Stats
		this.stats = {
			totalExecutions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			totalExecutionTime: 0,
			startTime: Date.now(),
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
			throw new Error(
				'Pipeline configuration must include extractor, transformer, and loader'
			);
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
			status: 'idle',
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
			status: 'running',
		};

		this.emit('pipeline_started', {
			pipelineId,
			executionId,
			timestamp: new Date(startTime),
		});

		this.emit('pipeline_status_changed', {
			pipelineId,
			status: 'running',
			timestamp: new Date(startTime),
		});

		// Create execution promise
		const executionPromise = this._executeWithRetries(
			pipeline,
			executionId,
			options
		);
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
				timestamp: new Date(),
			});

			this.emit('pipeline_status_changed', {
				pipelineId,
				status: 'completed',
				timestamp: new Date(),
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
				timestamp: new Date(),
			});

			this.emit('pipeline_status_changed', {
				pipelineId,
				status: 'failed',
				timestamp: new Date(),
			});

			logger.error(`Pipeline execution failed: ${executionId}`, error);

			return {
				status: 'failed',
				error,
				executionTime: Date.now() - startTime,
				recordsProcessed: 0,
				recordsSuccessful: 0,
				recordsFailed: 0,
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
					const delay = this.errorHandler.getRetryDelay
						? this.errorHandler.getRetryDelay(attempt)
						: 1000 * attempt;
					logger.info(
						`Retrying pipeline ${pipeline.id}, attempt ${attempt}/${maxRetries}, delay: ${delay}ms`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
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
						context: 'pipeline_execution',
					});
				}

				// Check if we should retry
				const shouldRetry =
					this.errorHandler && this.errorHandler.shouldRetry
						? this.errorHandler.shouldRetry(error)
						: attempt < maxRetries;

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
					status: 'running',
					startTime,
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
					message: 'No data to process',
				};
			}

			// Step 2: Transform
			logger.debug(`${executionId}: Starting transformation`);
			const transformedData = await pipeline.transformer.transform(
				extractedData,
				pipeline.config
			);

			if (!Array.isArray(transformedData)) {
				throw new Error('Transformer must return an array');
			}

			logger.debug(
				`${executionId}: Transformed ${transformedData.length} records`
			);

			// Step 3: Load
			logger.debug(`${executionId}: Starting load`);
			const loadResult = await pipeline.loader.load(
				transformedData,
				pipeline.config
			);

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
				metrics: loadResult.metrics || {},
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
		const components = [
			pipeline.extractor,
			pipeline.transformer,
			pipeline.loader,
		];

		for (const component of components) {
			if (component && typeof component.cleanup === 'function') {
				try {
					await component.cleanup();
				} catch (error) {
					logger.warn(
						`Component cleanup failed for pipeline ${pipeline.id}:`,
						error
					);
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
		const avgExecutionTime =
			this.stats.totalExecutions > 0
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
			averageExecutionTime: Math.round(avgExecutionTime),
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
			lastExecution: pipeline.lastExecution,
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
					lastExecution: pipeline.lastExecution,
				};
				return acc;
			}, {}),
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
				logger.info(
					`Waiting for ${runningPromises.length} running pipelines to complete...`
				);
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

module.exports = PipelineEngine;
