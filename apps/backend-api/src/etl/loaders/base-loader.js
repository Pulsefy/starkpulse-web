/**
 * Base Loader Interface
 * Defines the contract for all data loaders
 */

const { ETLComponent } = require('../core/interfaces');
const logger = require('../../utils/logger');

class BaseLoader extends ETLComponent {
	constructor(config = {}) {
		super(config);
		this.config = {
			batchSize: config.batchSize || 1000,
			maxConcurrency: config.maxConcurrency || 5,
			upsert: config.upsert || false,
			primaryKey: config.primaryKey,
			conflictResolution: config.conflictResolution || 'replace', // replace, ignore, merge
			validation: {
				enabled: config.validationEnabled !== false,
				schema: config.validationSchema,
				strictMode: config.strictMode || false,
			},
			retry: {
				enabled: config.retryEnabled !== false,
				maxRetries: config.maxRetries || 3,
				backoffDelay: config.backoffDelay || 1000,
			},
			versioning: {
				enabled: config.versioningEnabled || false,
				versionField: config.versionField || 'version',
				timestampField: config.timestampField || 'updated_at',
			},
			archival: {
				enabled: config.archivalEnabled || false,
				retentionDays: config.retentionDays || 30,
				archiveLocation: config.archiveLocation,
			},
			indexing: {
				enabled: config.indexingEnabled !== false,
				indexes: config.indexes || [],
			},
			...config,
		};

		this.loadStats = {
			recordsLoaded: 0,
			recordsSkipped: 0,
			recordsUpserted: 0,
			recordsFailed: 0,
			batchesProcessed: 0,
			duplicatesFound: 0,
			indexesCreated: 0,
		};
	}

	/**
	 * Initialize the loader
	 */
	async initialize() {
		logger.info(`Initializing ${this.constructor.name}...`);

		// Initialize loader-specific components
		await this.initializeLoader();

		// Create indexes if specified
		if (this.config.indexing.enabled) {
			await this.createIndexes();
		}

		this.metrics.startTime = Date.now();
		logger.info(`${this.constructor.name} initialized successfully`);
	}

	/**
	 * Load data to destination
	 */
	async load(data) {
		try {
			this.metrics.startTime = Date.now();

			if (!data || (Array.isArray(data) && data.length === 0)) {
				logger.warn('No data provided to loader');
				return { success: true, recordsLoaded: 0 };
			}

			// Validate data if enabled
			if (this.config.validation.enabled) {
				await this.validateData(data);
			}

			// Process data
			const result = Array.isArray(data)
				? await this.loadBatch(data)
				: await this.loadRecord(data);

			this.metrics.endTime = Date.now();
			this.metrics.recordsProcessed = this.loadStats.recordsLoaded;

			logger.info(
				`Load completed: ${this.loadStats.recordsLoaded} records loaded successfully`
			);
			return result;
		} catch (error) {
			this.metrics.errors++;
			this.metrics.endTime = Date.now();
			logger.error(`Load failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Load a batch of records
	 */
	async loadBatch(batch) {
		const totalRecords = batch.length;
		logger.info(`Loading batch of ${totalRecords} records...`);

		// Split into chunks for processing
		const chunks = this.chunkArray(batch, this.config.batchSize);
		const results = [];

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];

			try {
				const chunkResult = await this.processChunk(chunk, i);
				results.push(chunkResult);
				this.loadStats.batchesProcessed++;

				// Log progress
				const progress = Math.round(((i + 1) / chunks.length) * 100);
				logger.info(
					`Batch progress: ${progress}% (${i + 1}/${chunks.length} chunks)`
				);
			} catch (error) {
				logger.error(`Error processing chunk ${i}:`, error);

				if (this.config.retry.enabled) {
					const retryResult = await this.retryChunk(chunk, i, error);
					results.push(retryResult);
				} else {
					throw error;
				}
			}
		}

		// Handle versioning
		if (this.config.versioning.enabled) {
			await this.updateVersioning(batch);
		}

		// Handle archival
		if (this.config.archival.enabled) {
			await this.archiveOldData();
		}

		return {
			success: true,
			recordsLoaded: this.loadStats.recordsLoaded,
			recordsSkipped: this.loadStats.recordsSkipped,
			recordsUpserted: this.loadStats.recordsUpserted,
			recordsFailed: this.loadStats.recordsFailed,
			batchesProcessed: this.loadStats.batchesProcessed,
			duplicatesFound: this.loadStats.duplicatesFound,
			chunks: results,
		};
	}

	/**
	 * Process a chunk of records
	 */
	async processChunk(chunk, chunkIndex) {
		const chunkResults = {
			chunkIndex,
			recordsProcessed: 0,
			recordsSuccessful: 0,
			recordsFailed: 0,
			errors: [],
		};

		// Detect duplicates within chunk
		const { uniqueRecords, duplicates } = this.detectDuplicates(chunk);
		this.loadStats.duplicatesFound += duplicates.length;

		if (duplicates.length > 0) {
			logger.info(
				`Found ${duplicates.length} duplicates in chunk ${chunkIndex}`
			);
		}

		// Process unique records
		const recordsToProcess = this.config.upsert
			? await this.prepareUpsertRecords(uniqueRecords)
			: uniqueRecords;

		// Load records based on loader type
		try {
			const result = await this.loadChunk(recordsToProcess);

			chunkResults.recordsProcessed = recordsToProcess.length;
			chunkResults.recordsSuccessful =
				result.successful || recordsToProcess.length;
			chunkResults.recordsFailed = result.failed || 0;

			this.loadStats.recordsLoaded += chunkResults.recordsSuccessful;
			this.loadStats.recordsFailed += chunkResults.recordsFailed;

			if (this.config.upsert) {
				this.loadStats.recordsUpserted += result.upserted || 0;
			}
		} catch (error) {
			chunkResults.recordsFailed = recordsToProcess.length;
			chunkResults.errors.push(error.message);
			this.loadStats.recordsFailed += chunkResults.recordsFailed;
			throw error;
		}

		return chunkResults;
	}

	/**
	 * Load a single record (must be implemented by subclasses)
	 */
	async loadRecord(record) {
		throw new Error('loadRecord() must be implemented by subclass');
	}

	/**
	 * Load a chunk of records (must be implemented by subclasses)
	 */
	async loadChunk(records) {
		throw new Error('loadChunk() must be implemented by subclass');
	}

	/**
	 * Detect duplicates in data
	 */
	detectDuplicates(records) {
		if (!this.config.primaryKey) {
			return { uniqueRecords: records, duplicates: [] };
		}

		const seen = new Set();
		const uniqueRecords = [];
		const duplicates = [];

		for (const record of records) {
			const key = this.getPrimaryKeyValue(record);

			if (seen.has(key)) {
				duplicates.push(record);
			} else {
				seen.add(key);
				uniqueRecords.push(record);
			}
		}

		return { uniqueRecords, duplicates };
	}

	/**
	 * Get primary key value from record
	 */
	getPrimaryKeyValue(record) {
		if (Array.isArray(this.config.primaryKey)) {
			return this.config.primaryKey.map((key) => record[key]).join('|');
		}
		return record[this.config.primaryKey];
	}

	/**
	 * Prepare records for upsert operation
	 */
	async prepareUpsertRecords(records) {
		// Check which records already exist
		const existingRecords = await this.checkExistingRecords(records);
		const existingKeys = new Set(
			existingRecords.map((record) => this.getPrimaryKeyValue(record))
		);

		return records.map((record) => {
			const key = this.getPrimaryKeyValue(record);
			const exists = existingKeys.has(key);

			return {
				...record,
				_operation: exists ? 'update' : 'insert',
				_exists: exists,
			};
		});
	}

	/**
	 * Check which records already exist (override in subclasses)
	 */
	async checkExistingRecords(records) {
		return [];
	}

	/**
	 * Retry chunk processing
	 */
	async retryChunk(chunk, chunkIndex, originalError) {
		let lastError = originalError;

		for (let attempt = 1; attempt <= this.config.retry.maxRetries; attempt++) {
			try {
				logger.info(
					`Retrying chunk ${chunkIndex}, attempt ${attempt}/${this.config.retry.maxRetries}`
				);

				// Apply backoff delay
				const delay = this.config.retry.backoffDelay * Math.pow(2, attempt - 1);
				await this.sleep(delay);

				return await this.processChunk(chunk, chunkIndex);
			} catch (error) {
				lastError = error;
				logger.error(
					`Retry attempt ${attempt} failed for chunk ${chunkIndex}:`,
					error
				);
			}
		}

		// All retries failed
		this.loadStats.recordsFailed += chunk.length;
		throw new Error(
			`Chunk ${chunkIndex} failed after ${this.config.retry.maxRetries} retries: ${lastError.message}`
		);
	}

	/**
	 * Validate data before loading
	 */
	async validateData(data) {
		if (!this.config.validation.schema) {
			return;
		}

		const Ajv = require('ajv');
		const ajv = new Ajv();
		const validate = ajv.compile(this.config.validation.schema);

		const sampleData = Array.isArray(data) ? data[0] : data;
		const valid = validate(sampleData);

		if (!valid) {
			const error = new Error(
				`Data validation failed: ${ajv.errorsText(validate.errors)}`
			);
			error.validationErrors = validate.errors;
			throw error;
		}
	}

	/**
	 * Create indexes
	 */
	async createIndexes() {
		logger.info('Creating indexes...');

		for (const indexConfig of this.config.indexing.indexes) {
			try {
				await this.createIndex(indexConfig);
				this.loadStats.indexesCreated++;
				logger.info(`Index created: ${indexConfig.name || 'unnamed'}`);
			} catch (error) {
				logger.error(`Failed to create index ${indexConfig.name}:`, error);
				if (indexConfig.required) {
					throw error;
				}
			}
		}
	}

	/**
	 * Create a single index (override in subclasses)
	 */
	async createIndex(indexConfig) {
		// Default implementation - override in subclasses
	}

	/**
	 * Update versioning information
	 */
	async updateVersioning(records) {
		if (!this.config.versioning.enabled) {
			return;
		}

		const versionField = this.config.versioning.versionField;
		const timestampField = this.config.versioning.timestampField;
		const timestamp = new Date();

		for (const record of records) {
			if (!record[versionField]) {
				record[versionField] = 1;
			} else {
				record[versionField] = parseInt(record[versionField]) + 1;
			}

			record[timestampField] = timestamp;
		}
	}

	/**
	 * Archive old data
	 */
	async archiveOldData() {
		if (!this.config.archival.enabled) {
			return;
		}

		const cutoffDate = new Date();
		cutoffDate.setDate(
			cutoffDate.getDate() - this.config.archival.retentionDays
		);

		logger.info(`Archiving data older than ${cutoffDate.toISOString()}`);

		try {
			const archivedCount = await this.performArchival(cutoffDate);
			logger.info(`Archived ${archivedCount} old records`);
		} catch (error) {
			logger.error('Archival failed:', error);
		}
	}

	/**
	 * Perform archival operation (override in subclasses)
	 */
	async performArchival(cutoffDate) {
		return 0; // Default implementation
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
	 * Sleep utility
	 */
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get load statistics
	 */
	getLoadStats() {
		return {
			...this.loadStats,
			loadRate:
				this.loadStats.recordsLoaded /
					((this.metrics.endTime - this.metrics.startTime) / 1000) || 0,
			successRate:
				this.loadStats.recordsLoaded /
					(this.loadStats.recordsLoaded + this.loadStats.recordsFailed) || 0,
			duplicateRate:
				this.loadStats.duplicatesFound /
					(this.loadStats.recordsLoaded + this.loadStats.duplicatesFound) || 0,
		};
	}

	/**
	 * Loader-specific initialization (override in subclasses)
	 */
	async initializeLoader() {
		// Default implementation - override in subclasses
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		await super.cleanup();

		// Loader-specific cleanup
		await this.cleanupLoader();
	}

	/**
	 * Loader-specific cleanup (override in subclasses)
	 */
	async cleanupLoader() {
		// Default implementation - override in subclasses
	}
}

module.exports = BaseLoader;
