/**
 * Base Transformer Interface
 * Defines the contract for all data transformers
 */

const { ETLComponent } = require('../core/interfaces');
const logger = require('../../utils/logger');

class BaseTransformer extends ETLComponent {
	constructor(config = {}) {
		super(config);
		this.config = {
			batchSize: config.batchSize || 1000,
			parallelProcessing: config.parallelProcessing || false,
			maxConcurrency: config.maxConcurrency || 4,
			validation: {
				enabled: config.validationEnabled !== false,
				inputSchema: config.inputSchema,
				outputSchema: config.outputSchema,
				strictMode: config.strictMode || false,
			},
			errorHandling: {
				skipInvalidRecords: config.skipInvalidRecords !== false,
				maxErrors: config.maxErrors || 100,
				errorThreshold: config.errorThreshold || 0.1, // 10%
			},
			caching: {
				enabled: config.cachingEnabled || false,
				ttl: config.cacheTtl || 300000, // 5 minutes
				maxSize: config.cacheMaxSize || 10000,
			},
			profiling: {
				enabled: config.profilingEnabled || false,
				sampleRate: config.sampleRate || 0.1, // 10%
			},
			...config,
		};

		this.transformationCache = new Map();
		this.errorCount = 0;
		this.transformationStats = {
			totalProcessed: 0,
			successful: 0,
			failed: 0,
			cached: 0,
			avgProcessingTime: 0,
		};
	}

	/**
	 * Initialize the transformer
	 */
	async initialize() {
		logger.info(`Initializing ${this.constructor.name}...`);

		// Initialize transformer-specific components
		await this.initializeTransformer();

		// Setup caching if enabled
		if (this.config.caching.enabled) {
			this.initializeCache();
		}

		this.metrics.startTime = Date.now();
		logger.info(`${this.constructor.name} initialized successfully`);
	}

	/**
	 * Transform data
	 */
	async transform(data) {
		try {
			this.metrics.startTime = Date.now();

			if (!data || (Array.isArray(data) && data.length === 0)) {
				logger.warn('No data provided to transformer');
				return data;
			}

			// Validate input data
			if (
				this.config.validation.enabled &&
				this.config.validation.inputSchema
			) {
				await this.validateInput(data);
			}

			// Process data
			const transformedData = Array.isArray(data)
				? await this.transformBatch(data)
				: await this.transformRecord(data);

			// Validate output data
			if (
				this.config.validation.enabled &&
				this.config.validation.outputSchema
			) {
				await this.validateOutput(transformedData);
			}

			// Check error threshold
			this.checkErrorThreshold();

			this.metrics.endTime = Date.now();
			this.metrics.recordsProcessed = Array.isArray(transformedData)
				? transformedData.length
				: 1;

			logger.info(
				`Transformation completed: ${this.metrics.recordsProcessed} records processed`
			);
			return transformedData;
		} catch (error) {
			this.metrics.errors++;
			this.metrics.endTime = Date.now();
			logger.error(`Transformation failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Transform a batch of records
	 */
	async transformBatch(batch) {
		const results = [];
		const errors = [];

		if (this.config.parallelProcessing) {
			return await this.transformBatchParallel(batch);
		}

		// Process sequentially
		for (let i = 0; i < batch.length; i += this.config.batchSize) {
			const chunk = batch.slice(i, i + this.config.batchSize);

			for (const record of chunk) {
				try {
					const startTime = Date.now();
					const transformedRecord = await this.transformRecord(record);
					const endTime = Date.now();

					if (transformedRecord !== null && transformedRecord !== undefined) {
						results.push(transformedRecord);
						this.transformationStats.successful++;
					}

					// Update stats
					this.updateProcessingStats(endTime - startTime);
				} catch (error) {
					this.errorCount++;
					this.transformationStats.failed++;
					errors.push({ record, error: error.message, index: i });

					logger.error(`Error transforming record at index ${i}:`, error);

					if (!this.config.errorHandling.skipInvalidRecords) {
						throw error;
					}

					if (this.errorCount >= this.config.errorHandling.maxErrors) {
						throw new Error(`Maximum error count reached: ${this.errorCount}`);
					}
				}
			}

			// Log progress
			if (batch.length > 1000) {
				const progress = Math.round(((i + chunk.length) / batch.length) * 100);
				logger.info(
					`Transformation progress: ${progress}% (${i + chunk.length}/${
						batch.length
					})`
				);
			}
		}

		if (errors.length > 0) {
			logger.warn(`Transformation completed with ${errors.length} errors`);
			// this.emit('transformationErrors', errors); // Removed for now
		}

		return results;
	}

	/**
	 * Transform batch in parallel
	 */
	async transformBatchParallel(batch) {
		const chunks = this.chunkArray(
			batch,
			Math.ceil(batch.length / this.config.maxConcurrency)
		);
		const results = [];

		const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
			const chunkResults = [];

			for (const record of chunk) {
				try {
					const startTime = Date.now();
					const transformedRecord = await this.transformRecord(record);
					const endTime = Date.now();

					if (transformedRecord !== null && transformedRecord !== undefined) {
						chunkResults.push(transformedRecord);
						this.transformationStats.successful++;
					}

					this.updateProcessingStats(endTime - startTime);
				} catch (error) {
					this.errorCount++;
					this.transformationStats.failed++;

					logger.error(`Error in chunk ${chunkIndex}:`, error);

					if (!this.config.errorHandling.skipInvalidRecords) {
						throw error;
					}
				}
			}

			return chunkResults;
		});

		const chunkResults = await Promise.all(chunkPromises);

		// Flatten results
		for (const chunkResult of chunkResults) {
			results.push(...chunkResult);
		}

		return results;
	}

	/**
	 * Transform a single record (must be implemented by subclasses)
	 */
	async transformRecord(record) {
		// Check cache first
		if (this.config.caching.enabled) {
			const cacheKey = this.generateCacheKey(record);
			const cached = this.transformationCache.get(cacheKey);

			if (cached) {
				this.transformationStats.cached++;
				return cached;
			}
		}

		// Perform transformation
		const transformed = await this.doTransformRecord(record);

		// Cache result
		if (this.config.caching.enabled && transformed) {
			const cacheKey = this.generateCacheKey(record);
			this.cacheTransformation(cacheKey, transformed);
		}

		return transformed;
	}

	/**
	 * Perform the actual record transformation (override in subclasses)
	 */
	async doTransformRecord(record) {
		throw new Error('doTransformRecord() must be implemented by subclass');
	}

	/**
	 * Validate input data
	 */
	async validateInput(data) {
		const Ajv = require('ajv');
		const ajv = new Ajv();
		const validate = ajv.compile(this.config.validation.inputSchema);

		const dataToValidate = Array.isArray(data) ? data[0] : data;
		const valid = validate(dataToValidate);

		if (!valid) {
			const error = new Error(
				`Input validation failed: ${ajv.errorsText(validate.errors)}`
			);
			error.validationErrors = validate.errors;
			throw error;
		}
	}

	/**
	 * Validate output data
	 */
	async validateOutput(data) {
		const Ajv = require('ajv');
		const ajv = new Ajv();
		const validate = ajv.compile(this.config.validation.outputSchema);

		const dataToValidate = Array.isArray(data) ? data[0] : data;
		const valid = validate(dataToValidate);

		if (!valid) {
			const error = new Error(
				`Output validation failed: ${ajv.errorsText(validate.errors)}`
			);
			error.validationErrors = validate.errors;
			throw error;
		}
	}

	/**
	 * Check error threshold
	 */
	checkErrorThreshold() {
		const totalProcessed =
			this.transformationStats.successful + this.transformationStats.failed;
		if (totalProcessed === 0) return;

		const errorRate = this.transformationStats.failed / totalProcessed;

		if (errorRate > this.config.errorHandling.errorThreshold) {
			throw new Error(
				`Error threshold exceeded: ${Math.round(
					errorRate * 100
				)}% > ${Math.round(this.config.errorHandling.errorThreshold * 100)}%`
			);
		}
	}

	/**
	 * Initialize cache
	 */
	initializeCache() {
		// Setup cache cleanup timer
		setInterval(() => {
			this.cleanupCache();
		}, this.config.caching.ttl);
	}

	/**
	 * Generate cache key for record
	 */
	generateCacheKey(record) {
		const crypto = require('crypto');
		const recordString = JSON.stringify(record);
		return crypto.createHash('md5').update(recordString).digest('hex');
	}

	/**
	 * Cache transformation result
	 */
	cacheTransformation(key, result) {
		if (this.transformationCache.size >= this.config.caching.maxSize) {
			// Remove oldest entry
			const firstKey = this.transformationCache.keys().next().value;
			this.transformationCache.delete(firstKey);
		}

		this.transformationCache.set(key, {
			result,
			timestamp: Date.now(),
		});
	}

	/**
	 * Cleanup expired cache entries
	 */
	cleanupCache() {
		const now = Date.now();
		const expiredKeys = [];

		for (const [key, entry] of this.transformationCache.entries()) {
			if (now - entry.timestamp > this.config.caching.ttl) {
				expiredKeys.push(key);
			}
		}

		for (const key of expiredKeys) {
			this.transformationCache.delete(key);
		}

		if (expiredKeys.length > 0) {
			logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
		}
	}

	/**
	 * Update processing statistics
	 */
	updateProcessingStats(processingTime) {
		this.transformationStats.totalProcessed++;

		// Update average processing time
		const total =
			this.transformationStats.avgProcessingTime *
			(this.transformationStats.totalProcessed - 1);
		this.transformationStats.avgProcessingTime =
			(total + processingTime) / this.transformationStats.totalProcessed;
	}

	/**
	 * Chunk array into smaller arrays
	 */
	chunkArray(array, chunkSize) {
		const chunks = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	/**
	 * Get transformation statistics
	 */
	getTransformationStats() {
		return {
			...this.transformationStats,
			errorRate:
				this.transformationStats.totalProcessed > 0
					? this.transformationStats.failed /
					  this.transformationStats.totalProcessed
					: 0,
			cacheHitRate:
				this.transformationStats.totalProcessed > 0
					? this.transformationStats.cached /
					  this.transformationStats.totalProcessed
					: 0,
			cacheSize: this.transformationCache.size,
		};
	}

	/**
	 * Transformer-specific initialization (override in subclasses)
	 */
	async initializeTransformer() {
		// Default implementation - override in subclasses
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		await super.cleanup();

		// Clear cache
		this.transformationCache.clear();

		// Transformer-specific cleanup
		await this.cleanupTransformer();
	}

	/**
	 * Transformer-specific cleanup (override in subclasses)
	 */
	async cleanupTransformer() {
		// Default implementation - override in subclasses
	}
}

module.exports = BaseTransformer;
