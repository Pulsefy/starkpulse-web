/**
 * Core ETL System Interfaces
 * Defines the contracts for extractors, transformers, and loaders
 */

/**
 * Base interface for all ETL components
 */
class ETLComponent {
	constructor(config = {}) {
		this.config = config;
		this.metrics = {
			recordsProcessed: 0,
			errors: 0,
			startTime: null,
			endTime: null,
		};
	}

	/**
	 * Initialize the component
	 */
	async initialize() {
		throw new Error('initialize() must be implemented by subclass');
	}

	/**
	 * Execute the component
	 */
	async execute(data) {
		throw new Error('execute() must be implemented by subclass');
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		// Default implementation - can be overridden
	}

	/**
	 * Get component metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			duration:
				this.metrics.endTime && this.metrics.startTime
					? this.metrics.endTime - this.metrics.startTime
					: null,
		};
	}

	/**
	 * Reset metrics
	 */
	resetMetrics() {
		this.metrics = {
			recordsProcessed: 0,
			errors: 0,
			startTime: null,
			endTime: null,
		};
	}
}

/**
 * Base interface for data extractors
 */
class DataExtractor extends ETLComponent {
	constructor(config) {
		super(config);
		this.sourceType = config.sourceType || 'unknown';
	}

	/**
	 * Extract data from source
	 * @returns {AsyncIterator|Array} - Data records
	 */
	async extract() {
		throw new Error('extract() must be implemented by subclass');
	}

	/**
	 * Validate source connection
	 */
	async validateSource() {
		throw new Error('validateSource() must be implemented by subclass');
	}
}

/**
 * Base interface for data transformers
 */
class DataTransformer extends ETLComponent {
	constructor(config) {
		super(config);
		this.transformationType = config.transformationType || 'unknown';
	}

	/**
	 * Transform data records
	 * @param {*} data - Input data
	 * @returns {*} - Transformed data
	 */
	async transform(data) {
		throw new Error('transform() must be implemented by subclass');
	}

	/**
	 * Validate transformation rules
	 */
	async validateRules() {
		throw new Error('validateRules() must be implemented by subclass');
	}
}

/**
 * Base interface for data loaders
 */
class DataLoader extends ETLComponent {
	constructor(config) {
		super(config);
		this.destinationType = config.destinationType || 'unknown';
	}

	/**
	 * Load data to destination
	 * @param {*} data - Data to load
	 * @returns {Object} - Load result
	 */
	async load(data) {
		throw new Error('load() must be implemented by subclass');
	}

	/**
	 * Validate destination
	 */
	async validateDestination() {
		throw new Error('validateDestination() must be implemented by subclass');
	}
}

/**
 * Pipeline execution context
 */
class PipelineContext {
	constructor(pipelineId, config = {}) {
		this.pipelineId = pipelineId;
		this.config = config;
		this.metadata = {};
		this.metrics = {
			startTime: new Date(),
			endTime: null,
			totalRecords: 0,
			successfulRecords: 0,
			failedRecords: 0,
			extractionTime: 0,
			transformationTime: 0,
			loadingTime: 0,
		};
		this.errors = [];
		this.warnings = [];
	}

	/**
	 * Add metadata to context
	 */
	setMetadata(key, value) {
		this.metadata[key] = value;
	}

	/**
	 * Get metadata from context
	 */
	getMetadata(key) {
		return this.metadata[key];
	}

	/**
	 * Add error to context
	 */
	addError(error, stage = 'unknown') {
		this.errors.push({
			stage,
			error: error.message || error,
			timestamp: new Date(),
			stack: error.stack,
		});
	}

	/**
	 * Add warning to context
	 */
	addWarning(warning, stage = 'unknown') {
		this.warnings.push({
			stage,
			warning,
			timestamp: new Date(),
		});
	}

	/**
	 * Complete the pipeline execution
	 */
	complete() {
		this.metrics.endTime = new Date();
		this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
	}

	/**
	 * Get execution summary
	 */
	getSummary() {
		return {
			pipelineId: this.pipelineId,
			config: this.config,
			metadata: this.metadata,
			metrics: this.metrics,
			errors: this.errors,
			warnings: this.warnings,
			status: this.errors.length > 0 ? 'failed' : 'success',
		};
	}
}

module.exports = {
	ETLComponent,
	DataExtractor,
	DataTransformer,
	DataLoader,
	PipelineContext,
};
