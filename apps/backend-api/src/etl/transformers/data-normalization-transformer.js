/**
 * Data Normalization Transformer
 * Normalizes and standardizes data formats across different sources
 */

const BaseTransformer = require('./base-transformer');
const logger = require('../../utils/logger');
const moment = require('moment');
const lodash = require('lodash');

class DataNormalizationTransformer extends BaseTransformer {
	constructor(config = {}) {
		super(config);
		this.config = {
			...this.config,
			rules: {
				text: {
					trim: true,
					case: 'none', // Default to no case transformation
					removeExtraSpaces: true,
					...(config.rules?.text || {}),
				},
				dates: {
					format: 'YYYY-MM-DD',
					timezone: 'UTC',
					...(config.rules?.dates || {}),
				},
				numbers: {
					decimalPlaces: 2,
					removeCommas: true,
					...(config.rules?.numbers || {}),
				},
				phone: {
					format: 'international',
					defaultCountry: 'US',
					...(config.rules?.phone || {}),
				},
				email: {
					lowercase: true,
					trim: true,
					...(config.rules?.email || {}),
				},
			},
			normalizationRules: config.normalizationRules || {},
			fieldMappings: config.fieldMappings || {},
			dataTypes: config.dataTypes || {},
			dateFormats: config.dateFormats || {
				input: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'ISO_8601'],
				output: 'YYYY-MM-DD HH:mm:ss',
			},
			stringNormalization: {
				trimWhitespace: config.trimWhitespace !== false,
				toLowerCase: config.toLowerCase || false,
				removeSpecialChars: config.removeSpecialChars || false,
				normalizeUnicode: config.normalizeUnicode !== false,
			},
			numberNormalization: {
				decimalPlaces: config.decimalPlaces,
				removeCommas: config.removeCommas !== false,
				convertToNumber: config.convertToNumber !== false,
			},
			defaultValues: config.defaultValues || {},
			requiredFields: config.requiredFields || [],
			dropFields: config.dropFields || [],
			customTransformations: config.customTransformations || {},
		};

		this.normalizationCache = new Map();
	}

	/**
	 * Initialize normalization transformer
	 */
	async initializeTransformer() {
		logger.info('Initializing data normalization rules...');

		// Validate normalization rules
		this.validateNormalizationRules();

		// Compile custom transformation functions
		this.compileCustomTransformations();

		logger.info('Data normalization transformer initialized');
	}

	/**
	 * Transform a single record
	 */
	async doTransformRecord(record) {
		if (!record || typeof record !== 'object') {
			logger.warn('Invalid record provided for normalization');
			return null;
		}

		try {
			let normalizedRecord = { ...record };

			// Apply field mappings
			normalizedRecord = this.applyFieldMappings(normalizedRecord);

			// Normalize data types
			normalizedRecord = await this.normalizeDataTypes(normalizedRecord);

			// Normalize phone numbers (before general string normalization)
			normalizedRecord = this.normalizePhoneNumbers(normalizedRecord);

			// Apply string normalization
			normalizedRecord = this.normalizeStrings(normalizedRecord);

			// Apply number normalization
			normalizedRecord = this.normalizeNumbers(normalizedRecord);

			// Normalize dates
			normalizedRecord = this.normalizeDates(normalizedRecord);

			// Apply default values
			normalizedRecord = this.applyDefaultValues(normalizedRecord);

			// Validate required fields
			this.validateRequiredFields(normalizedRecord);

			// Drop unwanted fields
			normalizedRecord = this.dropUnwantedFields(normalizedRecord);

			// Apply custom transformations
			normalizedRecord = await this.applyCustomTransformations(
				normalizedRecord
			);

			// Apply normalization rules
			normalizedRecord = this.applyNormalizationRules(normalizedRecord);

			return normalizedRecord;
		} catch (error) {
			logger.error('Error normalizing record:', error);
			throw error;
		}
	}

	/**
	 * Apply field mappings
	 */
	applyFieldMappings(record) {
		if (Object.keys(this.config.fieldMappings).length === 0) {
			return record;
		}

		const mappedRecord = {};

		// Apply mappings
		for (const [oldField, newField] of Object.entries(
			this.config.fieldMappings
		)) {
			if (record.hasOwnProperty(oldField)) {
				const value = lodash.get(record, oldField);
				lodash.set(mappedRecord, newField, value);
			}
		}

		// Copy unmapped fields
		for (const [key, value] of Object.entries(record)) {
			if (!this.config.fieldMappings.hasOwnProperty(key)) {
				mappedRecord[key] = value;
			}
		}

		return mappedRecord;
	}

	/**
	 * Normalize data types
	 */
	async normalizeDataTypes(record) {
		const normalized = { ...record };

		// Check both config.dataTypes and config.rules.types
		const typeRules = {
			...this.config.dataTypes,
			...(this.config.rules?.types || {}),
		};

		for (const [field, targetType] of Object.entries(typeRules)) {
			if (normalized.hasOwnProperty(field)) {
				normalized[field] = await this.convertDataType(
					normalized[field],
					targetType,
					field
				);
			}
		}

		return normalized;
	}

	/**
	 * Convert data type
	 */
	async convertDataType(value, targetType, fieldName) {
		if (value === null || value === undefined) {
			return value;
		}

		try {
			switch (targetType.toLowerCase()) {
				case 'string':
					return String(value);

				case 'number':
				case 'float':
					const numValue = this.parseNumber(value);
					return isNaN(numValue) ? null : numValue;

				case 'integer':
				case 'int':
					const intValue = parseInt(this.parseNumber(value));
					return isNaN(intValue) ? null : intValue;

				case 'boolean':
				case 'bool':
					return this.parseBoolean(value);

				case 'date':
				case 'datetime':
					return this.parseDate(value);

				case 'array':
					if (Array.isArray(value)) {
						return value;
					}
					if (typeof value === 'string') {
						// Split on common delimiters
						return value
							.split(/[,;|]/)
							.map((item) => item.trim())
							.filter((item) => item.length > 0);
					}
					return [value];

				case 'object':
					return typeof value === 'object' ? value : { value };

				case 'json':
					return typeof value === 'string' ? JSON.parse(value) : value;

				default:
					logger.warn(
						`Unknown data type: ${targetType} for field: ${fieldName}`
					);
					return value;
			}
		} catch (error) {
			logger.error(`Error converting ${fieldName} to ${targetType}:`, error);
			return null;
		}
	}

	/**
	 * Parse number from various formats
	 */
	parseNumber(value) {
		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			// Remove commas and spaces
			let cleaned = value.replace(/[,\s]/g, '');

			// Handle percentage
			if (cleaned.endsWith('%')) {
				return parseFloat(cleaned.slice(0, -1)) / 100;
			}

			// Handle currency symbols
			cleaned = cleaned.replace(/[$€£¥₹]/g, '');

			return parseFloat(cleaned);
		}

		return NaN;
	}

	/**
	 * Parse boolean from various formats
	 */
	parseBoolean(value) {
		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'string') {
			const lower = value.toLowerCase().trim();
			return ['true', '1', 'yes', 'y', 'on', 'enabled'].includes(lower);
		}

		if (typeof value === 'number') {
			return value !== 0;
		}

		return Boolean(value);
	}

	/**
	 * Parse date from various formats
	 */
	parseDate(value) {
		if (!value) return null;

		if (value instanceof Date) {
			return value;
		}

		// Try different date formats
		for (const format of this.config.dateFormats.input) {
			let parsed;

			if (format === 'ISO_8601') {
				parsed = moment(value);
			} else {
				parsed = moment(value, format);
			}

			if (parsed.isValid()) {
				return parsed.toDate();
			}
		}

		// Try timestamp
		if (
			typeof value === 'number' ||
			(typeof value === 'string' && /^\d+$/.test(value))
		) {
			const timestamp = parseInt(value);

			// Check if it's in seconds or milliseconds
			const date =
				timestamp > 1000000000000
					? new Date(timestamp)
					: new Date(timestamp * 1000);

			if (!isNaN(date.getTime())) {
				return date;
			}
		}

		logger.warn(`Unable to parse date: ${value}`);
		return null;
	}

	/**
	 * Normalize strings
	 */
	normalizeStrings(record) {
		const normalized = {};

		for (const [key, value] of Object.entries(record)) {
			if (typeof value === 'string') {
				// Use the normalizeText method to apply rules.text configuration
				normalized[key] = this.normalizeText(value, this.config.rules.text);
			} else {
				normalized[key] = value;
			}
		}

		return normalized;
	}

	/**
	 * Normalize phone numbers
	 */
	normalizePhoneNumbers(record) {
		const normalized = { ...record };

		// Look for fields that might contain phone numbers
		for (const [key, value] of Object.entries(normalized)) {
			if (typeof value === 'string' && this.isPhoneField(key)) {
				normalized[key] = this.normalizePhone(value, this.config.rules.phone);
			}
		}

		return normalized;
	}

	/**
	 * Check if field name suggests it contains a phone number
	 */
	isPhoneField(fieldName) {
		const phoneFieldPatterns = [/phone/i, /tel/i, /mobile/i, /cell/i];

		return phoneFieldPatterns.some((pattern) => pattern.test(fieldName));
	}

	/**
	 * Normalize numbers
	 */
	normalizeNumbers(record) {
		const normalized = {};

		for (const [key, value] of Object.entries(record)) {
			if (typeof value === 'number') {
				let normalizedValue = value;

				if (this.config.numberNormalization.decimalPlaces !== undefined) {
					normalizedValue = parseFloat(
						normalizedValue.toFixed(
							this.config.numberNormalization.decimalPlaces
						)
					);
				}

				normalized[key] = normalizedValue;
			} else if (
				typeof value === 'string' &&
				this.config.numberNormalization.convertToNumber
			) {
				const numValue = this.parseNumber(value);
				normalized[key] = isNaN(numValue) ? value : numValue;
			} else {
				normalized[key] = value;
			}
		}

		return normalized;
	}

	/**
	 * Normalize dates
	 */
	normalizeDates(record) {
		const normalized = {};

		for (const [key, value] of Object.entries(record)) {
			if (value instanceof Date) {
				const formatted = moment(value).format(this.config.dateFormats.output);
				normalized[key] = formatted;
			} else {
				normalized[key] = value;
			}
		}

		return normalized;
	}

	/**
	 * Apply default values
	 */
	applyDefaultValues(record) {
		const withDefaults = { ...record };

		for (const [field, defaultValue] of Object.entries(
			this.config.defaultValues
		)) {
			if (
				!withDefaults.hasOwnProperty(field) ||
				withDefaults[field] === null ||
				withDefaults[field] === undefined ||
				withDefaults[field] === ''
			) {
				// Execute function if default value is a function
				withDefaults[field] =
					typeof defaultValue === 'function' ? defaultValue() : defaultValue;
			}
		}

		return withDefaults;
	}

	/**
	 * Validate required fields
	 */
	validateRequiredFields(record) {
		for (const field of this.config.requiredFields) {
			const value = this.getNestedValue(record, field);
			if (value === null || value === undefined || value === '') {
				throw new Error(`Missing required field: ${field}`);
			}
		}
	}

	/**
	 * Get nested value from object using dot notation
	 */
	getNestedValue(obj, path) {
		const keys = path.split('.');
		let current = obj;

		for (const key of keys) {
			if (
				current === null ||
				current === undefined ||
				!current.hasOwnProperty(key)
			) {
				return undefined;
			}
			current = current[key];
		}

		return current;
	}

	/**
	 * Drop unwanted fields
	 */
	dropUnwantedFields(record) {
		if (this.config.dropFields.length === 0) {
			return record;
		}

		const filtered = {};

		for (const [key, value] of Object.entries(record)) {
			if (!this.config.dropFields.includes(key)) {
				filtered[key] = value;
			}
		}

		return filtered;
	}

	/**
	 * Apply custom transformations
	 */
	async applyCustomTransformations(record) {
		let transformed = { ...record };

		for (const [field, transformation] of Object.entries(
			this.config.customTransformations
		)) {
			if (typeof transformation === 'function') {
				try {
					transformed[field] = await transformation(
						transformed[field],
						transformed
					);
				} catch (error) {
					logger.error(
						`Error applying custom transformation to ${field}:`,
						error
					);
					throw error;
				}
			}
		}

		return transformed;
	}

	/**
	 * Apply normalization rules
	 */
	applyNormalizationRules(record) {
		let normalized = { ...record };

		for (const [field, rules] of Object.entries(
			this.config.normalizationRules
		)) {
			if (normalized.hasOwnProperty(field)) {
				normalized[field] = this.applyFieldRules(normalized[field], rules);
			}
		}

		return normalized;
	}

	/**
	 * Apply rules to a specific field
	 */
	applyFieldRules(value, rules) {
		let processedValue = value;

		for (const rule of rules) {
			switch (rule.type) {
				case 'replace':
					if (typeof processedValue === 'string') {
						processedValue = processedValue.replace(
							new RegExp(rule.pattern, rule.flags || 'g'),
							rule.replacement || ''
						);
					}
					break;

				case 'map':
					if (rule.mapping && rule.mapping.hasOwnProperty(processedValue)) {
						processedValue = rule.mapping[processedValue];
					}
					break;

				case 'range':
					if (typeof processedValue === 'number') {
						processedValue = Math.max(
							rule.min || -Infinity,
							Math.min(rule.max || Infinity, processedValue)
						);
					}
					break;

				case 'format':
					if (rule.formatter && typeof rule.formatter === 'function') {
						processedValue = rule.formatter(processedValue);
					}
					break;
			}
		}

		return processedValue;
	}

	/**
	 * Validate normalization rules
	 */
	validateNormalizationRules() {
		// Validate that rules are properly formatted
		for (const [field, rules] of Object.entries(
			this.config.normalizationRules
		)) {
			if (!Array.isArray(rules)) {
				throw new Error(
					`Normalization rules for field '${field}' must be an array`
				);
			}

			for (const rule of rules) {
				if (!rule.type) {
					throw new Error(
						`Rule for field '${field}' is missing 'type' property`
					);
				}
			}
		}
	}

	/**
	 * Compile custom transformation functions
	 */
	compileCustomTransformations() {
		for (const [field, transformation] of Object.entries(
			this.config.customTransformations
		)) {
			if (typeof transformation === 'string') {
				try {
					// Create function from string (be careful with security)
					this.config.customTransformations[field] = new Function(
						'value',
						'record',
						transformation
					);
				} catch (error) {
					logger.error(
						`Failed to compile custom transformation for ${field}:`,
						error
					);
					delete this.config.customTransformations[field];
				}
			}
		}
	}

	/**
	 * Normalize text field
	 */
	normalizeText(value, rule = {}) {
		if (value === null) {
			return null;
		}
		if (value === undefined) {
			return undefined;
		}
		if (value === '') {
			return '';
		}

		let normalized = String(value);

		// Trim whitespace
		if (rule.trim !== false) {
			normalized = normalized.trim();
		}

		// Remove extra spaces
		if (rule.removeExtraSpaces) {
			normalized = normalized.replace(/\s+/g, ' ');
		}

		// Remove special characters
		if (rule.removeSpecialChars) {
			normalized = normalized.replace(/[^\w\s]/g, '');
		}

		// Custom text transformation
		if (rule.customTransform && typeof rule.customTransform === 'function') {
			normalized = rule.customTransform(normalized);
		}

		// Case transformation (after custom transforms)
		if (rule.case === 'upper') {
			normalized = normalized.toUpperCase();
		} else if (rule.case === 'lower') {
			normalized = normalized.toLowerCase();
		}

		return normalized;
	}

	/**
	 * Normalize date field
	 */
	normalizeDate(value, rule = {}) {
		if (value === null) {
			return null;
		}
		if (value === undefined) {
			return undefined;
		}

		const format = rule.format || 'YYYY-MM-DD';
		const parsed = this.parseDate(value);

		if (!parsed) {
			return null;
		}

		return moment(parsed).format(format);
	}

	/**
	 * Normalize number field
	 */
	normalizeNumber(value, rule = {}) {
		if (value === null) {
			return null;
		}
		if (value === undefined) {
			return undefined;
		}

		const parsed = this.parseNumber(value);

		if (isNaN(parsed)) {
			return NaN;
		}

		let normalized = parsed;

		// Apply decimal places
		if (typeof rule.decimalPlaces === 'number') {
			normalized = parseFloat(normalized.toFixed(rule.decimalPlaces));
		}

		return normalized;
	}

	/**
	 * Normalize phone number field
	 */
	normalizePhone(value, rule = {}) {
		if (value === null) {
			return null;
		}
		if (value === undefined) {
			return undefined;
		}
		if (value === '') {
			return '';
		}

		// Remove all non-digit characters
		const digits = String(value).replace(/\D/g, '');

		// Check minimum length
		if (digits.length < 10) {
			return null;
		}

		// Handle different formats
		if (rule.format === 'international') {
			// If already has + prefix, just clean digits
			if (String(value).startsWith('+')) {
				return '+' + digits;
			}

			// Handle UK numbers specifically when defaultCountry is UK
			if (rule.defaultCountry === 'UK') {
				// UK landline numbers starting with 0 (like 020...)
				if (digits.startsWith('0') && digits.length >= 10) {
					return '+44' + digits.substring(1); // Remove leading 0, add +44
				}
			}

			// Handle US numbers (10 digits)
			if (digits.length === 10) {
				return '+1' + digits;
			}

			// Default: add + prefix
			return '+' + digits;
		} else if (rule.format === 'national') {
			// Format as (XXX) XXX-XXXX for US numbers
			if (digits.length === 10) {
				return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
					6
				)}`;
			}
		}

		// Default: return cleaned digits
		return digits;
	}

	/**
	 * Normalize email field
	 */
	normalizeEmail(value, rule = {}) {
		if (value === null) {
			return null;
		}
		if (value === undefined) {
			return undefined;
		}
		if (value === '') {
			return '';
		}

		let normalized = String(value).trim().toLowerCase();

		// Basic email validation
		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(normalized)) {
			return null;
		}

		// Gmail-specific normalization
		if (rule.normalizeGmail && normalized.includes('@gmail.com')) {
			const [localPart, domain] = normalized.split('@');
			// Remove dots from local part and everything after +
			const cleanLocal = localPart.replace(/\./g, '').split('+')[0];
			normalized = `${cleanLocal}@${domain}`;
		}

		return normalized;
	}

	/**
	 * Get normalization statistics
	 */
	getNormalizationStats() {
		return {
			...this.getTransformationStats(),
			fieldMappingsApplied: Object.keys(this.config.fieldMappings).length,
			dataTypesNormalized: Object.keys(this.config.dataTypes).length,
			customTransformations: Object.keys(this.config.customTransformations)
				.length,
			normalizationRules: Object.keys(this.config.normalizationRules).length,
		};
	}
}

module.exports = DataNormalizationTransformer;
