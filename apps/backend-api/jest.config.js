module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/index.js',
    '!src/**/config/*.js',
    '!src/**/database/*.js',
    '!src/**/middleware/*.js',
    '!src/**/routes/*.js',
    '!src/**/models/index.js',
    '!src/**/services/index.js',
    '!src/**/utils/index.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
