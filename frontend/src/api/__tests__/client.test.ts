import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing the client
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

const mockRequestInterceptorUse = vi.fn();
const mockResponseInterceptorUse = vi.fn();

const mockAxiosInstance = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  interceptors: {
    request: { use: mockRequestInterceptorUse },
    response: { use: mockResponseInterceptorUse },
  },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

describe('ApiClient', () => {
  let requestInterceptorFulfilled: (config: Record<string, unknown>) => Record<string, unknown>;
  let requestInterceptorRejected: (error: unknown) => Promise<never>;
  let responseInterceptorFulfilled: (response: unknown) => unknown;
  let responseInterceptorRejected: (error: unknown) => Promise<never>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset modules to get a fresh ApiClient instance
    vi.resetModules();
  });

  async function loadClient() {
    const module = await import('../../api/client');

    // Capture interceptors registered during construction
    requestInterceptorFulfilled = mockRequestInterceptorUse.mock.calls[0][0];
    requestInterceptorRejected = mockRequestInterceptorUse.mock.calls[0][1];
    responseInterceptorFulfilled = mockResponseInterceptorUse.mock.calls[0][0];
    responseInterceptorRejected = mockResponseInterceptorUse.mock.calls[0][1];

    return module;
  }

  describe('request interceptor', () => {
    test('adds x-user-email header from localStorage', async () => {
      localStorage.setItem('userEmail', 'test@example.com');
      await loadClient();

      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptorFulfilled(config);

      expect((result.headers as Record<string, string>)['x-user-email']).toBe('test@example.com');
    });

    test('does not add x-user-email header when localStorage is empty', async () => {
      await loadClient();

      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptorFulfilled(config);

      expect((result.headers as Record<string, string>)['x-user-email']).toBeUndefined();
    });

    test('rejects on request error', async () => {
      await loadClient();

      const error = new Error('request error');
      await expect(requestInterceptorRejected(error)).rejects.toThrow('request error');
    });
  });

  describe('response interceptor', () => {
    test('passes through successful responses', async () => {
      await loadClient();

      const response = { status: 200, data: { ok: true } };
      const result = responseInterceptorFulfilled(response);

      expect(result).toBe(response);
    });

    test('redirects to /login and clears localStorage on 401', async () => {
      localStorage.setItem('userEmail', 'test@example.com');
      await loadClient();

      const originalLocation = window.location.href;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: originalLocation },
      });

      const error = { response: { status: 401 } };
      await expect(responseInterceptorRejected(error)).rejects.toBe(error);

      expect(localStorage.getItem('userEmail')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('does not redirect on non-401 errors', async () => {
      await loadClient();

      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '/' },
      });

      const error = { response: { status: 500 } };
      await expect(responseInterceptorRejected(error)).rejects.toBe(error);

      expect(window.location.href).toBe('/');
    });
  });

  describe('API methods', () => {
    test('login calls POST /api/auth/login with email', async () => {
      const { apiClient } = await loadClient();
      mockPost.mockResolvedValueOnce({ data: { user: { email: 'test@example.com', createdAt: '2024-01-01' } } });

      const result = await apiClient.login('test@example.com');

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', { email: 'test@example.com' });
      expect(result).toEqual({ user: { email: 'test@example.com', createdAt: '2024-01-01' } });
    });

    test('getCurrentUser calls GET /api/auth/me', async () => {
      const { apiClient } = await loadClient();
      mockGet.mockResolvedValueOnce({ data: { user: { email: 'test@example.com', createdAt: '2024-01-01' } } });

      const result = await apiClient.getCurrentUser();

      expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
      expect(result).toEqual({ user: { email: 'test@example.com', createdAt: '2024-01-01' } });
    });

    test('getClients calls GET /api/clients', async () => {
      const { apiClient } = await loadClient();
      mockGet.mockResolvedValueOnce({ data: { clients: [] } });

      const result = await apiClient.getClients();

      expect(mockGet).toHaveBeenCalledWith('/api/clients');
      expect(result).toEqual({ clients: [] });
    });
  });
});
