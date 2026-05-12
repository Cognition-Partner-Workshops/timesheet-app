// Minimal test server without rate limiting for Ruby E2E tests
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const clientRoutes = require('./src/routes/clients');
const workEntryRoutes = require('./src/routes/workEntries');
const reportRoutes = require('./src/routes/reports');
const { errorHandler } = require('./src/middleware/errorHandler');
const { initializeDatabase } = require('./src/database/init');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
});
