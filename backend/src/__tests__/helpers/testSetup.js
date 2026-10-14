const express = require('express');

function createMockDb() {
  return { all: jest.fn(), get: jest.fn(), run: jest.fn() };
}

function createTestApp(routePath, routeModule, opts = {}) {
  const app = express();
  app.use(express.json());

  if (opts.wrapDownload) {
    app.use((req, res, next) => {
      res.download = function(filePath, filename, callback) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send('file-content');
        if (typeof callback === 'function') callback(null);
      };
      next();
    });
  }

  app.use(routePath, routeModule);

  if (opts.errorHandler !== false) {
    app.use((err, req, res, next) => {
      if (err.isJoi) return res.status(400).json({ error: 'Validation error' });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  return app;
}

function setupMockDb(getDatabase) {
  const mockDb = createMockDb();
  getDatabase.mockReturnValue(mockDb);
  return mockDb;
}

module.exports = { createMockDb, createTestApp, setupMockDb };
