/**
 * ETL Pipeline Manager
 * Orchestrates the complete ETL process with error handling, monitoring, and recovery
 */

const EventEmitter = require('eventemitter3');
const { PipelineContext } = require('./interfaces');
const logger = require('../../utils/logger');

class ETLPipelineManager extends EventEmitter {
	constructor(config = {}) {
		super();
		this.config = {
			maxRetries: 3,
			retryDelay: 1000,
			batchSize: 1000,
			enableParallelProcessing: false,
			maxConcurrency: 5,
			...config,
		};
		this.pipelines = new Map();
		this.runningPipelines = new Set();
		this.pipelineHistory = [];
	}

	/**
	 * Register a new pipeline
	 */
	registerPipeline(pipelineId, pipeline) {
		if (this.pipelines.has(pipelineId)) {
			throw new Error(`Pipeline ${pipelineId} already exists`);
		}

		// Validate pipeline structure
		this.validatePipeline(pipeline);

		this.pipelines.set(pipelineId, {
			...pipeline,
			id: pipelineId,
			createdAt: new Date(),
			lastRun: null,
			runCount: 0,
		});

		logger.info(`Pipeline ${pipelineId} registered successfully`);
	}

	/**
	 * Validate pipeline structure
	 */
	validatePipeline(pipeline) {
		if (!pipeline.extractor) {
			throw new Error('Pipeline must have an extractor');
		}
		if (!pipeline.transformer) {
			throw new Error('Pipeline must have a transformer');
		}
		if (!pipeline.loader) {
			throw new Error('Pipeline must have a loader');
		}
	}

	/**
	 * Execute a pipeline
	 */
	async executePipeline(pipelineId, options = {}) {
		if (!this.pipelines.has(pipelineId)) {
			throw new Error(`Pipeline ${pipelineId} not found`);
		}

		if (this.runningPipelines.has(pipelineId)) {
			throw new Error(`Pipeline ${pipelineId} is already running`);
		}

		const pipeline = this.pipelines.get(pipelineId);
		const context = new PipelineContext(pipelineId, {
			...this.config,
			...options,
		});

		this.runningPipelines.add(pipelineId);
		this.emit('pipeline:started', { pipelineId, context });

		try {
			// Initialize components
			await this.initializeComponents(pipeline);

			// Execute ETL phases
			const extractedData = await this.executeExtraction(pipeline, context);
			const transformedData = await this.executeTransformation(
				pipeline,
				extractedData,
				context
			);
			const loadResult = await this.executeLoading(
				pipeline,
				transformedData,
				context
			);

			// Complete pipeline
			context.complete();

			// Update pipeline metadata
			pipeline.lastRun = new Date();
			pipeline.runCount++;

			// Store execution history
			this.pipelineHistory.push(context.getSummary());

			this.emit('pipeline:completed', {
				pipelineId,
				context,
				result: loadResult,
			});
			logger.info(`Pipeline ${pipelineId} completed successfully`);

			return context.getSummary();
		} catch (error) {
			context.addError(error, 'pipeline');
			context.complete();

			this.pipelineHistory.push(context.getSummary());
			this.emit('pipeline:failed', { pipelineId, context, error });
			logger.error(`Pipeline ${pipelineId} failed:`, error);

			throw error;
		} finally {
			this.runningPipelines.delete(pipelineId);
			await this.cleanupComponents(pipeline);
		}
	}

	/**
	 * Initialize all pipeline components
	 */
	async initializeComponents(pipeline) {
		await pipeline.extractor.initialize();
		await pipeline.transformer.initialize();
		await pipeline.loader.initialize();
	}

	/**
	 * Execute extraction phase
	 */
	async executeExtraction(pipeline, context) {
		const startTime = Date.now();
		this.emit('extraction:started', { pipelineId: context.pipelineId });

		try {
			// Validate source
			await pipeline.extractor.validateSource();

			// Extract data
			const data = await pipeline.extractor.extract();

			context.metrics.extractionTime = Date.now() - startTime;
			this.emit('extraction:completed', {
				pipelineId: context.pipelineId,
				recordCount: Array.isArray(data) ? data.length : 'stream',
			});

			return data;
		} catch (error) {
			context.addError(error, 'extraction');
			throw error;
		}
	}

	/**
	 * Execute transformation phase
	 */
	async executeTransformation(pipeline, data, context) {
		const startTime = Date.now();
		this.emit('transformation:started', { pipelineId: context.pipelineId });

		try {
			// Validate transformation rules
			await pipeline.transformer.validateRules();

			let transformedData;

			// Handle different data types
			if (Array.isArray(data)) {
				transformedData = await this.processBatch(
					data,
					pipeline.transformer,
					context
				);
			} else if (data && typeof data[Symbol.asyncIterator] === 'function') {
				transformedData = await this.processStream(
					data,
					pipeline.transformer,
					context
				);
			} else {
				transformedData = await pipeline.transformer.transform(data);
			}

			context.metrics.transformationTime = Date.now() - startTime;
			this.emit('transformation:completed', {
				pipelineId: context.pipelineId,
				recordCount: Array.isArray(transformedData)
					? transformedData.length
					: 'stream',
			});

			return transformedData;
		} catch (error) {
			context.addError(error, 'transformation');
			throw error;
		}
	}

	/**
	 * Execute loading phase
	 */
	async executeLoading(pipeline, data, context) {
		const startTime = Date.now();
		this.emit('loading:started', { pipelineId: context.pipelineId });

		try {
			// Validate destination
			await pipeline.loader.validateDestination();

			let loadResult;

			// Handle different data types
			if (Array.isArray(data)) {
				loadResult = await this.loadBatch(data, pipeline.loader, context);
			} else if (data && typeof data[Symbol.asyncIterator] === 'function') {
				loadResult = await this.loadStream(data, pipeline.loader, context);
			} else {
				loadResult = await pipeline.loader.load(data);
			}

			context.metrics.loadingTime = Date.now() - startTime;
			this.emit('loading:completed', {
				pipelineId: context.pipelineId,
				result: loadResult,
			});

			return loadResult;
		} catch (error) {
			context.addError(error, 'loading');
			throw error;
		}
	}

	/**
	 * Process data in batches
	 */
	async processBatch(data, processor, context) {
		const results = [];
		const batchSize = this.config.batchSize;

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			try {
				const batchResult = await processor.transform(batch);
				results.push(
					...(Array.isArray(batchResult) ? batchResult : [batchResult])
				);
				context.metrics.successfulRecords += batch.length;
			} catch (error) {
				context.addError(error, 'batch-processing');
				context.metrics.failedRecords += batch.length;

				if (this.config.stopOnError) {
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Process streaming data
	 */
	async processStream(dataStream, processor, context) {
		const results = [];

		for await (const chunk of dataStream) {
			try {
				const processedChunk = await processor.transform(chunk);
				results.push(processedChunk);
				context.metrics.successfulRecords++;
			} catch (error) {
				context.addError(error, 'stream-processing');
				context.metrics.failedRecords++;

				if (this.config.stopOnError) {
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Load data in batches
	 */
	async loadBatch(data, loader, context) {
		const batchSize = this.config.batchSize;
		const results = [];

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			try {
				const batchResult = await loader.load(batch);
				results.push(batchResult);
			} catch (error) {
				context.addError(error, 'batch-loading');

				if (this.config.stopOnError) {
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Load streaming data
	 */
	async loadStream(dataStream, loader, context) {
		const results = [];

		for await (const chunk of dataStream) {
			try {
				const result = await loader.load(chunk);
				results.push(result);
			} catch (error) {
				context.addError(error, 'stream-loading');

				if (this.config.stopOnError) {
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Cleanup pipeline components
	 */
	async cleanupComponents(pipeline) {
		try {
			await pipeline.extractor.cleanup();
			await pipeline.transformer.cleanup();
			await pipeline.loader.cleanup();
		} catch (error) {
			logger.error('Error cleaning up pipeline components:', error);
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

		return {
			id: pipelineId,
			isRunning: this.runningPipelines.has(pipelineId),
			lastRun: pipeline.lastRun,
			runCount: pipeline.runCount,
			createdAt: pipeline.createdAt,
		};
	}

	/**
	 * Get all pipeline statuses
	 */
	getAllPipelineStatuses() {
		const statuses = [];
		for (const [pipelineId] of this.pipelines) {
			statuses.push(this.getPipelineStatus(pipelineId));
		}
		return statuses;
	}

	/**
	 * Get pipeline execution history
	 */
	getPipelineHistory(pipelineId = null, limit = 100) {
		let history = this.pipelineHistory;

		if (pipelineId) {
			history = history.filter((h) => h.pipelineId === pipelineId);
		}

		return history
			.sort((a, b) => b.metrics.startTime - a.metrics.startTime)
			.slice(0, limit);
	}

	/**
	 * Remove a pipeline
	 */
	removePipeline(pipelineId) {
		if (this.runningPipelines.has(pipelineId)) {
			throw new Error(`Cannot remove running pipeline ${pipelineId}`);
		}

		this.pipelines.delete(pipelineId);
		logger.info(`Pipeline ${pipelineId} removed`);
	}

	/**
	 * Stop all running pipelines
	 */
	async stopAllPipelines() {
		const runningPipelines = Array.from(this.runningPipelines);
		logger.info(`Stopping ${runningPipelines.length} running pipelines...`);

		// In a real implementation, you would need to implement cancellation logic
		// For now, we just clear the running set
		this.runningPipelines.clear();
	}
}

module.exports = ETLPipelineManager;
