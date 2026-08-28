import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

// Use empty string to make requests relative to the current origin
// Vite proxy will forward /api requests to the backend
const API_BASE_URL = '';

export interface DateRangeParams {
  from?: string;
  to?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add email header
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

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear stored email on auth error
          localStorage.removeItem('userEmail');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string) {
    const response = await this.client.post('/api/auth/login', { email });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  // Client endpoints
  async getClients() {
    const response = await this.client.get('/api/clients');
    return response.data;
  }

  async getClient(id: number) {
    const response = await this.client.get(`/api/clients/${id}`);
    return response.data;
  }

  async createClient(clientData: { name: string; description?: string; department?: string; email?: string }) {
    const response = await this.client.post('/api/clients', clientData);
    return response.data;
  }

  async updateClient(id: number, clientData: { name?: string; description?: string; department?: string; email?: string }) {
    const response = await this.client.put(`/api/clients/${id}`, clientData);
    return response.data;
  }

  async deleteClient(id: number) {
    const response = await this.client.delete(`/api/clients/${id}`);
    return response.data;
  }

  async deleteAllClients() {
    const response = await this.client.delete('/api/clients');
    return response.data;
  }

  // Work entry endpoints
  async getWorkEntries(clientId?: number) {
    const params = clientId ? { clientId } : {};
    const response = await this.client.get('/api/work-entries', { params });
    return response.data;
  }

  async getWorkEntry(id: number) {
    const response = await this.client.get(`/api/work-entries/${id}`);
    return response.data;
  }

  async createWorkEntry(entryData: { clientId: number; hours: number; description?: string; date: string }) {
    const response = await this.client.post('/api/work-entries', entryData);
    return response.data;
  }

  async updateWorkEntry(id: number, entryData: { clientId?: number; hours?: number; description?: string; date?: string }) {
    const response = await this.client.put(`/api/work-entries/${id}`, entryData);
    return response.data;
  }

  async deleteWorkEntry(id: number) {
    const response = await this.client.delete(`/api/work-entries/${id}`);
    return response.data;
  }

  // Weekly summary endpoint
  async getWeeklySummary(weekStart: string) {
    const response = await this.client.get('/api/work-entries/weekly-summary', {
      params: { weekStart },
    });
    return response.data;
  }

  // Report endpoints
  async getClientReport(clientId: number, dateRange?: DateRangeParams) {
    const params: Record<string, string> = {};
    if (dateRange?.from) params.from = dateRange.from;
    if (dateRange?.to) params.to = dateRange.to;
    const response = await this.client.get(`/api/reports/client/${clientId}`, { params });
    return response.data;
  }

  async exportClientReportCsv(clientId: number, dateRange?: DateRangeParams) {
    const params: Record<string, string> = {};
    if (dateRange?.from) params.from = dateRange.from;
    if (dateRange?.to) params.to = dateRange.to;
    const response = await this.client.get(`/api/reports/export/csv/${clientId}`, {
      responseType: 'blob',
      params,
    });
    return response.data;
  }

  async exportClientReportPdf(clientId: number, dateRange?: DateRangeParams) {
    const params: Record<string, string> = {};
    if (dateRange?.from) params.from = dateRange.from;
    if (dateRange?.to) params.to = dateRange.to;
    const response = await this.client.get(`/api/reports/export/pdf/${clientId}`, {
      responseType: 'blob',
      params,
    });
    return response.data;
  }

  // Timesheet endpoints
  async getWeeklyTimesheet(weekStart: string) {
    const response = await this.client.get('/api/timesheets/weekly', {
      params: { weekStart },
    });
    return response.data;
  }

  async submitTimesheet(data: { weekStart: string; weekEnd: string; totalHours: number }) {
    const response = await this.client.post('/api/timesheets/submit', data);
    return response.data;
  }

  // Recurring template endpoints
  async getRecurringTemplates() {
    const response = await this.client.get('/api/recurring');
    return response.data;
  }

  async createRecurringTemplate(data: {
    clientId: number; hours: number; description?: string;
    frequency: string; daysOfWeek: number; startDate: string; endDate?: string | null;
  }) {
    const response = await this.client.post('/api/recurring', data);
    return response.data;
  }

  async updateRecurringTemplate(id: number, data: {
    clientId?: number; hours?: number; description?: string;
    frequency?: string; daysOfWeek?: number; startDate?: string; endDate?: string | null; active?: boolean;
  }) {
    const response = await this.client.put(`/api/recurring/${id}`, data);
    return response.data;
  }

  async deleteRecurringTemplate(id: number) {
    const response = await this.client.delete(`/api/recurring/${id}`);
    return response.data;
  }

  async generateRecurringEntries(id: number, from: string, to: string) {
    const response = await this.client.post(`/api/recurring/${id}/generate`, { from, to });
    return response.data;
  }

  async applyRecurringEntries(id: number, from: string, to: string) {
    const response = await this.client.post(`/api/recurring/${id}/apply`, { from, to });
    return response.data;
  }

  // Timer endpoints
  async getActiveTimer() {
    const response = await this.client.get('/api/timers/active');
    return response.data;
  }

  async startTimer(data: { clientId: number; description?: string }) {
    const response = await this.client.post('/api/timers/start', data);
    return response.data;
  }

  async stopTimer() {
    const response = await this.client.post('/api/timers/stop');
    return response.data;
  }

  async discardTimer() {
    const response = await this.client.delete('/api/timers/discard');
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
