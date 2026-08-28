const express = require('express');

function createTestApp(path, routes) {
  const app = express();
  app.use(express.json());
  app.use(path, routes);
  app.use((err, req, res, next) => {
    if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function createMockDb(getDatabase) {
  const mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

const mockDbError = () => (query, params, callback) => callback(new Error('DB error'), null);
const mockDbResult = (result) => (query, params, callback) => callback(null, result);
const mockRunSuccess = (lastID = 1) => function(query, params, callback) {
  this.lastID = lastID;
  callback.call(this, null);
};

module.exports = { createTestApp, createMockDb, mockDbError, mockDbResult, mockRunSuccess };
