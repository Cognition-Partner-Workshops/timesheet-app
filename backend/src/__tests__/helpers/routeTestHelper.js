const express = require('express');

function createTestApp(routePath, routes) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routes);
  app.use((err, _req, res, _next) => {
    if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function mockDbCallback(mockFn, error, result) {
  mockFn.mockImplementationOnce((_q, _p, cb) => cb(error, result));
}

function mockDbSuccess(mockFn, result) { mockDbCallback(mockFn, null, result); }
function mockDbError(mockFn) { mockDbCallback(mockFn, new Error('Database error'), null); }

function mockRun(mockDb, { error = null, lastID = undefined } = {}) {
  mockDb.run.mockImplementation(function(_q, _p, cb) {
    if (lastID !== undefined) this.lastID = lastID;
    cb.call(this, error ? new Error(error) : null);
  });
}

module.exports = { createTestApp, createMockDb, mockDbSuccess, mockDbError, mockRun };
