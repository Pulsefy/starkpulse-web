module.exports = {
	rootDir: '.',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/src/**/*.test.js'],
	setupFilesAfterEnv: ['<rootDir>/tests/etl/setup.js'],
	coverageDirectory: '<rootDir>/coverage',
	collectCoverage: false, // Disable coverage collection to avoid TypeScript issues
	collectCoverageFrom: [
		'src/etl/**/*.js',
		'!src/etl/**/*.test.js',
		'!src/etl/**/index.js',
	],
	coverageReporters: ['text', 'lcov', 'html'],
	verbose: true,
	transform: {
		'^.+\\.jsx?$': 'babel-jest',
	},
	transformIgnorePatterns: ['node_modules/(?!(some-module-to-transform)/)'],
	moduleFileExtensions: ['js', 'json', 'jsx'],
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/tests/(?!etl/)',
	],
};
