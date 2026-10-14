/**
 * Starts the Express app with a real in-memory SQLite database for integration testing.
 * Each test suite gets a fresh database.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

const BACKEND_SRC = path.resolve(__dirname, '../../backend/src');

const TEST_CORS_OPTIONS = { origin: 'http://localhost' };

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(BACKEND_SRC)) {
      delete require.cache[key];
    }
  });
}

function createTestApp() {
  clearModuleCache();

  const { initializeDatabase } = require(path.join(BACKEND_SRC, 'database/init'));
  const authRoutes = require(path.join(BACKEND_SRC, 'routes/auth'));
  const clientRoutes = require(path.join(BACKEND_SRC, 'routes/clients'));
  const workEntryRoutes = require(path.join(BACKEND_SRC, 'routes/workEntries'));
  const reportRoutes = require(path.join(BACKEND_SRC, 'routes/reports'));
  const { errorHandler } = require(path.join(BACKEND_SRC, 'middleware/errorHandler'));

  const app = express();

  app.use(cors(TEST_CORS_OPTIONS));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/work-entries', workEntryRoutes);
  app.use('/api/reports', reportRoutes);

  app.use(errorHandler);

  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return { app, initializeDatabase };
}

async function setupTestApp() {
  const { app, initializeDatabase } = createTestApp();
  await initializeDatabase();
  return app;
}

module.exports = { setupTestApp, clearModuleCache };
