/**
 * ETL Test Setup and Configuration
 */

const path = require('path');

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
	// Set test environment
	process.env.NODE_ENV = 'test';

	// Set test database configuration
	process.env.TEST_DB_HOST = 'localhost';
	process.env.TEST_DB_PORT = '5432';
	process.env.TEST_DB_NAME = 'test_etl_db';
	process.env.TEST_DB_USER = 'test_user';
	process.env.TEST_DB_PASSWORD = 'test_password';

	// Set test Redis configuration
	process.env.TEST_REDIS_HOST = 'localhost';
	process.env.TEST_REDIS_PORT = '6379';
	process.env.TEST_REDIS_DB = '1';

	// Set test file paths
	process.env.TEST_OUTPUT_DIR = path.join(__dirname, '../tmp/test-output');
	process.env.TEST_TEMP_DIR = path.join(__dirname, '../tmp/test-temp');

	// Disable external API calls in test environment
	process.env.DISABLE_EXTERNAL_APIS = 'true';

	// Set logging level to reduce noise in tests
	process.env.LOG_LEVEL = 'error';
});

// Global test cleanup
afterAll(async () => {
	// Clean up test environment variables
	delete process.env.NODE_ENV;
	delete process.env.TEST_DB_HOST;
	delete process.env.TEST_DB_PORT;
	delete process.env.TEST_DB_NAME;
	delete process.env.TEST_DB_USER;
	delete process.env.TEST_DB_PASSWORD;
	delete process.env.TEST_REDIS_HOST;
	delete process.env.TEST_REDIS_PORT;
	delete process.env.TEST_REDIS_DB;
	delete process.env.TEST_OUTPUT_DIR;
	delete process.env.TEST_TEMP_DIR;
	delete process.env.DISABLE_EXTERNAL_APIS;
	delete process.env.LOG_LEVEL;
});

// Mock external dependencies that shouldn't be called during tests
// Note: Only mock modules that exist or are used in our tests

// Mock file system operations for consistent testing
jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	promises: {
		...jest.requireActual('fs').promises,
		writeFile: jest.fn(),
		readFile: jest.fn(),
		mkdir: jest.fn(),
		stat: jest.fn(),
		access: jest.fn(),
		unlink: jest.fn(),
		rmdir: jest.fn(),
	},
}));

// Utility functions for tests
global.testUtils = {
	// Generate sample data
	generateSampleRecords: (count = 10, type = 'user') => {
		return Array.from({ length: count }, (_, i) => {
			switch (type) {
				case 'user':
					return {
						id: i + 1,
						name: `User ${i + 1}`,
						email: `user${i + 1}@example.com`,
						age: 20 + (i % 50),
						createdAt: new Date(Date.now() - i * 86400000).toISOString(),
					};
				case 'transaction':
					return {
						id: i + 1,
						userId: Math.floor(Math.random() * 100) + 1,
						amount: parseFloat((Math.random() * 1000).toFixed(2)),
						type: ['credit', 'debit'][i % 2],
						timestamp: new Date(Date.now() - i * 3600000).toISOString(),
					};
				case 'product':
					return {
						id: i + 1,
						name: `Product ${i + 1}`,
						category: ['electronics', 'clothing', 'books'][i % 3],
						price: parseFloat((Math.random() * 100).toFixed(2)),
						inStock: Math.random() > 0.2,
					};
				default:
					return { id: i + 1, data: `Sample data ${i + 1}` };
			}
		});
	},

	// Create mock pipeline configuration
	createMockPipelineConfig: (overrides = {}) => ({
		id: 'test-pipeline',
		name: 'Test Pipeline',
		description: 'Pipeline for testing',
		enabled: true,
		schedule: '0 */6 * * *', // Every 6 hours
		timeout: 3600000, // 1 hour
		retries: 3,
		extractors: [
			{
				type: 'api',
				name: 'test-api-extractor',
				config: {
					url: 'https://api.test.com/data',
					method: 'GET',
					headers: { Authorization: 'Bearer test-token' },
				},
			},
		],
		transformers: [
			{
				type: 'normalization',
				name: 'test-normalizer',
				config: {
					fieldMappings: {
						user_id: 'userId',
						user_name: 'userName',
					},
					requiredFields: ['id', 'userId'],
				},
			},
		],
		loaders: [
			{
				type: 'database',
				name: 'test-db-loader',
				config: {
					connectionString: 'postgresql://test:test@localhost:5432/testdb',
					table: 'test_data',
					batchSize: 1000,
				},
			},
		],
		...overrides,
	}),

	// Create mock database connection
	createMockDbConnection: () => ({
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		begin: jest.fn().mockResolvedValue(undefined),
		commit: jest.fn().mockResolvedValue(undefined),
		rollback: jest.fn().mockResolvedValue(undefined),
		release: jest.fn().mockResolvedValue(undefined),
		end: jest.fn().mockResolvedValue(undefined),
	}),

	// Create mock Redis client
	createMockRedisClient: () => ({
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue('OK'),
		del: jest.fn().mockResolvedValue(1),
		exists: jest.fn().mockResolvedValue(0),
		expire: jest.fn().mockResolvedValue(1),
		hget: jest.fn().mockResolvedValue(null),
		hset: jest.fn().mockResolvedValue(1),
		hgetall: jest.fn().mockResolvedValue({}),
		lpush: jest.fn().mockResolvedValue(1),
		rpop: jest.fn().mockResolvedValue(null),
		llen: jest.fn().mockResolvedValue(0),
		quit: jest.fn().mockResolvedValue('OK'),
		disconnect: jest.fn().mockResolvedValue(undefined),
	}),

	// Wait for async operations
	wait: (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms)),

	// Create temporary directory for tests
	createTempDir: () => {
		const tempDir = path.join(
			__dirname,
			'../tmp',
			`test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		);
		return tempDir;
	},

	// Validate ETL result structure
	validateETLResult: (result) => {
		expect(result).toHaveProperty('success');
		expect(result).toHaveProperty('recordsProcessed');
		expect(result).toHaveProperty('errors');
		expect(result).toHaveProperty('duration');
		expect(result).toHaveProperty('timestamp');
		expect(typeof result.success).toBe('boolean');
		expect(typeof result.recordsProcessed).toBe('number');
		expect(Array.isArray(result.errors)).toBe(true);
		expect(typeof result.duration).toBe('number');
		expect(result.timestamp).toBeInstanceOf(Date);
	},

	// Create mock HTTP responses
	createMockHttpResponse: (data, status = 200, headers = {}) => ({
		status,
		statusText: status === 200 ? 'OK' : 'Error',
		headers: {
			'content-type': 'application/json',
			...headers,
		},
		data,
		config: {},
		request: {},
	}),

	// Assert error contains expected properties
	assertErrorStructure: (error, expectedType = 'ETLError') => {
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(expectedType);
		expect(error).toHaveProperty('message');
		expect(error).toHaveProperty('timestamp');
		expect(error).toHaveProperty('context');
	},

	// Mock pipeline context
	createMockPipelineContext: (overrides = {}) => ({
		pipelineId: 'test-pipeline',
		executionId: `exec-${Date.now()}`,
		startTime: new Date(),
		config: {},
		metrics: {
			recordsExtracted: 0,
			recordsTransformed: 0,
			recordsLoaded: 0,
			errors: 0,
		},
		state: new Map(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		},
		...overrides,
	}),
};

// Custom Jest matchers
expect.extend({
	toBeValidRecord(received) {
		const pass =
			received &&
			typeof received === 'object' &&
			received.hasOwnProperty('id') &&
			received.id != null;

		if (pass) {
			return {
				message: () =>
					`expected ${JSON.stringify(received)} not to be a valid record`,
				pass: true,
			};
		} else {
			return {
				message: () =>
					`expected ${JSON.stringify(
						received
					)} to be a valid record (must have non-null id)`,
				pass: false,
			};
		}
	},

	toHaveValidSchema(received, schema) {
		const requiredFields = schema.required || [];
		const properties = schema.properties || {};

		let pass = true;
		let failureMessage = '';

		// Check required fields
		for (const field of requiredFields) {
			if (!received.hasOwnProperty(field) || received[field] == null) {
				pass = false;
				failureMessage = `missing required field: ${field}`;
				break;
			}
		}

		// Check field types
		if (pass) {
			for (const [field, fieldSchema] of Object.entries(properties)) {
				if (received.hasOwnProperty(field) && received[field] != null) {
					const expectedType = fieldSchema.type;
					const actualType = typeof received[field];

					if (expectedType === 'number' && actualType !== 'number') {
						pass = false;
						failureMessage = `field ${field} should be ${expectedType}, got ${actualType}`;
						break;
					}
					if (expectedType === 'string' && actualType !== 'string') {
						pass = false;
						failureMessage = `field ${field} should be ${expectedType}, got ${actualType}`;
						break;
					}
					if (expectedType === 'boolean' && actualType !== 'boolean') {
						pass = false;
						failureMessage = `field ${field} should be ${expectedType}, got ${actualType}`;
						break;
					}
					if (expectedType === 'array' && !Array.isArray(received[field])) {
						pass = false;
						failureMessage = `field ${field} should be an array`;
						break;
					}
				}
			}
		}

		if (pass) {
			return {
				message: () => `expected record not to match schema`,
				pass: true,
			};
		} else {
			return {
				message: () => `expected record to match schema: ${failureMessage}`,
				pass: false,
			};
		}
	},
});

// Export test configuration
module.exports = {
	testEnvironment: 'node',
	setupFilesAfterEnv: [__filename],
	testMatch: ['**/tests/etl/**/*.test.js'],
	collectCoverageFrom: [
		'src/etl/**/*.js',
		'!src/etl/**/*.test.js',
		'!src/etl/**/index.js',
	],
	coverageDirectory: 'coverage/etl',
	coverageReporters: ['text', 'lcov', 'html'],
	verbose: true,
	forceExit: true,
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
};
