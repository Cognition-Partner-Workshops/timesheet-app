// Test server for Ruby E2E tests — reuses shared-setup app factory
const { getApp } = require('./src/__tests__/e2e/steps/shared-setup');

const PORT = process.env.PORT || 3001;

getApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
});
