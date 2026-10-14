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

function mockDbGetOnce(mockDb, result, err = null) {
  mockDb.get.mockImplementationOnce((query, params, callback) => {
    callback(err, result);
  });
}

function mockDbRunWithLastID(mockDb, lastID, err = null) {
  mockDb.run.mockImplementation(function(query, params, callback) {
    this.lastID = lastID;
    callback.call(this, err);
  });
}

function mockDbRun(mockDb, err = null) {
  mockDb.run.mockImplementation((query, params, callback) => {
    callback(err);
  });
}

module.exports = {
  createTestApp,
  createMockDb,
  mockDbAll,
  mockDbGet,
  mockDbGetOnce,
  mockDbRunWithLastID,
  mockDbRun
};
