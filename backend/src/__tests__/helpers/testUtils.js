const express = require('express');

/**
 * Creates a mock database object with standard methods.
 */
function createMockDb() {
  return {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
  };
}

/**
 * Creates an Express app with the given routes mounted at the specified path.
 * Includes JSON parsing and a standard error handler.
 */
function createTestApp(routePath, routes) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routes);
  app.use((err, req, res, next) => {
    if (err.isJoi) {
      return res.status(400).json({ error: 'Validation error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

/**
 * Helper to mock db.get for sequential calls.
 * @param {Array} responses - Array of [error, result] pairs
 */
function mockDbGetSequence(mockDb, responses) {
  let callIndex = 0;
  mockDb.get.mockImplementation((query, params, callback) => {
    const [err, result] = responses[callIndex] || [null, null];
    callIndex++;
    callback(err, result);
  });
}

/**
 * Helper to mock db.run with `this` context for changes count.
 */
function mockDbRunSuccess(mockDb, changes = 1) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call({ changes }, null);
  });
}

/**
 * Helper to mock db.run with error.
 */
function mockDbRunError(mockDb, errorMessage = 'Database error') {
  mockDb.run.mockImplementation(function(query, params, callback) {
    callback.call(this, new Error(errorMessage));
  });
}

module.exports = {
  createMockDb,
  createTestApp,
  mockDbGetSequence,
  mockDbRunSuccess,
  mockDbRunError
};
