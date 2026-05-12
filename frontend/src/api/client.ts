/**
 * @fileoverview Centralized API client for backend communication.
 *
 * Wraps Axios to provide typed methods for every backend endpoint. All requests
 * are routed through the Vite dev-server proxy (relative URLs) and automatically
 * include the authenticated user's email via the `x-user-email` header.
 *
 * @module api/client
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

/**
 * Base URL for API requests.
 * Empty string makes requests relative to the current origin so that the Vite
 * proxy configuration forwards `/api` calls to the Express backend.
 */
const API_BASE_URL = '';

/**
 * Singleton HTTP client that manages authentication headers, error interception,
 * and exposes convenience methods for every REST endpoint.
 */
class ApiClient {
  /** Underlying Axios instance configured with base URL, timeout, and headers. */
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach the stored user email to every outgoing request for passwordless auth.
    this.client.interceptors.request.use(
      (config) => {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
          config.headers['x-user-email'] = userEmail;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Globally handle 401 responses by clearing credentials and redirecting to login.
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('userEmail');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  /** Authenticate with the backend using email-only (passwordless) login. */
  async login(email: string) {
    const response = await this.client.post('/api/auth/login', { email });
    return response.data;
  }

  /** Retrieve the currently authenticated user's profile. */
  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Clients
  // ---------------------------------------------------------------------------

  /** Fetch all clients belonging to the authenticated user. */
  async getClients() {
    const response = await this.client.get('/api/clients');
    return response.data;
  }

  /** Fetch a single client by its numeric ID. */
  async getClient(id: number) {
    const response = await this.client.get(`/api/clients/${id}`);
    return response.data;
  }

  /** Create a new client record. */
  async createClient(clientData: { name: string; description?: string; department?: string; email?: string }) {
    const response = await this.client.post('/api/clients', clientData);
    return response.data;
  }

  /** Update an existing client by ID with partial data. */
  async updateClient(id: number, clientData: { name?: string; description?: string; department?: string; email?: string }) {
    const response = await this.client.put(`/api/clients/${id}`, clientData);
    return response.data;
  }

  /** Delete a single client by ID. Associated work entries are cascade-deleted. */
  async deleteClient(id: number) {
    const response = await this.client.delete(`/api/clients/${id}`);
    return response.data;
  }

  /** Delete every client (and their work entries) for the authenticated user. */
  async deleteAllClients() {
    const response = await this.client.delete('/api/clients');
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Work Entries
  // ---------------------------------------------------------------------------

  /**
   * Fetch work entries, optionally filtered by client.
   * @param clientId - When provided, only entries for this client are returned.
   */
  async getWorkEntries(clientId?: number) {
    const params = clientId ? { clientId } : {};
    const response = await this.client.get('/api/work-entries', { params });
    return response.data;
  }

  /** Fetch a single work entry by its numeric ID. */
  async getWorkEntry(id: number) {
    const response = await this.client.get(`/api/work-entries/${id}`);
    return response.data;
  }

  /** Create a new work entry (time log) for a given client. */
  async createWorkEntry(entryData: { clientId: number; hours: number; description?: string; date: string }) {
    const response = await this.client.post('/api/work-entries', entryData);
    return response.data;
  }

  /** Update an existing work entry by ID with partial data. */
  async updateWorkEntry(id: number, entryData: { clientId?: number; hours?: number; description?: string; date?: string }) {
    const response = await this.client.put(`/api/work-entries/${id}`, entryData);
    return response.data;
  }

  /** Delete a work entry by ID. */
  async deleteWorkEntry(id: number) {
    const response = await this.client.delete(`/api/work-entries/${id}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  /** Fetch an aggregated time report for a specific client. */
  async getClientReport(clientId: number) {
    const response = await this.client.get(`/api/reports/client/${clientId}`);
    return response.data;
  }

  /** Download a client report as a CSV blob. */
  async exportClientReportCsv(clientId: number) {
    const response = await this.client.get(`/api/reports/export/csv/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /** Download a client report as a PDF blob. */
  async exportClientReportPdf(clientId: number) {
    const response = await this.client.get(`/api/reports/export/pdf/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  /** Ping the backend health-check endpoint. */
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

/** Shared singleton instance used across the application. */
export const apiClient = new ApiClient();
export default apiClient;
