const express = require('express');

function createTestApp(routePath, routes) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routes);
  app.use((err, req, res, next) => {
    const isValidationError = Boolean(err.isJoi);
    const status = isValidationError ? 400 : 500;
    return res.status(status).json({
      error: isValidationError ? 'Validation error' : 'Internal server error'
    });
  });
  return app;
}

function createMockDatabase() {
  return ['all', 'get', 'run'].reduce((database, method) => {
    database[method] = jest.fn();
    return database;
  }, {});
}

function mockDatabaseError(database, method) {
  database[method].mockImplementation((query, params, callback) => {
    callback(new Error('Database error'), null);
  });
}

async function expectErrorResponse(response, status, error) {
  await expect(response).resolves.toMatchObject({
    status,
    body: { error }
  });
}

module.exports = {
  createTestApp,
  createMockDatabase,
  mockDatabaseError,
  expectErrorResponse
};
