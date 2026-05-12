import { request } from '@playwright/test';

async function globalSetup() {
  const req = await request.newContext({
    baseURL: 'http://localhost:3001',
  });
  await req.post('/api/test/reset');
  await req.dispose();
}

export default globalSetup;
