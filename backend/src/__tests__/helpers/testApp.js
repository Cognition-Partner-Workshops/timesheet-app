const express = require('express');
const { getDatabase } = require('../../database/init');

function createTestApp(routePath, routeModule) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routeModule);
  app.use((err, req, res, next) => {
    if (err.isJoi) {
      return res.status(400).json({ error: 'Validation error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function createMockDb() {
  const mockDb = {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
  };
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

function mockDbAll(mockDb, result, err = null) {
  mockDb.all.mockImplementation((query, params, callback) => {
    callback(err, result);
  });
}

function mockDbGet(mockDb, result, err = null) {
  mockDb.get.mockImplementation((query, params, callback) => {
    callback(err, result);
  });
}

function mockDbRun(mockDb, err = null, lastID = null) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    if (lastID !== null) this.lastID = lastID;
    callback.call(this, err);
  });
}

function mockDbGetSequence(mockDb, results) {
  let callCount = 0;
  mockDb.get.mockImplementation((query, params, callback) => {
    const idx = Math.min(callCount, results.length - 1);
    const { data, err } = results[idx];
    callCount++;
    callback(err || null, data);
  });
}

module.exports = {
  createTestApp,
  createMockDb,
  mockDbAll,
  mockDbGet,
  mockDbRun,
  mockDbGetSequence
};
