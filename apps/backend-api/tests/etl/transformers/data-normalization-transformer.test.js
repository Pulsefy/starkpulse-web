/**
 * Unit tests for Data Normalization Transformer
 */

const DataNormalizationTransformer = require('../../../src/etl/transformers/data-normalization-transformer');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

describe('DataNormalizationTransformer', () => {
	let transformer;

	beforeEach(() => {
		jest.clearAllMocks();

		transformer = new DataNormalizationTransformer({
			rules: {
				// Text normalization rules
				text: {
					trim: true,
					case: 'lower',
					removeExtraSpaces: true,
				},
				// Date normalization rules
				dates: {
					format: 'YYYY-MM-DD',
					timezone: 'UTC',
				},
				// Number normalization rules
				numbers: {
					decimalPlaces: 2,
					removeCommas: true,
				},
				// Phone number normalization
				phone: {
					format: 'international',
					defaultCountry: 'US',
				},
				// Email normalization
				email: {
					lowercase: true,
					trim: true,
				},
			},
			fieldMappings: {
				first_name: 'firstName',
				last_name: 'lastName',
				email_address: 'email',
				phone_number: 'phone',
			},
			requiredFields: ['id', 'email'],
			defaultValues: {
				status: 'active',
				createdAt: () => new Date(),
			},
		});
	});

	describe('Initialization', () => {
		test('should initialize transformer with default config', () => {
			const defaultTransformer = new DataNormalizationTransformer();

			expect(defaultTransformer.config).toBeDefined();
			expect(defaultTransformer.config.rules).toBeDefined();
			expect(defaultTransformer.config.fieldMappings).toEqual({});
		});

		test('should initialize transformer with custom config', () => {
			const customTransformer = new DataNormalizationTransformer({
				rules: {
					text: { case: 'upper' },
				},
			});

			expect(customTransformer.config.rules.text.case).toBe('upper');
		});
	});

	describe('Text Normalization', () => {
		test('should trim whitespace from text fields', () => {
			const input = { name: '  John Doe  ' };
			const result = transformer.normalizeText(
				input.name,
				transformer.config.rules.text
			);

			expect(result).toBe('john doe');
		});

		test('should convert text to lowercase', () => {
			const input = { name: 'JOHN DOE' };
			const result = transformer.normalizeText(
				input.name,
				transformer.config.rules.text
			);

			expect(result).toBe('john doe');
		});

		test('should convert text to uppercase', () => {
			const upperTransformer = new DataNormalizationTransformer({
				rules: { text: { case: 'upper' } },
			});

			const input = { name: 'john doe' };
			const result = upperTransformer.normalizeText(
				input.name,
				upperTransformer.config.rules.text
			);

			expect(result).toBe('JOHN DOE');
		});

		test('should remove extra spaces from text', () => {
			const input = { name: 'John    Doe   Smith' };
			const result = transformer.normalizeText(
				input.name,
				transformer.config.rules.text
			);

			expect(result).toBe('john doe smith');
		});

		test('should handle null and undefined text values', () => {
			expect(
				transformer.normalizeText(null, transformer.config.rules.text)
			).toBeNull();
			expect(
				transformer.normalizeText(undefined, transformer.config.rules.text)
			).toBeUndefined();
			expect(transformer.normalizeText('', transformer.config.rules.text)).toBe(
				''
			);
		});

		test('should apply custom text transformations', () => {
			const customTransformer = new DataNormalizationTransformer({
				rules: {
					text: {
						removeSpecialChars: true,
						customTransform: (text) => text.replace(/[0-9]/g, ''),
					},
				},
			});

			const input = 'John123!@#Doe';
			const result = customTransformer.normalizeText(
				input,
				customTransformer.config.rules.text
			);

			expect(result).toBe('JohnDoe');
		});
	});

	describe('Date Normalization', () => {
		test('should normalize date strings to standard format', () => {
			const dateRule = transformer.config.rules.dates;

			expect(transformer.normalizeDate('07/29/2023', dateRule)).toBe(
				'2023-07-29'
			);
			expect(transformer.normalizeDate('2023-07-29T10:30:00Z', dateRule)).toBe(
				'2023-07-29'
			);
			expect(transformer.normalizeDate('July 29, 2023', dateRule)).toBe(
				'2023-07-29'
			);
		});

		test('should handle Date objects', () => {
			const dateRule = transformer.config.rules.dates;
			const date = new Date('2023-07-29T10:30:00Z');

			expect(transformer.normalizeDate(date, dateRule)).toBe('2023-07-29');
		});

		test('should handle timestamps', () => {
			const dateRule = transformer.config.rules.dates;
			const timestamp = 1690632600000; // July 29, 2023

			expect(transformer.normalizeDate(timestamp, dateRule)).toBe('2023-07-29');
		});

		test('should handle invalid dates', () => {
			const dateRule = transformer.config.rules.dates;

			expect(transformer.normalizeDate('invalid-date', dateRule)).toBeNull();
			expect(transformer.normalizeDate(null, dateRule)).toBeNull();
			expect(transformer.normalizeDate(undefined, dateRule)).toBeUndefined();
		});
	});

	describe('Number Normalization', () => {
		test('should remove commas from numbers', () => {
			const numberRule = transformer.config.rules.numbers;

			expect(transformer.normalizeNumber('1,234.56', numberRule)).toBe(1234.56);
			expect(transformer.normalizeNumber('10,000,000', numberRule)).toBe(
				10000000.0
			);
		});

		test('should set decimal places', () => {
			const numberRule = transformer.config.rules.numbers;

			expect(transformer.normalizeNumber(123.456789, numberRule)).toBe(123.46);
			expect(transformer.normalizeNumber(100, numberRule)).toBe(100.0);
		});

		test('should handle string numbers', () => {
			const numberRule = transformer.config.rules.numbers;

			expect(transformer.normalizeNumber('123.456', numberRule)).toBe(123.46);
			expect(transformer.normalizeNumber('0.1', numberRule)).toBe(0.1);
		});

		test('should handle invalid numbers', () => {
			const numberRule = transformer.config.rules.numbers;

			expect(transformer.normalizeNumber('invalid', numberRule)).toBeNaN();
			expect(transformer.normalizeNumber(null, numberRule)).toBeNull();
			expect(
				transformer.normalizeNumber(undefined, numberRule)
			).toBeUndefined();
		});

		test('should handle negative numbers', () => {
			const numberRule = transformer.config.rules.numbers;

			expect(transformer.normalizeNumber(-123.456, numberRule)).toBe(-123.46);
			expect(transformer.normalizeNumber('-1,234.56', numberRule)).toBe(
				-1234.56
			);
		});
	});

	describe('Phone Number Normalization', () => {
		test('should normalize US phone numbers to international format', () => {
			const phoneRule = transformer.config.rules.phone;

			expect(transformer.normalizePhone('(555) 123-4567', phoneRule)).toBe(
				'+15551234567'
			);
			expect(transformer.normalizePhone('555-123-4567', phoneRule)).toBe(
				'+15551234567'
			);
			expect(transformer.normalizePhone('5551234567', phoneRule)).toBe(
				'+15551234567'
			);
		});

		test('should handle international phone numbers', () => {
			const phoneRule = {
				...transformer.config.rules.phone,
				defaultCountry: 'UK',
			};

			expect(transformer.normalizePhone('+44 20 7946 0958', phoneRule)).toBe(
				'+442079460958'
			);
			expect(transformer.normalizePhone('020 7946 0958', phoneRule)).toBe(
				'+442079460958'
			);
		});

		test('should handle invalid phone numbers', () => {
			const phoneRule = transformer.config.rules.phone;

			expect(transformer.normalizePhone('invalid', phoneRule)).toBeNull();
			expect(transformer.normalizePhone('123', phoneRule)).toBeNull();
			expect(transformer.normalizePhone(null, phoneRule)).toBeNull();
		});

		test('should format phone numbers in different formats', () => {
			const nationalFormatRule = {
				...transformer.config.rules.phone,
				format: 'national',
			};

			expect(transformer.normalizePhone('5551234567', nationalFormatRule)).toBe(
				'(555) 123-4567'
			);
		});
	});

	describe('Email Normalization', () => {
		test('should normalize email addresses', () => {
			const emailRule = transformer.config.rules.email;

			expect(
				transformer.normalizeEmail('  JOHN.DOE@EXAMPLE.COM  ', emailRule)
			).toBe('john.doe@example.com');
			expect(transformer.normalizeEmail('Jane@Test.org', emailRule)).toBe(
				'jane@test.org'
			);
		});

		test('should handle Gmail address normalization', () => {
			const gmailRule = {
				...transformer.config.rules.email,
				normalizeGmail: true,
			};

			expect(
				transformer.normalizeEmail('john.doe+test@gmail.com', gmailRule)
			).toBe('johndoe@gmail.com');
			expect(transformer.normalizeEmail('j.o.h.n@gmail.com', gmailRule)).toBe(
				'john@gmail.com'
			);
		});

		test('should validate email format', () => {
			const emailRule = { ...transformer.config.rules.email, validate: true };

			expect(transformer.normalizeEmail('valid@example.com', emailRule)).toBe(
				'valid@example.com'
			);
			expect(transformer.normalizeEmail('invalid-email', emailRule)).toBeNull();
		});

		test('should handle null and invalid emails', () => {
			const emailRule = transformer.config.rules.email;

			expect(transformer.normalizeEmail(null, emailRule)).toBeNull();
			expect(transformer.normalizeEmail(undefined, emailRule)).toBeUndefined();
			expect(transformer.normalizeEmail('', emailRule)).toBe('');
		});
	});

	describe('Required Fields Validation', () => {
		test('should throw error for missing required fields', async () => {
			const input = {
				id: 1,
				// Missing required 'email' field
			};

			await expect(transformer.transform(input)).rejects.toThrow(
				'Missing required field: email'
			);
		});

		test('should pass validation with all required fields present', async () => {
			const input = {
				id: 1,
				email: 'test@example.com',
			};

			const result = await transformer.transform(input);
			expect(result).toBeDefined();
		});

		test('should handle nested required fields', async () => {
			const nestedTransformer = new DataNormalizationTransformer({
				requiredFields: ['id', 'user.name', 'address.street'],
			});

			const input = {
				id: 1,
				user: { name: 'John' },
				// Missing address.street
			};

			await expect(nestedTransformer.transform(input)).rejects.toThrow(
				'Missing required field: address.street'
			);
		});
	});

	describe('Default Values', () => {
		test('should apply default values for missing fields', async () => {
			const input = {
				id: 1,
				email: 'test@example.com',
			};

			const result = await transformer.transform(input);

			expect(result.status).toBe('active');
			expect(result.createdAt).toBeInstanceOf(Date);
		});

		test('should not override existing values with defaults', async () => {
			const input = {
				id: 1,
				email: 'test@example.com',
				status: 'inactive',
			};

			const result = await transformer.transform(input);

			expect(result.status).toBe('inactive');
		});

		test('should handle function-based default values', async () => {
			const functionTransformer = new DataNormalizationTransformer({
				defaultValues: {
					timestamp: () => Date.now(),
					randomId: () => Math.random().toString(36).substr(2, 9),
				},
			});

			const input = { id: 1 };
			const result = await functionTransformer.transform(input);

			expect(result.timestamp).toBeGreaterThan(0);
			expect(result.randomId).toMatch(/^[a-z0-9]{9}$/);
		});
	});

	describe('Batch Transformation', () => {
		test('should transform batch of records', async () => {
			const batch = [
				{ id: 1, first_name: '  JOHN  ', email_address: 'JOHN@EXAMPLE.COM' },
				{ id: 2, first_name: 'jane', email_address: 'jane@test.org' },
				{ id: 3, first_name: 'Bob', email_address: 'bob@company.com' },
			];

			const results = await transformer.transformBatch(batch);

			expect(results).toHaveLength(3);
			expect(results[0].firstName).toBe('john');
			expect(results[0].email).toBe('john@example.com');
			expect(results[1].firstName).toBe('jane');
			expect(results[2].firstName).toBe('bob');
		});
	});

	describe('Error Handling', () => {
		test('should handle invalid configuration gracefully', () => {
			expect(() => {
				new DataNormalizationTransformer({
					rules: {
						invalid: 'not-an-object',
					},
				});
			}).not.toThrow();
		});
	});

	describe('Performance', () => {
		test('should handle large batches efficiently', async () => {
			const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				first_name: `User${i}`,
				email_address: `user${i}@example.com`,
			}));

			const startTime = Date.now();
			const results = await transformer.transformBatch(largeBatch);
			const endTime = Date.now();

			expect(results).toHaveLength(1000);
			expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
		});

		test('should support parallel processing for large batches', async () => {
			const parallelTransformer = new DataNormalizationTransformer({
				...transformer.config,
				parallel: true,
				batchSize: 100,
			});

			const largeBatch = Array.from({ length: 500 }, (_, i) => ({
				id: i + 1,
				first_name: `User${i}`,
				email_address: `user${i}@example.com`,
			}));

			const results = await parallelTransformer.transformBatch(largeBatch);

			expect(results).toHaveLength(500);
			expect(results.every((r) => r.firstName && r.email)).toBe(true);
		});
	});
});
