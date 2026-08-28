module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
      testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
      testPathIgnorePatterns: ['<rootDir>/src/__tests__/integration/'],
      verbose: true,
      testTimeout: 10000
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.js'],
      verbose: true,
      testTimeout: 15000
    }
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 60,
      statements: 60
    }
  }
};
