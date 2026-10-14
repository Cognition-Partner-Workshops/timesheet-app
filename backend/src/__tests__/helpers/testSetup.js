const express = require('express');
const { getDatabase } = require('../../database/init');

/**
 * Creates a mock database object with all common methods.
 */
function createMockDb() {
  return {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
  };
}

/**
 * Sets up the mock database for each test — call in beforeEach.
 * Returns the mock db object.
 */
function setupMockDb() {
  const mockDb = createMockDb();
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

/**
 * Creates an Express app wired to the given route module at the given path.
 * Includes JSON parsing and a standard Joi/generic error handler.
 * @param {string} routePath - e.g. '/api/clients'
 * @param {object} routeModule - the required route module
 * @param {object} [opts] - optional overrides
 * @param {function} [opts.downloadOverride] - intercepts res.download for CSV tests
 */
function createTestApp(routePath, routeModule, opts = {}) {
  const app = express();
  app.use(express.json());
  if (opts.downloadOverride) {
    app.use((req, res, next) => {
      res.download = function (filePath, filename, callback) {
        res.status(200).send('mock-file-content');
        if (callback) opts.downloadOverride(filePath, filename, callback);
      };
      next();
    });
  }
  app.use(routePath, routeModule);
  app.use((err, req, res, next) => {
    if (err.isJoi) {
      return res.status(400).json({ error: 'Validation error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

/**
 * Helper to mock a db.get call that returns a single row.
 */
function mockDbGet(mockDb, row, err = null) {
  mockDb.get.mockImplementation((query, params, callback) => {
    callback(err, row);
  });
}

/**
 * Helper to mock a db.all call that returns rows.
 */
function mockDbAll(mockDb, rows, err = null) {
  mockDb.all.mockImplementation((query, params, callback) => {
    callback(err, rows);
  });
}

/**
 * Helper to mock a db.run call.
 * @param {object} mockDb
 * @param {Error|null} err - error to return
 * @param {object} [context] - properties to set as `this` (e.g. { lastID: 1, changes: 3 })
 */
function mockDbRun(mockDb, err = null, context = {}) {
  mockDb.run.mockImplementation(function (query, params, callback) {
    Object.assign(this, context);
    if (typeof params === 'function') {
      params.call(this, err);
    } else if (typeof callback === 'function') {
      callback.call(this, err);
    }
  });
}

module.exports = {
  createMockDb,
  setupMockDb,
  createTestApp,
  mockDbGet,
  mockDbAll,
  mockDbRun
};
