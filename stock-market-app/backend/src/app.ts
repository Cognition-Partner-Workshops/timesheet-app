import express from 'express';
import { config } from './config';
import { connectRedis } from './config/redis';
import { startScheduler, runPipeline } from './jobs/pipeline';
import { migrate } from './migrations/run';
import { seed } from './migrations/seed';
import { logger } from './utils/logger';
import sectorRoutes from './routes/sectors';
import stockRoutes from './routes/stocks';
import searchRoutes from './routes/search';

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json());

// API routes — order matters: specific routes before parameterized ones
app.use('/api/sectors', sectorRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', stockRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', code: 500 });
});

async function start() {
  // Run database migrations and seed data
  logger.info('Running database migrations...');
  await migrate();
  logger.info('Seeding database...');
  await seed();

  // Connect to Redis (non-blocking — app works without it)
  await connectRedis();

  // Start server immediately so the UI can load seed data
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Mock data mode: ${config.useMockData}`);
  });

  // Run initial pipeline in the background (doesn't block the server)
  logger.info('Running initial data pipeline in background...');
  runPipeline().catch((err) => logger.error('Initial pipeline failed:', err));

  // Start scheduled pipeline
  startScheduler();
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
