/**
 * Base Extractor Interface
 * Defines the contract for all data extractors
 */

const { ETLComponent } = require('../core/interfaces');
const logger = require('../../utils/logger');

class BaseExtractor extends ETLComponent {
	constructor(config = {}) {
		super(config);
		this.config = {
			batchSize: config.batchSize || 1000,
			timeout: config.timeout || 30000,
			retryPolicy: {
				maxRetries: config.maxRetries || 3,
				backoffDelay: config.backoffDelay || 1000,
			},
			validation: {
				enabled: config.validationEnabled !== false,
				schema: config.validationSchema,
			},
			rateLimit: {
				enabled: config.rateLimitEnabled !== false,
				requestsPerSecond: config.requestsPerSecond || 10,
				burstLimit: config.burstLimit || 100,
			},
			...config,
		};

		this.rateLimiter = null;
		this.lastRequestTime = 0;
		this.requestCount = 0;
	}

	/**
	 * Initialize the extractor
	 */
	async initialize() {
		logger.info(`Initializing ${this.constructor.name}...`);

		// Initialize rate limiter
		if (this.config.rateLimit.enabled) {
			this.initializeRateLimiter();
		}

		// Perform extractor-specific initialization
		await this.initializeExtractor();

		this.metrics.startTime = Date.now();
		logger.info(`${this.constructor.name} initialized successfully`);
	}

	/**
	 * Initialize rate limiter
	 */
	initializeRateLimiter() {
		const TokenBucket = require('../../utils/token-bucket');
		this.rateLimiter = new TokenBucket({
			capacity: this.config.rateLimit.burstLimit,
			tokensPerInterval: this.config.rateLimit.requestsPerSecond,
			interval: 1000, // 1 second
		});
	}

	/**
	 * Extract data from source
	 */
	async extract() {
		try {
			this.metrics.startTime = Date.now();

			// Get total count if supported
			const totalCount = await this.getTotalCount();
			if (totalCount !== null) {
				logger.info(`Total records to extract: ${totalCount}`);
			}

			// Extract data in batches
			const allData = [];
			let offset = 0;
			let hasMore = true;

			while (hasMore) {
				// Apply rate limiting
				if (this.rateLimiter) {
					await this.rateLimiter.removeTokens(1);
				}

				// Extract batch
				const batch = await this.extractBatch(offset, this.config.batchSize);

				if (!batch || batch.length === 0) {
					hasMore = false;
					break;
				}

				// Validate batch if enabled
				if (this.config.validation.enabled) {
					const validBatch = await this.validateBatch(batch);
					allData.push(...validBatch);
				} else {
					allData.push(...batch);
				}

				this.metrics.recordsProcessed += batch.length;
				offset += batch.length;

				// Check if we got less than batch size (indicating end)
				if (batch.length < this.config.batchSize) {
					hasMore = false;
				}

				// Log progress
				if (totalCount) {
					const progress = Math.round((offset / totalCount) * 100);
					logger.info(
						`Extraction progress: ${progress}% (${offset}/${totalCount})`
					);
				} else {
					logger.info(`Extracted ${offset} records so far...`);
				}
			}

			this.metrics.endTime = Date.now();
			logger.info(`Extraction completed: ${allData.length} records extracted`);

			return allData;
		} catch (error) {
			this.metrics.errors++;
			this.metrics.endTime = Date.now();
			logger.error(`Extraction failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get total count of records (override in subclasses if supported)
	 */
	async getTotalCount() {
		return null; // Not supported by default
	}

	/**
	 * Extract a batch of records (must be implemented by subclasses)
	 */
	async extractBatch(offset, limit) {
		throw new Error('extractBatch() must be implemented by subclass');
	}

	/**
	 * Validate a batch of records
	 */
	async validateBatch(batch) {
		if (!this.config.validation.schema) {
			return batch;
		}

		const Ajv = require('ajv');
		const ajv = new Ajv();
		const validate = ajv.compile(this.config.validation.schema);

		const validRecords = [];
		const invalidRecords = [];

		for (const record of batch) {
			const valid = validate(record);
			if (valid) {
				validRecords.push(record);
			} else {
				invalidRecords.push({
					record,
					errors: validate.errors,
				});
				this.metrics.errors++;
			}
		}

		if (invalidRecords.length > 0) {
			logger.warn(`Validation failed for ${invalidRecords.length} records`, {
				invalidRecords: invalidRecords.slice(0, 5), // Log first 5 invalid records
			});
		}

		return validRecords;
	}

	/**
	 * Extractor-specific initialization (override in subclasses)
	 */
	async initializeExtractor() {
		// Default implementation - override in subclasses
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		await super.cleanup();
		// Extractor-specific cleanup
	}
}

module.exports = BaseExtractor;
