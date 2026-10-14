/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'jest',
  mutate: [
    'src/**/*.js',
    '!src/__tests__/**',
    '!src/server.js',
    '!src/database/init.js',
  ],
  reporters: ['clear-text', 'html'],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  timeoutMS: 30000,
  concurrency: 2,
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
};

export default config;
