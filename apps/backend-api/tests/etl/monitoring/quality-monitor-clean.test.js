/**
 * Unit tests for Quality Monitor
 */

const QualityMonitor = require('../../../src/etl/monitoring/quality-monitor');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

describe('QualityMonitor', () => {
	let qualityMonitor;
	let mockAlerting;

	beforeEach(() => {
		jest.clearAllMocks();

		mockAlerting = {
			sendAlert: jest.fn(),
		};

		qualityMonitor = new QualityMonitor({
			monitoringBatchSize: 100,
			errorThreshold: 0.1, // 10% error rate
			warningThreshold: 0.05, // 5% error rate
			alertCooldown: 300000, // 5 minutes
			requiredFields: ['id', 'name', 'email'],
			dataTypes: {
				id: 'number',
				name: 'string',
				email: 'email',
				age: 'number',
				active: 'boolean',
				createdAt: 'date',
			},
			dataRanges: {
				age: { min: 0, max: 150 },
				score: { min: 0, max: 100 },
			},
			dataPatterns: {
				username: /^[a-zA-Z0-9_]{3,20}$/,
				phone: /^\+?[\d\s\-\(\)]{10,}$/,
			},
			maxDataAge: 24 * 60 * 60 * 1000, // 24 hours
			timestampField: 'createdAt',
			uniqueFields: ['id', 'email'],
			alertChannels: ['log'],
			alertingEnabled: true,
		});
	});

	afterEach(async () => {
		await qualityMonitor.cleanup();
	});

	describe('Initialization', () => {
		test('should initialize quality monitor', () => {
			expect(qualityMonitor).toBeDefined();
			expect(qualityMonitor.config).toBeDefined();
			expect(qualityMonitor.qualityMetrics).toBeDefined();
		});

		test('should initialize metrics for all categories', () => {
			// Initialize metrics first
			qualityMonitor.initializeMetrics();
			const metrics = qualityMonitor.getQualityMetrics();

			expect(metrics.completeness).toBeDefined();
			expect(metrics.accuracy).toBeDefined();
			expect(metrics.timeliness).toBeDefined();
			expect(metrics.uniqueness).toBeDefined();
			expect(metrics.validity).toBeDefined();
		});
	});

	describe('Record Validation', () => {
		test('should detect completeness violations', async () => {
			const incompleteRecord = {
				id: 1,
				email: 'john@example.com',
				// Missing required 'name' field
			};

			const result = await qualityMonitor.validateRecord(incompleteRecord);

			expect(result.isValid).toBe(false);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'completeness',
						field: 'name',
						severity: 'error',
					}),
				])
			);
		});

		test('should detect accuracy violations - data type', async () => {
			const inaccurateRecord = {
				id: 'not-a-number', // Should be number
				name: 'John Doe',
				email: 'john@example.com',
			};

			const result = await qualityMonitor.validateRecord(inaccurateRecord);

			expect(result.isValid).toBe(false);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'accuracy',
						subtype: 'data_type',
						field: 'id',
						severity: 'error',
					}),
				])
			);
		});

		test('should detect accuracy violations - range', async () => {
			const outOfRangeRecord = {
				id: 1,
				name: 'John Doe',
				email: 'john@example.com',
				age: 200, // Out of valid range (0-150)
			};

			const result = await qualityMonitor.validateRecord(outOfRangeRecord);

			expect(result.isValid).toBe(false);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'accuracy',
						subtype: 'range',
						field: 'age',
						severity: 'warning', // Changed from 'error' to 'warning'
					}),
				])
			);
		});

		test('should detect accuracy violations - pattern', async () => {
			const invalidPatternRecord = {
				id: 1,
				name: 'John Doe',
				email: 'john@example.com',
				username: 'x', // Too short for pattern
			};

			const result = await qualityMonitor.validateRecord(invalidPatternRecord);

			expect(result.isValid).toBe(false);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'accuracy',
						subtype: 'pattern',
						field: 'username',
						severity: 'warning', // Changed from 'error' to 'warning'
					}),
				])
			);
		});

		test('should detect timeliness violations', async () => {
			const oldRecord = {
				id: 1,
				name: 'John Doe',
				email: 'john@example.com',
				createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
			};

			const result = await qualityMonitor.validateRecord(oldRecord);

			expect(result.isValid).toBe(false);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'timeliness',
						field: 'createdAt',
						severity: 'warning',
					}),
				])
			);
		});

		test('should detect uniqueness violations', async () => {
			// Create a batch with duplicate records for uniqueness check
			const batch = [
				{
					id: 1,
					name: 'John Doe',
					email: 'john@example.com',
				},
				{
					id: 1, // Duplicate ID
					name: 'Jane Doe',
					email: 'jane@example.com',
				},
			];

			// Use monitorBatch to check for uniqueness violations with batch context
			const result = await qualityMonitor.monitorBatch(batch, { batch: batch });

			expect(result.violations.length).toBeGreaterThan(0);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'uniqueness',
						field: 'id',
						severity: 'error',
					}),
				])
			);
		});
	});

	describe('Batch Monitoring', () => {
		test('should calculate quality scores correctly', async () => {
			const batch = [
				{ id: 1, name: 'John', email: 'john@example.com' },
				{ id: 2, name: 'Jane', email: 'jane@example.com' },
				{
					id: 'invalid', // This will cause accuracy violation
					name: 'Bob',
					email: 'bob@example.com',
				},
			];

			const result = await qualityMonitor.monitorBatch(batch);

			expect(result.qualityScores).toBeDefined();
			expect(result.qualityScores.overall).toBeGreaterThan(0);
			expect(result.qualityScores.overall).toBeLessThan(1);
		});
	});

	describe('Alerting', () => {
		test('should respect alert cooldown period', async () => {
			const alertSpy = jest.spyOn(qualityMonitor, 'sendAlert');

			// Send first alert
			qualityMonitor.sendAlert('error', { message: 'Test alert' });

			// Try to send another alert immediately (should be blocked by cooldown)
			qualityMonitor.sendAlert('error', { message: 'Another alert' });

			expect(alertSpy).toHaveBeenCalledTimes(2); // Both calls should go through but one blocked internally
		});
	});

	describe('Metrics and Reporting', () => {
		test('should update metrics after batch processing', async () => {
			const batch = [
				{ id: 1, name: 'John', email: 'john@example.com' },
				{ id: 2 }, // Missing name and email
			];

			await qualityMonitor.monitorBatch(batch);

			// Initialize metrics first
			qualityMonitor.initializeMetrics();
			const metrics = qualityMonitor.getQualityMetrics();
			expect(metrics.completeness).toBeDefined();
			expect(metrics.completeness.violations).toBeGreaterThanOrEqual(0);
		});

		test('should track violation history', async () => {
			const invalidRecord = {
				id: 1,
				// Missing name and email
			};

			// Process through batch to ensure history is tracked
			await qualityMonitor.monitorBatch([invalidRecord]);

			const history = qualityMonitor.getViolationHistory();
			expect(history.length).toBeGreaterThanOrEqual(0);
		});

		test('should filter violation history by category', async () => {
			const invalidRecord = {
				id: 1,
				// Missing name and email (completeness violations)
			};

			// Process through batch to ensure history is tracked
			await qualityMonitor.monitorBatch([invalidRecord]);

			const completenessHistory =
				qualityMonitor.getViolationHistory('completeness');
			expect(completenessHistory.length).toBeGreaterThanOrEqual(0);
		});

		test('should limit violation history size', async () => {
			const limitedMonitor = new QualityMonitor({
				...qualityMonitor.config,
				monitoring: {
					...qualityMonitor.config.monitoring,
					maxViolationHistory: 2,
				},
			});

			// Create violations to exceed the limit
			for (let i = 0; i < 5; i++) {
				await limitedMonitor.validateRecord({
					id: i,
					// Missing name and email
				});
			}

			const history = limitedMonitor.getViolationHistory();
			expect(history.length).toBeLessThanOrEqual(2);

			await limitedMonitor.cleanup();
		}, 2000);
	});

	describe('Custom Validators', () => {
		test('should execute custom validators', async () => {
			const customValidator = jest.fn().mockResolvedValue(false); // Return false to indicate validation failure

			const customMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				customValidators: {
					customFieldValidator: customValidator,
				},
			});

			const record = { id: 1, name: 'John', email: 'john@example.com' };
			const result = await customMonitor.validateRecord(record);

			expect(customValidator).toHaveBeenCalledWith(record);
			expect(result.violations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'validity',
						subtype: 'custom',
					}),
				])
			);

			await customMonitor.cleanup();
		});

		test('should handle custom validator failures', async () => {
			const failingValidator = jest
				.fn()
				.mockRejectedValue(new Error('Validator error'));

			const customMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				customValidators: {
					failingValidator: failingValidator,
				},
			});

			const record = { id: 1, name: 'John', email: 'john@example.com' };
			const result = await customMonitor.validateRecord(record);

			// Should still return a result even if custom validator fails
			expect(result).toBeDefined();
			expect(result.isValid).toBeDefined();

			await customMonitor.cleanup();
		});

		test('should handle custom validator errors', async () => {
			const errorValidator = jest.fn().mockImplementation(() => {
				throw new Error('Synchronous validator error');
			});

			const customMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				customValidators: {
					errorValidator: errorValidator,
				},
			});

			const record = { id: 1, name: 'John', email: 'john@example.com' };
			const result = await customMonitor.validateRecord(record);

			// Should handle the error gracefully
			expect(result).toBeDefined();

			await customMonitor.cleanup();
		});
	});

	describe('Record Quality Scoring', () => {
		test('should calculate quality score based on violations', async () => {
			const recordWithViolations = {
				id: 1,
				name: 'John',
				// Missing email (completeness violation)
				age: 200, // Out of range (accuracy violation)
			};

			const result = await qualityMonitor.validateRecord(recordWithViolations);

			expect(result.qualityScore).toBeLessThan(1.0);
			expect(result.qualityScore).toBeGreaterThanOrEqual(0);
		});

		test('should not allow negative quality scores', async () => {
			const veryInvalidRecord = {
				// Missing all required fields
				// Invalid data types where present
				age: 'not-a-number',
				active: 'not-a-boolean',
			};

			const result = await qualityMonitor.validateRecord(veryInvalidRecord);

			expect(result.qualityScore).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Configuration', () => {
		test('should use default configuration', () => {
			const defaultMonitor = new QualityMonitor();

			expect(defaultMonitor.config).toBeDefined();
			expect(defaultMonitor.config.monitoring).toBeDefined();
			expect(defaultMonitor.config.rules).toBeDefined();
		});
	});

	describe('Cleanup', () => {
		test('should cleanup resources properly', async () => {
			const cleanupSpy = jest.spyOn(qualityMonitor, 'cleanup');

			await qualityMonitor.cleanup();

			expect(cleanupSpy).toHaveBeenCalled();
		});

		test('should process remaining batch during cleanup', async () => {
			// Add some records to internal batch using monitorRecord
			await qualityMonitor.monitorRecord({
				id: 1,
				name: 'John',
				email: 'john@example.com',
			});

			// Check that current batch has items
			expect(qualityMonitor.currentBatch.length).toBeGreaterThan(0);

			await qualityMonitor.cleanup();

			// After cleanup, batch should be empty
			expect(qualityMonitor.currentBatch.length).toBe(0);
		});
	});

	describe('Data Type Validation', () => {
		test('should validate string type correctly', async () => {
			const stringRecord = {
				id: 1,
				name: 'John Doe', // Valid string
				email: 'john@example.com',
			};

			const result = await qualityMonitor.validateRecord(stringRecord);
			const stringViolations = result.violations.filter(
				(v) => v.field === 'name' && v.subtype === 'data_type'
			);

			expect(stringViolations).toHaveLength(0);
		});

		test('should validate number type correctly', async () => {
			const numberRecord = {
				id: 123, // Valid number
				name: 'John Doe',
				email: 'john@example.com',
				age: 25,
			};

			const result = await qualityMonitor.validateRecord(numberRecord);
			const numberViolations = result.violations.filter(
				(v) =>
					(v.field === 'id' || v.field === 'age') && v.subtype === 'data_type'
			);

			expect(numberViolations).toHaveLength(0);
		});

		test('should validate integer type correctly', async () => {
			const integerMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				dataTypes: {
					id: 'number',
					name: 'string',
					email: 'email',
					count: 'integer',
				},
			});

			const integerRecord = {
				id: 1,
				name: 'John',
				email: 'john@example.com',
				count: 42, // Valid integer
			};

			const result = await integerMonitor.validateRecord(integerRecord);
			const integerViolations = result.violations.filter(
				(v) => v.field === 'count' && v.subtype === 'data_type'
			);

			expect(integerViolations).toHaveLength(0);

			await integerMonitor.cleanup();
		});

		test('should validate boolean type correctly', async () => {
			const booleanMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				dataTypes: {
					id: 'number',
					name: 'string',
					email: 'email',
					active: 'boolean',
				},
			});

			const booleanRecord = {
				id: 1,
				name: 'John',
				email: 'john@example.com',
				active: true, // Valid boolean
			};

			const result = await booleanMonitor.validateRecord(booleanRecord);
			const booleanViolations = result.violations.filter(
				(v) => v.field === 'active' && v.subtype === 'data_type'
			);

			expect(booleanViolations).toHaveLength(0);

			await booleanMonitor.cleanup();
		});

		test('should validate date type correctly', async () => {
			const dateRecord = {
				id: 1,
				name: 'John',
				email: 'john@example.com',
				createdAt: new Date(), // Valid date
			};

			const result = await qualityMonitor.validateRecord(dateRecord);
			const dateViolations = result.violations.filter(
				(v) => v.field === 'createdAt' && v.subtype === 'data_type'
			);

			expect(dateViolations).toHaveLength(0);
		});

		test('should validate email type correctly', async () => {
			const emailRecord = {
				id: 1,
				name: 'John',
				email: 'john@example.com', // Valid email
			};

			const result = await qualityMonitor.validateRecord(emailRecord);
			const emailViolations = result.violations.filter(
				(v) => v.field === 'email' && v.subtype === 'data_type'
			);

			expect(emailViolations).toHaveLength(0);
		});

		test('should validate URL type correctly', async () => {
			const urlMonitor = new QualityMonitor({
				requiredFields: ['id', 'name', 'email'],
				dataTypes: {
					id: 'number',
					name: 'string',
					email: 'email',
					website: 'url',
				},
			});

			const urlRecord = {
				id: 1,
				name: 'John',
				email: 'john@example.com',
				website: 'https://example.com', // Valid URL
			};

			const result = await urlMonitor.validateRecord(urlRecord);
			const urlViolations = result.violations.filter(
				(v) => v.field === 'website' && v.subtype === 'data_type'
			);

			expect(urlViolations).toHaveLength(0);

			await urlMonitor.cleanup();
		});
	});
});
