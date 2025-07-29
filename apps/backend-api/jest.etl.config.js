module.exports = {
	rootDir: '.',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/tests/etl/**/*.test.js'],
	coverageDirectory: '<rootDir>/coverage/etl',
	collectCoverage: false,
	verbose: true,
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
	forceExit: true,
	testTimeout: 30000,
};
