import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      },
      post: vi.fn().mockResolvedValue({ data: { user: { email: 'a@example.com' } } }),
      get: vi.fn().mockResolvedValue({ data: [{ id: 1 }] })
    }))
  }
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates an axios client with the API defaults and calls login', async () => {
    const { default: apiClient } = await import('./client');
    await expect(apiClient.login('a@example.com')).resolves.toEqual({
      user: { email: 'a@example.com' }
    });
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '', timeout: 10000 }));
  });

  it('requests clients through the API client', async () => {
    const { default: apiClient } = await import('./client');
    await expect(apiClient.getClients()).resolves.toEqual([{ id: 1 }]);
  });
});
