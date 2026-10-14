const { createApp, startServer } = require('./lib/createApp');

const app = createApp();

startServer(app);

module.exports = app;
