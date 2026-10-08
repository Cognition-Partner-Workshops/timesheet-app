import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type {
  CreateClientRequest,
  UpdateClientRequest,
  UpdateBillingProfileRequest,
  InvoiceInput,
  InvoiceListFilters,
  InvoiceListResponse,
  InvoicePreview,
  Invoice,
  BillingProfile,
} from '../types/api';

// Use empty string to make requests relative to the current origin
// Vite proxy will forward /api requests to the backend
const API_BASE_URL = '';

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

  async createClient(clientData: CreateClientRequest) {
    const response = await this.client.post('/api/clients', clientData);
    return response.data;
  }

  async updateClient(id: number, clientData: UpdateClientRequest) {
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

  // Report endpoints
  async getClientReport(clientId: number) {
    const response = await this.client.get(`/api/reports/client/${clientId}`);
    return response.data;
  }

  async exportClientReportCsv(clientId: number) {
    const response = await this.client.get(`/api/reports/export/csv/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async exportClientReportPdf(clientId: number) {
    const response = await this.client.get(`/api/reports/export/pdf/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Billing profile endpoints
  async getBillingProfile(): Promise<{ billingProfile: BillingProfile }> {
    const response = await this.client.get('/api/billing-profile');
    return response.data;
  }

  async updateBillingProfile(data: UpdateBillingProfileRequest): Promise<{ billingProfile: BillingProfile }> {
    const response = await this.client.put('/api/billing-profile', data);
    return response.data;
  }

  // Invoice endpoints
  async getInvoices(filters: InvoiceListFilters = {}): Promise<InvoiceListResponse> {
    const response = await this.client.get('/api/invoices', { params: filters });
    return response.data;
  }

  async getInvoice(id: number): Promise<{ invoice: Invoice }> {
    const response = await this.client.get(`/api/invoices/${id}`);
    return response.data;
  }

  async getInvoicePreview(params: { clientId: number; from?: string; to?: string }): Promise<InvoicePreview> {
    const response = await this.client.get('/api/invoices/preview', { params });
    return response.data;
  }

  async createInvoice(data: InvoiceInput): Promise<{ invoice: Invoice }> {
    const response = await this.client.post('/api/invoices', data);
    return response.data;
  }

  async updateInvoice(id: number, data: InvoiceInput): Promise<{ invoice: Invoice }> {
    const response = await this.client.put(`/api/invoices/${id}`, data);
    return response.data;
  }

  async deleteInvoice(id: number) {
    const response = await this.client.delete(`/api/invoices/${id}`);
    return response.data;
  }

  async invoiceAction(
    id: number,
    action: 'issue' | 'mark-paid' | 'mark-unpaid' | 'void',
    body: Record<string, unknown> = {}
  ): Promise<{ invoice: Invoice }> {
    const response = await this.client.post(`/api/invoices/${id}/${action}`, body);
    return response.data;
  }

  async downloadInvoicePdf(id: number): Promise<{ blob: Blob; filename: string }> {
    const response = await this.client.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
    const disposition: string = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    return { blob: response.data, filename: match ? match[1] : `invoice-${id}.pdf` };
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
