const express = require('express');
const { getDatabase } = require('../../database/init');

function createTestApp(routePath, routeHandler) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routeHandler);
  app.use((err, req, res, _next) => {
    if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

function createMockDb() {
  const mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

module.exports = { createTestApp, createMockDb };
