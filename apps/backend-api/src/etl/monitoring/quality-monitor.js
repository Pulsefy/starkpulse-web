/**
 * ETL Quality Monitor
 * Monitors data quality, validates data integrity, and tracks pipeline health
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class QualityMonitor extends EventEmitter {
	constructor(config = {}) {
		super();
		this.config = {
			// Quality rules configuration
			rules: {
				completeness: {
					enabled: config.completenessEnabled !== false,
					requiredFields: config.requiredFields || [],
					threshold: config.completenessThreshold || 0.95,
				},
				accuracy: {
					enabled: config.accuracyEnabled !== false,
					dataTypes: config.dataTypes || {},
					ranges: config.dataRanges || {},
					patterns: config.dataPatterns || {},
				},
				consistency: {
					enabled: config.consistencyEnabled !== false,
					crossFieldRules: config.crossFieldRules || [],
					referentialIntegrity: config.referentialIntegrity || {},
				},
				timeliness: {
					enabled: config.timelinessEnabled !== false,
					maxAge: config.maxDataAge || 24 * 60 * 60 * 1000, // 24 hours
					timestampField: config.timestampField || 'created_at',
				},
				uniqueness: {
					enabled: config.uniquenessEnabled !== false,
					uniqueFields: config.uniqueFields || [],
					duplicateThreshold: config.duplicateThreshold || 0.05,
				},
				validity: {
					enabled: config.validityEnabled !== false,
					schema: config.schema,
					customValidators: config.customValidators || {},
				},
			},

			// Monitoring configuration
			monitoring: {
				batchSize: config.monitoringBatchSize || 1000,
				samplingRate: config.samplingRate || 0.1, // 10% sampling
				alertThresholds: {
					error: config.errorThreshold || 0.05,
					warning: config.warningThreshold || 0.02,
				},
				historyRetention: config.historyRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
				reportingInterval: config.reportingInterval || 60 * 60 * 1000, // 1 hour
			},

			// Alerting configuration
			alerting: {
				enabled: config.alertingEnabled !== false,
				channels: config.alertChannels || ['log'],
				cooldownPeriod: config.alertCooldown || 5 * 60 * 1000, // 5 minutes
				escalationRules: config.escalationRules || [],
			},
		};

		this.qualityMetrics = new Map();
		this.violationHistory = [];
		this.alertCooldowns = new Map();
		this.currentBatch = [];
		this.sampleCount = 0;
		this.reportingTimer = null;
	}

	/**
	 * Initialize quality monitor
	 */
	async initialize() {
		// Start periodic reporting
		this.startPeriodicReporting();

		// Initialize quality metrics
		this.initializeMetrics();

		logger.info('Quality monitor initialized');
	}

	/**
	 * Initialize quality metrics
	 */
	initializeMetrics() {
		const categories = [
			'completeness',
			'accuracy',
			'consistency',
			'timeliness',
			'uniqueness',
			'validity',
		];

		for (const category of categories) {
			this.qualityMetrics.set(category, {
				totalRecords: 0,
				violations: 0,
				score: 1.0,
				lastUpdated: new Date(),
				details: new Map(),
			});
		}
	}

	/**
	 * Monitor record quality
	 */
	async monitorRecord(record, context = {}) {
		try {
			// Add to current batch
			this.currentBatch.push({ record, context, timestamp: new Date() });

			// Check if we should process the batch
			if (this.currentBatch.length >= this.config.monitoring.batchSize) {
				await this.processBatch();
			}

			// Sample individual records for immediate feedback
			if (this.shouldSampleRecord()) {
				return await this.validateRecord(record, context);
			}

			return { isValid: true, violations: [] };
		} catch (error) {
			logger.error('Error monitoring record quality:', error);
			return {
				isValid: false,
				violations: [{ type: 'system_error', message: error.message }],
			};
		}
	}

	/**
	 * Monitor batch quality
	 */
	async monitorBatch(records, context = {}) {
		const batchResults = {
			totalRecords: records.length,
			validRecords: 0,
			invalidRecords: 0,
			violations: [],
			qualityScores: {},
			startTime: new Date(),
		};

		try {
			// Process records in batch
			const validationPromises = records.map((record) =>
				this.validateRecord(record, context)
			);
			const validationResults = await Promise.all(validationPromises);

			// Aggregate results
			for (const result of validationResults) {
				if (result.isValid) {
					batchResults.validRecords++;
				} else {
					batchResults.invalidRecords++;
					batchResults.violations.push(...result.violations);
				}
			}

			// Calculate quality scores
			batchResults.qualityScores = await this.calculateBatchQualityScores(
				validationResults
			);

			// Update metrics
			await this.updateMetrics(batchResults);

			// Check for alerts
			await this.checkAlerts(batchResults);

			batchResults.processingTime =
				Date.now() - batchResults.startTime.getTime();

			return batchResults;
		} catch (error) {
			logger.error('Error monitoring batch quality:', error);
			throw error;
		}
	}

	/**
	 * Validate single record
	 */
	async validateRecord(record, context = {}) {
		const violations = [];
		let isValid = true;

		try {
			// Completeness checks
			if (this.config.rules.completeness.enabled) {
				const completenessViolations = await this.checkCompleteness(record);
				violations.push(...completenessViolations);
			}

			// Accuracy checks
			if (this.config.rules.accuracy.enabled) {
				const accuracyViolations = await this.checkAccuracy(record);
				violations.push(...accuracyViolations);
			}

			// Consistency checks
			if (this.config.rules.consistency.enabled) {
				const consistencyViolations = await this.checkConsistency(record);
				violations.push(...consistencyViolations);
			}

			// Timeliness checks
			if (this.config.rules.timeliness.enabled) {
				const timelinessViolations = await this.checkTimeliness(record);
				violations.push(...timelinessViolations);
			}

			// Uniqueness checks (requires context)
			if (this.config.rules.uniqueness.enabled && context.batch) {
				const uniquenessViolations = await this.checkUniqueness(
					record,
					context.batch
				);
				violations.push(...uniquenessViolations);
			}

			// Validity checks
			if (this.config.rules.validity.enabled) {
				const validityViolations = await this.checkValidity(record);
				violations.push(...validityViolations);
			}

			isValid = violations.length === 0;

			return {
				isValid,
				violations,
				qualityScore: this.calculateRecordQualityScore(violations),
				timestamp: new Date(),
			};
		} catch (error) {
			logger.error('Error validating record:', error);
			return {
				isValid: false,
				violations: [{ type: 'validation_error', message: error.message }],
				qualityScore: 0,
				timestamp: new Date(),
			};
		}
	}

	/**
	 * Check completeness
	 */
	async checkCompleteness(record) {
		const violations = [];
		const requiredFields = this.config.rules.completeness.requiredFields;

		for (const field of requiredFields) {
			if (
				record[field] === null ||
				record[field] === undefined ||
				record[field] === ''
			) {
				violations.push({
					type: 'completeness',
					field,
					message: `Required field '${field}' is missing or empty`,
					severity: 'error',
				});
			}
		}

		return violations;
	}

	/**
	 * Check accuracy
	 */
	async checkAccuracy(record) {
		const violations = [];
		const { dataTypes, ranges, patterns } = this.config.rules.accuracy;

		// Data type checks
		for (const [field, expectedType] of Object.entries(dataTypes)) {
			if (
				record[field] !== undefined &&
				!this.validateDataType(record[field], expectedType)
			) {
				violations.push({
					type: 'accuracy',
					subtype: 'data_type',
					field,
					message: `Field '${field}' has incorrect data type. Expected: ${expectedType}`,
					severity: 'error',
					actualValue: record[field],
					expectedType,
				});
			}
		}

		// Range checks
		for (const [field, range] of Object.entries(ranges)) {
			if (
				record[field] !== undefined &&
				!this.validateRange(record[field], range)
			) {
				violations.push({
					type: 'accuracy',
					subtype: 'range',
					field,
					message: `Field '${field}' is outside acceptable range`,
					severity: 'warning',
					actualValue: record[field],
					expectedRange: range,
				});
			}
		}

		// Pattern checks
		for (const [field, pattern] of Object.entries(patterns)) {
			if (
				record[field] !== undefined &&
				!this.validatePattern(record[field], pattern)
			) {
				violations.push({
					type: 'accuracy',
					subtype: 'pattern',
					field,
					message: `Field '${field}' does not match expected pattern`,
					severity: 'warning',
					actualValue: record[field],
					expectedPattern: pattern,
				});
			}
		}

		return violations;
	}

	/**
	 * Check consistency
	 */
	async checkConsistency(record) {
		const violations = [];
		const { crossFieldRules, referentialIntegrity } =
			this.config.rules.consistency;

		// Cross-field rules
		for (const rule of crossFieldRules) {
			try {
				const isValid = await this.evaluateRule(rule, record);
				if (!isValid) {
					violations.push({
						type: 'consistency',
						subtype: 'cross_field',
						message: rule.message || `Cross-field rule violation: ${rule.name}`,
						severity: rule.severity || 'warning',
						ruleName: rule.name,
						affectedFields: rule.fields,
					});
				}
			} catch (error) {
				logger.error(`Error evaluating consistency rule ${rule.name}:`, error);
			}
		}

		// Referential integrity checks
		for (const [field, reference] of Object.entries(referentialIntegrity)) {
			if (record[field] !== undefined) {
				const isValid = await this.checkReferentialIntegrity(
					record[field],
					reference
				);
				if (!isValid) {
					violations.push({
						type: 'consistency',
						subtype: 'referential_integrity',
						field,
						message: `Referential integrity violation for field '${field}'`,
						severity: 'error',
						actualValue: record[field],
						reference,
					});
				}
			}
		}

		return violations;
	}

	/**
	 * Check timeliness
	 */
	async checkTimeliness(record) {
		const violations = [];
		const { maxAge, timestampField } = this.config.rules.timeliness;

		if (record[timestampField]) {
			const recordTime = new Date(record[timestampField]);
			const ageMs = Date.now() - recordTime.getTime();

			if (ageMs > maxAge) {
				violations.push({
					type: 'timeliness',
					field: timestampField,
					message: `Record is too old. Age: ${Math.round(
						ageMs / (60 * 1000)
					)} minutes`,
					severity: 'warning',
					recordAge: ageMs,
					maxAge,
				});
			}
		}

		return violations;
	}

	/**
	 * Check uniqueness
	 */
	async checkUniqueness(record, batch) {
		const violations = [];
		const uniqueFields = this.config.rules.uniqueness.uniqueFields;

		for (const field of uniqueFields) {
			if (record[field] !== undefined) {
				const duplicateCount = batch.filter(
					(r) => r[field] === record[field]
				).length;

				if (duplicateCount > 1) {
					violations.push({
						type: 'uniqueness',
						field,
						message: `Duplicate value found for field '${field}'`,
						severity: 'error',
						duplicateValue: record[field],
						duplicateCount,
					});
				}
			}
		}

		return violations;
	}

	/**
	 * Check validity
	 */
	async checkValidity(record) {
		const violations = [];
		const { schema, customValidators } = this.config.rules.validity;

		// Schema validation
		if (schema) {
			const schemaViolations = await this.validateSchema(record, schema);
			violations.push(...schemaViolations);
		}

		// Custom validators
		for (const [validatorName, validator] of Object.entries(customValidators)) {
			try {
				const isValid = await validator(record);
				if (!isValid) {
					violations.push({
						type: 'validity',
						subtype: 'custom',
						message: `Custom validation failed: ${validatorName}`,
						severity: 'error',
						validatorName,
					});
				}
			} catch (error) {
				logger.error(`Error in custom validator ${validatorName}:`, error);
				violations.push({
					type: 'validity',
					subtype: 'custom_error',
					message: `Custom validator error: ${validatorName}`,
					severity: 'error',
					validatorName,
					error: error.message,
				});
			}
		}

		return violations;
	}

	/**
	 * Validate data type
	 */
	validateDataType(value, expectedType) {
		switch (expectedType.toLowerCase()) {
			case 'string':
				return typeof value === 'string';
			case 'number':
				return typeof value === 'number' && !isNaN(value);
			case 'integer':
				return Number.isInteger(value);
			case 'boolean':
				return typeof value === 'boolean';
			case 'date':
				return value instanceof Date || !isNaN(Date.parse(value));
			case 'email':
				return (
					typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
				);
			case 'url':
				try {
					new URL(value);
					return true;
				} catch {
					return false;
				}
			default:
				return true;
		}
	}

	/**
	 * Validate range
	 */
	validateRange(value, range) {
		if (typeof value !== 'number') {
			return true; // Skip range validation for non-numeric values
		}

		if (range.min !== undefined && value < range.min) {
			return false;
		}

		if (range.max !== undefined && value > range.max) {
			return false;
		}

		return true;
	}

	/**
	 * Validate pattern
	 */
	validatePattern(value, pattern) {
		if (typeof value !== 'string') {
			return true; // Skip pattern validation for non-string values
		}

		const regex = new RegExp(pattern);
		return regex.test(value);
	}

	/**
	 * Evaluate rule
	 */
	async evaluateRule(rule, record) {
		if (typeof rule.condition === 'function') {
			return await rule.condition(record);
		}

		// Simple expression evaluation (extend as needed)
		return true;
	}

	/**
	 * Check referential integrity
	 */
	async checkReferentialIntegrity(value, reference) {
		// Placeholder for referential integrity check
		// This would typically involve database lookups
		return true;
	}

	/**
	 * Validate schema
	 */
	async validateSchema(record, schema) {
		const violations = [];

		try {
			// Use JSON Schema validation or similar
			const Ajv = require('ajv');
			const ajv = new Ajv();
			const validate = ajv.compile(schema);
			const valid = validate(record);

			if (!valid) {
				for (const error of validate.errors) {
					violations.push({
						type: 'validity',
						subtype: 'schema',
						field: error.instancePath.replace('/', ''),
						message: `Schema validation error: ${error.message}`,
						severity: 'error',
						schemaPath: error.schemaPath,
						actualValue: error.data,
					});
				}
			}
		} catch (error) {
			logger.error('Schema validation error:', error);
			violations.push({
				type: 'validity',
				subtype: 'schema_error',
				message: `Schema validation failed: ${error.message}`,
				severity: 'error',
			});
		}

		return violations;
	}

	/**
	 * Calculate record quality score
	 */
	calculateRecordQualityScore(violations) {
		if (violations.length === 0) {
			return 1.0;
		}

		let errorCount = 0;
		let warningCount = 0;

		for (const violation of violations) {
			if (violation.severity === 'error') {
				errorCount++;
			} else {
				warningCount++;
			}
		}

		// Weighted scoring: errors have more impact than warnings
		const errorPenalty = errorCount * 0.3;
		const warningPenalty = warningCount * 0.1;
		const totalPenalty = errorPenalty + warningPenalty;

		return Math.max(0, 1.0 - totalPenalty);
	}

	/**
	 * Calculate batch quality scores
	 */
	async calculateBatchQualityScores(validationResults) {
		const scores = {};
		const categories = [
			'completeness',
			'accuracy',
			'consistency',
			'timeliness',
			'uniqueness',
			'validity',
		];

		for (const category of categories) {
			const categoryViolations = validationResults.reduce((total, result) => {
				return (
					total + result.violations.filter((v) => v.type === category).length
				);
			}, 0);

			const totalRecords = validationResults.length;
			const violationRate = categoryViolations / totalRecords;
			scores[category] = Math.max(0, 1.0 - violationRate);
		}

		// Overall score
		scores.overall =
			Object.values(scores).reduce((sum, score) => sum + score, 0) /
			categories.length;

		return scores;
	}

	/**
	 * Update metrics
	 */
	async updateMetrics(batchResults) {
		const timestamp = new Date();

		// Update overall metrics
		for (const [category, metrics] of this.qualityMetrics) {
			const categoryViolations = batchResults.violations.filter(
				(v) => v.type === category
			).length;

			metrics.totalRecords += batchResults.totalRecords;
			metrics.violations += categoryViolations;
			metrics.score = batchResults.qualityScores[category] || metrics.score;
			metrics.lastUpdated = timestamp;
		}

		// Store violation history
		if (batchResults.violations.length > 0) {
			this.violationHistory.push({
				timestamp,
				violations: batchResults.violations,
				batchSize: batchResults.totalRecords,
			});

			// Clean up old history
			const cutoffTime =
				timestamp.getTime() - this.config.monitoring.historyRetention;
			this.violationHistory = this.violationHistory.filter(
				(h) => h.timestamp.getTime() > cutoffTime
			);
		}

		// Emit metrics event
		this.emit('metrics_updated', {
			timestamp,
			qualityMetrics: Object.fromEntries(this.qualityMetrics),
			batchResults,
		});
	}

	/**
	 * Check alerts
	 */
	async checkAlerts(batchResults) {
		if (!this.config.alerting.enabled) {
			return;
		}

		const alertThresholds = this.config.monitoring.alertThresholds;
		const errorRate = batchResults.invalidRecords / batchResults.totalRecords;

		// Check error threshold
		if (errorRate >= alertThresholds.error) {
			await this.triggerAlert('error', {
				message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
				errorRate,
				threshold: alertThresholds.error,
				batchSize: batchResults.totalRecords,
				violations: batchResults.violations,
			});
		} else if (errorRate >= alertThresholds.warning) {
			await this.triggerAlert('warning', {
				message: `Elevated error rate detected: ${(errorRate * 100).toFixed(
					2
				)}%`,
				errorRate,
				threshold: alertThresholds.warning,
				batchSize: batchResults.totalRecords,
				violations: batchResults.violations,
			});
		}

		// Check quality score thresholds
		for (const [category, score] of Object.entries(
			batchResults.qualityScores
		)) {
			if (score < 0.8) {
				await this.triggerAlert('warning', {
					message: `Low quality score for ${category}: ${(score * 100).toFixed(
						2
					)}%`,
					category,
					score,
					threshold: 0.8,
				});
			}
		}
	}

	/**
	 * Trigger alert
	 */
	async triggerAlert(level, alertData) {
		const alertKey = `${level}_${alertData.category || 'general'}`;
		const now = Date.now();

		// Check cooldown period
		if (this.alertCooldowns.has(alertKey)) {
			const lastAlert = this.alertCooldowns.get(alertKey);
			if (now - lastAlert < this.config.alerting.cooldownPeriod) {
				return; // Skip alert due to cooldown
			}
		}

		// Update cooldown
		this.alertCooldowns.set(alertKey, now);

		const alert = {
			level,
			timestamp: new Date(),
			...alertData,
		};

		// Send alert through configured channels
		for (const channel of this.config.alerting.channels) {
			try {
				await this.sendAlert(channel, alert);
			} catch (error) {
				logger.error(`Failed to send alert through ${channel}:`, error);
			}
		}

		// Emit alert event
		this.emit('alert', alert);
	}

	/**
	 * Send alert through channel
	 */
	async sendAlert(channel, alert) {
		switch (channel) {
			case 'log':
				logger[alert.level](`Quality Alert: ${alert.message}`, alert);
				break;

			case 'email':
				// Implement email alerting
				break;

			case 'slack':
				// Implement Slack alerting
				break;

			case 'webhook':
				// Implement webhook alerting
				break;

			default:
				logger.warn(`Unknown alert channel: ${channel}`);
		}
	}

	/**
	 * Should sample record
	 */
	shouldSampleRecord() {
		this.sampleCount++;
		return (
			this.sampleCount % Math.floor(1 / this.config.monitoring.samplingRate) ===
			0
		);
	}

	/**
	 * Process batch
	 */
	async processBatch() {
		if (this.currentBatch.length === 0) {
			return;
		}

		const batch = [...this.currentBatch];
		this.currentBatch = [];

		try {
			const records = batch.map((item) => item.record);
			const batchResults = await this.monitorBatch(records, { batch: records });

			logger.debug(
				`Processed quality batch: ${batchResults.validRecords}/${batchResults.totalRecords} valid records`
			);
		} catch (error) {
			logger.error('Error processing quality batch:', error);
		}
	}

	/**
	 * Start periodic reporting
	 */
	startPeriodicReporting() {
		this.reportingTimer = setInterval(async () => {
			try {
				await this.generateQualityReport();
			} catch (error) {
				logger.error('Error generating quality report:', error);
			}
		}, this.config.monitoring.reportingInterval);
	}

	/**
	 * Stop periodic reporting
	 */
	stopPeriodicReporting() {
		if (this.reportingTimer) {
			clearInterval(this.reportingTimer);
			this.reportingTimer = null;
		}
	}

	/**
	 * Generate quality report
	 */
	async generateQualityReport() {
		const report = {
			timestamp: new Date(),
			period: this.config.monitoring.reportingInterval,
			qualityMetrics: Object.fromEntries(this.qualityMetrics),
			recentViolations: this.violationHistory.slice(-100), // Last 100 violations
			summary: {
				totalRecordsProcessed: Array.from(this.qualityMetrics.values()).reduce(
					(sum, m) => sum + m.totalRecords,
					0
				),
				totalViolations: Array.from(this.qualityMetrics.values()).reduce(
					(sum, m) => sum + m.violations,
					0
				),
				overallQualityScore:
					Array.from(this.qualityMetrics.values()).reduce(
						(sum, m) => sum + m.score,
						0
					) / this.qualityMetrics.size,
			},
		};

		// Emit report event
		this.emit('quality_report', report);

		logger.info('Quality report generated', {
			totalRecords: report.summary.totalRecordsProcessed,
			totalViolations: report.summary.totalViolations,
			qualityScore: report.summary.overallQualityScore.toFixed(3),
		});

		return report;
	}

	/**
	 * Get quality metrics
	 */
	getQualityMetrics() {
		return Object.fromEntries(this.qualityMetrics);
	}

	/**
	 * Get violation history
	 */
	getViolationHistory(category = null, limit = 100) {
		let history = this.violationHistory;

		if (category) {
			history = history.filter((h) =>
				h.violations.some((v) => v.type === category)
			);
		}

		return history.slice(-limit);
	}

	/**
	 * Reset metrics
	 */
	resetMetrics() {
		this.initializeMetrics();
		this.violationHistory = [];
		this.alertCooldowns.clear();

		logger.info('Quality metrics reset');
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		// Process any remaining batch
		if (this.currentBatch.length > 0) {
			await this.processBatch();
		}

		// Stop periodic reporting
		this.stopPeriodicReporting();

		// Generate final report
		const finalReport = await this.generateQualityReport();

		logger.info('Quality monitor cleanup completed');
		return finalReport;
	}
}

module.exports = QualityMonitor;
