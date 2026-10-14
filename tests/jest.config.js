const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/tests/api/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 15000,
  verbose: true,
  modulePaths: [path.resolve(__dirname, '../backend/node_modules')],
};
