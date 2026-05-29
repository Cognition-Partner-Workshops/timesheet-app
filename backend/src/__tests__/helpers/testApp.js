const express = require('express');

function createTestApp(path, router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  app.use((err, req, res, _next) => {
    if (err.isJoi) {
      return res.status(400).json({ error: 'Validation error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function createMockDb(getDatabase) {
  const mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

module.exports = { createTestApp, createMockDb };
