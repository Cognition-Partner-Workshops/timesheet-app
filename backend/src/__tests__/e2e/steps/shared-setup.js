const request = require('supertest');
const express = require('express');
const { initializeDatabase, closeDatabase } = require('../../../database/init');
const authRoutes = require('../../../routes/auth');
const clientRoutes = require('../../../routes/clients');
const workEntryRoutes = require('../../../routes/workEntries');
const reportRoutes = require('../../../routes/reports');
const { errorHandler } = require('../../../middleware/errorHandler');

let app;

async function getApp() {
  if (!app) {
    app = express();
    app.use(express.json());
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
    await initializeDatabase();
  }
  return app;
}

async function teardown() {
  await closeDatabase();
  app = null;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

module.exports = { getApp, teardown, getNestedValue };
