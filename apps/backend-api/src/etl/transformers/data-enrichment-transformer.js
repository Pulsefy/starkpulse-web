/**
 * Data Enrichment Transformer
 * Enriches data by adding computed fields, lookups, and aggregations
 */

const BaseTransformer = require('./base-transformer');
const logger = require('../../utils/logger');
const axios = require('axios');
const crypto = require('crypto');

class DataEnrichmentTransformer extends BaseTransformer {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			enrichmentSources: config.enrichmentSources || {},
			timeout: config.timeout || 10000,
			retries: config.retries || 3,
			enrichmentRules: config.enrichmentRules || [],
			lookupSources: config.lookupSources || {},
			computedFields: config.computedFields || {},
			apiEnrichment: config.apiEnrichment || {},
			aggregationRules: config.aggregationRules || {},
			geocoding: config.geocoding || {},
			textAnalysis: config.textAnalysis || {},
			dataCategories: config.dataCategories || {},
			qualityScoring: config.qualityScoring || {},
		};

		this.lookupCache = new Map();
		this.apiCache = new Map();
		this.enrichmentStats = {
			lookupsPerformed: 0,
			apiCallsMade: 0,
			fieldsComputed: 0,
			enrichmentErrors: 0,
		};
	}

	/**
	 * Initialize enrichment transformer
	 */
	async initializeTransformer() {
		logger.info('Initializing data enrichment transformer...');

		// Load lookup data sources
		await this.loadLookupSources();

		// Validate enrichment rules
		this.validateEnrichmentRules();

		// Initialize external API clients
		await this.initializeApiClients();

		logger.info('Data enrichment transformer initialized');
	}

	/**
	 * Transform a single record
	 */
	async doTransformRecord(record) {
		if (!record || typeof record !== 'object') {
			return null;
		}

		try {
			let enrichedRecord = { ...record };

			// Add computed fields
			enrichedRecord = await this.addComputedFields(enrichedRecord);

			// Perform lookups
			enrichedRecord = await this.performLookups(enrichedRecord);

			// API enrichment
			enrichedRecord = await this.performApiEnrichment(enrichedRecord);

			// Add aggregations
			enrichedRecord = await this.addAggregations(enrichedRecord);

			// Geocoding enrichment
			enrichedRecord = await this.performGeocoding(enrichedRecord);

			// Text analysis
			enrichedRecord = await this.performTextAnalysis(enrichedRecord);

			// Data categorization
			enrichedRecord = await this.categorizeData(enrichedRecord);

			// Quality scoring
			enrichedRecord = await this.addQualityScore(enrichedRecord);

			// Apply custom enrichment rules
			enrichedRecord = await this.applyEnrichmentRules(enrichedRecord);

			return enrichedRecord;
		} catch (error) {
			this.enrichmentStats.enrichmentErrors++;
			logger.error('Error enriching record:', error);
			throw error;
		}
	}

	/**
	 * Add computed fields
	 */
	async addComputedFields(record) {
		const enriched = { ...record };

		for (const [fieldName, computation] of Object.entries(
			this.config.computedFields
		)) {
			try {
				if (typeof computation === 'function') {
					enriched[fieldName] = await computation(record);
				} else if (typeof computation === 'object') {
					enriched[fieldName] = await this.performComputation(
						record,
						computation
					);
				}

				this.enrichmentStats.fieldsComputed++;
			} catch (error) {
				logger.error(`Error computing field ${fieldName}:`, error);
				if (computation.optional !== false) {
					enriched[fieldName] = null;
				}
			}
		}

		return enriched;
	}

	/**
	 * Perform computation based on configuration
	 */
	async performComputation(record, computation) {
		switch (computation.type) {
			case 'expression':
				return this.evaluateExpression(record, computation.expression);

			case 'concatenation':
				return this.concatenateFields(
					record,
					computation.fields,
					computation.separator
				);

			case 'date_diff':
				return this.calculateDateDifference(
					record,
					computation.startField,
					computation.endField,
					computation.unit
				);

			case 'hash':
				return this.generateHash(
					record,
					computation.fields,
					computation.algorithm
				);

			case 'lookup':
				return await this.performLookup(
					record,
					computation.source,
					computation.key
				);

			case 'mathematical':
				return this.performMathematicalOperation(record, computation);

			case 'conditional':
				return this.evaluateConditional(record, computation);

			default:
				throw new Error(`Unknown computation type: ${computation.type}`);
		}
	}

	/**
	 * Evaluate mathematical expression
	 */
	evaluateExpression(record, expression) {
		try {
			// Replace field references with values
			let processedExpression = expression;
			const fieldPattern = /\{([^}]+)\}/g;

			processedExpression = processedExpression.replace(
				fieldPattern,
				(match, fieldName) => {
					const value = this.getNestedValue(record, fieldName);
					return typeof value === 'number' ? value : 0;
				}
			);

			// Safely evaluate expression (consider using a proper expression parser in production)
			return Function(`"use strict"; return (${processedExpression})`)();
		} catch (error) {
			logger.error(`Error evaluating expression: ${expression}`, error);
			return null;
		}
	}

	/**
	 * Concatenate fields
	 */
	concatenateFields(record, fields, separator = ' ') {
		const values = fields
			.map((field) => {
				const value = this.getNestedValue(record, field);
				return value !== null && value !== undefined ? String(value) : '';
			})
			.filter((value) => value !== '');

		return values.join(separator);
	}

	/**
	 * Calculate date difference
	 */
	calculateDateDifference(record, startField, endField, unit = 'days') {
		const startValue = this.getNestedValue(record, startField);
		const endValue = this.getNestedValue(record, endField);

		if (!startValue || !endValue) return null;

		const startDate = new Date(startValue);
		const endDate = new Date(endValue);

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			return null;
		}

		const diffMs = endDate.getTime() - startDate.getTime();

		switch (unit.toLowerCase()) {
			case 'milliseconds':
				return diffMs;
			case 'seconds':
				return Math.floor(diffMs / 1000);
			case 'minutes':
				return Math.floor(diffMs / (1000 * 60));
			case 'hours':
				return Math.floor(diffMs / (1000 * 60 * 60));
			case 'days':
				return Math.floor(diffMs / (1000 * 60 * 60 * 24));
			case 'weeks':
				return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
			default:
				return Math.floor(diffMs / (1000 * 60 * 60 * 24));
		}
	}

	/**
	 * Generate hash from fields
	 */
	generateHash(record, fields, algorithm = 'md5') {
		const values = fields.map((field) => {
			const value = this.getNestedValue(record, field);
			return value !== null && value !== undefined ? String(value) : '';
		});

		const combined = values.join('|');
		return crypto.createHash(algorithm).update(combined).digest('hex');
	}

	/**
	 * Perform mathematical operation
	 */
	performMathematicalOperation(record, computation) {
		const { operation, fields } = computation;
		const values = fields.map((field) => {
			const value = this.getNestedValue(record, field);
			return typeof value === 'number' ? value : 0;
		});

		switch (operation) {
			case 'sum':
				return values.reduce((sum, val) => sum + val, 0);
			case 'average':
				return values.length > 0
					? values.reduce((sum, val) => sum + val, 0) / values.length
					: 0;
			case 'min':
				return Math.min(...values);
			case 'max':
				return Math.max(...values);
			case 'count':
				return values.filter((val) => val !== 0).length;
			case 'multiply':
				return values.reduce((product, val) => product * val, 1);
			case 'divide':
				return values.length === 2 && values[1] !== 0
					? values[0] / values[1]
					: 0;
			default:
				throw new Error(`Unknown mathematical operation: ${operation}`);
		}
	}

	/**
	 * Evaluate conditional computation
	 */
	evaluateConditional(record, computation) {
		const { condition, trueValue, falseValue } = computation;

		const conditionResult = this.evaluateCondition(record, condition);

		if (conditionResult) {
			return typeof trueValue === 'object'
				? this.performComputation(record, trueValue)
				: this.getValueOrLiteral(record, trueValue);
		} else {
			return typeof falseValue === 'object'
				? this.performComputation(record, falseValue)
				: this.getValueOrLiteral(record, falseValue);
		}
	}

	/**
	 * Evaluate condition
	 */
	evaluateCondition(record, condition) {
		const { field, operator, value } = condition;
		const fieldValue = this.getNestedValue(record, field);

		switch (operator) {
			case 'equals':
				return fieldValue === value;
			case 'not_equals':
				return fieldValue !== value;
			case 'greater_than':
				return fieldValue > value;
			case 'less_than':
				return fieldValue < value;
			case 'greater_equal':
				return fieldValue >= value;
			case 'less_equal':
				return fieldValue <= value;
			case 'contains':
				return String(fieldValue).includes(String(value));
			case 'starts_with':
				return String(fieldValue).startsWith(String(value));
			case 'ends_with':
				return String(fieldValue).endsWith(String(value));
			case 'regex':
				return new RegExp(value).test(String(fieldValue));
			case 'is_null':
				return fieldValue === null || fieldValue === undefined;
			case 'is_not_null':
				return fieldValue !== null && fieldValue !== undefined;
			default:
				return false;
		}
	}

	/**
	 * Perform lookups
	 */
	async performLookups(record) {
		const enriched = { ...record };

		for (const [fieldName, lookupConfig] of Object.entries(
			this.config.lookupSources
		)) {
			try {
				const lookupValue = await this.performLookup(
					record,
					lookupConfig.source,
					lookupConfig.key
				);
				if (lookupValue !== null) {
					enriched[fieldName] = lookupValue;
					this.enrichmentStats.lookupsPerformed++;
				}
			} catch (error) {
				logger.error(`Error performing lookup for field ${fieldName}:`, error);
				if (!lookupConfig.optional) {
					throw error;
				}
			}
		}

		return enriched;
	}

	/**
	 * Perform single lookup
	 */
	async performLookup(record, source, keyField) {
		const keyValue = this.getNestedValue(record, keyField);
		if (!keyValue) return null;

		const cacheKey = `${source}:${keyValue}`;

		// Check cache first
		if (this.lookupCache.has(cacheKey)) {
			return this.lookupCache.get(cacheKey);
		}

		// Perform lookup based on source type
		let result = null;

		if (typeof source === 'object' && source.type === 'database') {
			result = await this.performDatabaseLookup(source, keyValue);
		} else if (typeof source === 'object' && source.type === 'api') {
			result = await this.performApiLookup(source, keyValue);
		} else if (typeof source === 'object') {
			// Static lookup table
			result = source.data ? source.data[keyValue] : null;
		}

		// Cache result
		if (result !== null) {
			this.lookupCache.set(cacheKey, result);
		}

		return result;
	}

	/**
	 * Perform API enrichment
	 */
	async performApiEnrichment(record) {
		const enriched = { ...record };

		for (const [fieldName, apiConfig] of Object.entries(
			this.config.apiEnrichment
		)) {
			try {
				const apiResult = await this.callEnrichmentApi(record, apiConfig);
				if (apiResult !== null) {
					enriched[fieldName] = apiResult;
					this.enrichmentStats.apiCallsMade++;
				}
			} catch (error) {
				logger.error(`Error calling API for field ${fieldName}:`, error);
				if (!apiConfig.optional) {
					throw error;
				}
			}
		}

		return enriched;
	}

	/**
	 * Call enrichment API
	 */
	async callEnrichmentApi(record, apiConfig) {
		const {
			url,
			method = 'GET',
			headers = {},
			params = {},
			body = {},
		} = apiConfig;

		// Build request parameters
		const requestParams = this.buildApiParams(record, params);
		const requestBody = this.buildApiParams(record, body);
		const requestUrl = this.buildApiUrl(record, url);

		const cacheKey = `api:${requestUrl}:${JSON.stringify(requestParams)}`;

		// Check cache
		if (this.apiCache.has(cacheKey)) {
			return this.apiCache.get(cacheKey);
		}

		try {
			const response = await axios({
				method,
				url: requestUrl,
				params: requestParams,
				data: requestBody,
				headers,
				timeout: apiConfig.timeout || 10000,
			});

			let result = response.data;

			// Extract specific field from response if specified
			if (apiConfig.extractField) {
				result = this.getNestedValue(result, apiConfig.extractField);
			}

			// Apply response transformation if specified
			if (apiConfig.transform && typeof apiConfig.transform === 'function') {
				result = apiConfig.transform(result, record);
			}

			// Cache result
			this.apiCache.set(cacheKey, result);

			return result;
		} catch (error) {
			logger.error(`API enrichment failed for ${requestUrl}:`, error.message);
			return null;
		}
	}

	/**
	 * Build API parameters from record
	 */
	buildApiParams(record, paramsTemplate) {
		const params = {};

		for (const [key, value] of Object.entries(paramsTemplate)) {
			if (
				typeof value === 'string' &&
				value.startsWith('{') &&
				value.endsWith('}')
			) {
				const fieldName = value.slice(1, -1);
				params[key] = this.getNestedValue(record, fieldName);
			} else {
				params[key] = value;
			}
		}

		return params;
	}

	/**
	 * Build API URL with field substitutions
	 */
	buildApiUrl(record, urlTemplate) {
		return urlTemplate.replace(/\{([^}]+)\}/g, (match, fieldName) => {
			const value = this.getNestedValue(record, fieldName);
			return encodeURIComponent(value || '');
		});
	}

	/**
	 * Perform geocoding enrichment
	 */
	async performGeocoding(record) {
		if (!this.config.geocoding.enabled) {
			return record;
		}

		const enriched = { ...record };
		const addressField = this.config.geocoding.addressField;
		const address = this.getNestedValue(record, addressField);

		if (!address) return enriched;

		try {
			const geoData = await this.geocodeAddress(address);
			if (geoData) {
				enriched[this.config.geocoding.outputField || 'geo_data'] = geoData;
			}
		} catch (error) {
			logger.error('Geocoding failed:', error);
		}

		return enriched;
	}

	/**
	 * Geocode address
	 */
	async geocodeAddress(address) {
		// This is a placeholder - integrate with actual geocoding service
		// Example: Google Maps API, OpenStreetMap Nominatim, etc.
		return {
			latitude: null,
			longitude: null,
			formatted_address: address,
			geocoded: false,
		};
	}

	/**
	 * Perform text analysis
	 */
	async performTextAnalysis(record) {
		if (!this.config.textAnalysis.enabled) {
			return record;
		}

		const enriched = { ...record };
		const textField = this.config.textAnalysis.textField;
		const text = this.getNestedValue(record, textField);

		if (!text || typeof text !== 'string') return enriched;

		try {
			const analysis = this.analyzeText(text);
			enriched[this.config.textAnalysis.outputField || 'text_analysis'] =
				analysis;
		} catch (error) {
			logger.error('Text analysis failed:', error);
		}

		return enriched;
	}

	/**
	 * Analyze text content
	 */
	analyzeText(text) {
		return {
			word_count: text.split(/\s+/).length,
			character_count: text.length,
			sentence_count: text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
				.length,
			avg_word_length:
				text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) /
				text.split(/\s+/).length,
			readability_score: this.calculateReadabilityScore(text),
			sentiment: this.performSentimentAnalysis(text),
			keywords: this.extractKeywords(text),
		};
	}

	/**
	 * Calculate readability score (simplified)
	 */
	calculateReadabilityScore(text) {
		const words = text.split(/\s+/).length;
		const sentences = text
			.split(/[.!?]+/)
			.filter((s) => s.trim().length > 0).length;
		const syllables = this.countSyllables(text);

		// Flesch Reading Ease Score (simplified)
		return Math.max(
			0,
			Math.min(
				100,
				206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
			)
		);
	}

	/**
	 * Count syllables in text (simplified)
	 */
	countSyllables(text) {
		return text
			.toLowerCase()
			.split(/\s+/)
			.reduce((total, word) => {
				return total + Math.max(1, word.match(/[aeiouy]+/g)?.length || 1);
			}, 0);
	}

	/**
	 * Perform sentiment analysis (simplified)
	 */
	performSentimentAnalysis(text) {
		// This is a very basic implementation - use proper NLP libraries in production
		const positiveWords = [
			'good',
			'great',
			'excellent',
			'amazing',
			'wonderful',
			'fantastic',
		];
		const negativeWords = [
			'bad',
			'terrible',
			'awful',
			'horrible',
			'worst',
			'hate',
		];

		const words = text.toLowerCase().split(/\s+/);
		const positiveCount = words.filter((word) =>
			positiveWords.includes(word)
		).length;
		const negativeCount = words.filter((word) =>
			negativeWords.includes(word)
		).length;

		const score = (positiveCount - negativeCount) / words.length;

		return {
			score,
			sentiment:
				score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
			confidence: Math.abs(score),
		};
	}

	/**
	 * Extract keywords (simplified)
	 */
	extractKeywords(text, limit = 10) {
		const stopWords = [
			'the',
			'a',
			'an',
			'and',
			'or',
			'but',
			'in',
			'on',
			'at',
			'to',
			'for',
			'of',
			'with',
			'by',
		];
		const words = text.toLowerCase().match(/\b\w+\b/g) || [];

		const wordFreq = {};
		words.forEach((word) => {
			if (word.length > 3 && !stopWords.includes(word)) {
				wordFreq[word] = (wordFreq[word] || 0) + 1;
			}
		});

		return Object.entries(wordFreq)
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([word, count]) => ({ word, count }));
	}

	/**
	 * Load lookup sources
	 */
	async loadLookupSources() {
		// Implementation depends on source types
		logger.info('Loading lookup sources...');
	}

	/**
	 * Validate enrichment rules
	 */
	validateEnrichmentRules() {
		// Validate rule configurations
		logger.info('Validating enrichment rules...');
	}

	/**
	 * Initialize API clients
	 */
	async initializeApiClients() {
		// Initialize external API clients
		logger.info('Initializing API clients...');
	}

	/**
	 * Get nested value from object
	 */
	getNestedValue(obj, path) {
		return path.split('.').reduce((current, key) => {
			return current && current[key] !== undefined ? current[key] : null;
		}, obj);
	}

	/**
	 * Get value or literal
	 */
	getValueOrLiteral(record, value) {
		if (
			typeof value === 'string' &&
			value.startsWith('{') &&
			value.endsWith('}')
		) {
			const fieldName = value.slice(1, -1);
			return this.getNestedValue(record, fieldName);
		}
		return value;
	}

	/**
	 * Apply enrichment rules
	 */
	async applyEnrichmentRules(record) {
		// Apply custom enrichment rules
		return record;
	}

	/**
	 * Add aggregations
	 */
	async addAggregations(record) {
		// Add aggregated data
		return record;
	}

	/**
	 * Categorize data
	 */
	async categorizeData(record) {
		// Add data categories
		return record;
	}

	/**
	 * Add quality score
	 */
	async addQualityScore(record) {
		// Add data quality score
		return record;
	}

	/**
	 * Get enrichment statistics
	 */
	getEnrichmentStats() {
		return {
			...this.getTransformationStats(),
			...this.enrichmentStats,
			lookupCacheSize: this.lookupCache.size,
			apiCacheSize: this.apiCache.size,
		};
	}
}

module.exports = DataEnrichmentTransformer;
