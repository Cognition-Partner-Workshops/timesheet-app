const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../database/init');

/**
 * Creates a mock database object with standard jest.fn() methods.
 */
function createMockDb() {
  return {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
  };
}

/**
 * Creates an Express test app with the given route mounted at the specified path.
 * Includes JSON parsing and a standard error handler for Joi validation errors.
 *
 * @param {string} routePath - The route path prefix (e.g. '/api/clients')
 * @param {object} routeHandler - The Express router to mount
 * @returns {object} The configured Express app
 */
function createTestApp(routePath, routeHandler) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routeHandler);
  app.use((err, req, res, next) => {
    if (err.isJoi) {
      return res.status(400).json({ error: 'Validation error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

/**
 * Sets up a mock database and configures getDatabase to return it.
 * Call in beforeEach to get a fresh mock for each test.
 *
 * @returns {object} The mock database object
 */
function setupMockDb() {
  const mockDb = createMockDb();
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

/**
 * Mock implementation helper for db.run that sets this.changes.
 *
 * @param {number} changes - Number of affected rows
 * @returns {Function} A mock implementation function
 */
function mockRunWithChanges(changes) {
  return function(query, params, callback) {
    this.changes = changes;
    callback.call(this, null);
  };
}

/**
 * Mock implementation helper for db.run that sets this.lastID.
 *
 * @param {number} lastID - The last inserted row ID
 * @returns {Function} A mock implementation function
 */
function mockRunWithLastID(lastID) {
  return function(query, params, callback) {
    this.lastID = lastID;
    callback.call(this, null);
  };
}

/**
 * Mock implementation helper for a db callback that returns an error.
 *
 * @param {string} message - Error message
 * @returns {Function} A mock implementation function
 */
function mockDbError(message) {
  return (query, params, callback) => {
    callback(new Error(message));
  };
}

/**
 * Mock implementation helper for a db callback that returns a row.
 *
 * @param {object|null} row - The row to return
 * @returns {Function} A mock implementation function
 */
function mockDbRow(row) {
  return (query, params, callback) => {
    callback(null, row);
  };
}

/**
 * Mock implementation helper for a db callback that returns rows.
 *
 * @param {Array} rows - The rows to return
 * @returns {Function} A mock implementation function
 */
function mockDbRows(rows) {
  return (query, params, callback) => {
    callback(null, rows);
  };
}

module.exports = {
  request,
  createMockDb,
  createTestApp,
  setupMockDb,
  mockRunWithChanges,
  mockRunWithLastID,
  mockDbError,
  mockDbRow,
  mockDbRows
};
