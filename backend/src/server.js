const { createApp, logger } = require('./lib/createApp');
const { initializeDatabase } = require('./database/init');

const app = createApp();
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'failed to start server');
    process.exit(1);
  }
}

startServer();

module.exports = app;
