import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type {
  ClientResponse,
  ClientsResponse,
  ClientReport,
  CreateClientRequest,
  CreateWorkEntryRequest,
  LoginResponse,
  MessageResponse,
  UpdateClientRequest,
  UpdateWorkEntryRequest,
  UserResponse,
  WorkEntriesResponse,
  WorkEntryResponse,
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
      (error: unknown) => {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      },
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Clear stored email on auth error
          localStorage.removeItem('userEmail');
          window.location.href = '/login';
        }
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  }

  // Auth endpoints
  async login(email: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/api/auth/login', { email });
    return response.data;
  }

  async getCurrentUser(): Promise<UserResponse> {
    const response = await this.client.get<UserResponse>('/api/auth/me');
    return response.data;
  }

  // Client endpoints
  async getClients(): Promise<ClientsResponse> {
    const response = await this.client.get<ClientsResponse>('/api/clients');
    return response.data;
  }

  async getClient(id: number): Promise<ClientResponse> {
    const response = await this.client.get<ClientResponse>(`/api/clients/${id}`);
    return response.data;
  }

  async createClient(clientData: CreateClientRequest): Promise<ClientResponse> {
    const response = await this.client.post<ClientResponse>('/api/clients', clientData);
    return response.data;
  }

  async updateClient(id: number, clientData: UpdateClientRequest): Promise<ClientResponse> {
    const response = await this.client.put<ClientResponse>(`/api/clients/${id}`, clientData);
    return response.data;
  }

  async deleteClient(id: number): Promise<MessageResponse> {
    const response = await this.client.delete<MessageResponse>(`/api/clients/${id}`);
    return response.data;
  }

  async deleteAllClients(): Promise<MessageResponse> {
    const response = await this.client.delete<MessageResponse>('/api/clients');
    return response.data;
  }

  // Work entry endpoints
  async getWorkEntries(clientId?: number): Promise<WorkEntriesResponse> {
    const params = clientId ? { clientId } : {};
    const response = await this.client.get<WorkEntriesResponse>('/api/work-entries', { params });
    return response.data;
  }

  async getWorkEntry(id: number): Promise<WorkEntryResponse> {
    const response = await this.client.get<WorkEntryResponse>(`/api/work-entries/${id}`);
    return response.data;
  }

  async createWorkEntry(entryData: CreateWorkEntryRequest): Promise<WorkEntryResponse> {
    const response = await this.client.post<WorkEntryResponse>('/api/work-entries', entryData);
    return response.data;
  }

  async updateWorkEntry(id: number, entryData: UpdateWorkEntryRequest): Promise<WorkEntryResponse> {
    const response = await this.client.put<WorkEntryResponse>(`/api/work-entries/${id}`, entryData);
    return response.data;
  }

  async deleteWorkEntry(id: number): Promise<MessageResponse> {
    const response = await this.client.delete<MessageResponse>(`/api/work-entries/${id}`);
    return response.data;
  }

  // Report endpoints
  async getClientReport(clientId: number): Promise<ClientReport> {
    const response = await this.client.get<ClientReport>(`/api/reports/client/${clientId}`);
    return response.data;
  }

  async exportClientReportCsv(clientId: number): Promise<Blob> {
    const response = await this.client.get<Blob>(`/api/reports/export/csv/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async exportClientReportPdf(clientId: number): Promise<Blob> {
    const response = await this.client.get<Blob>(`/api/reports/export/pdf/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get<{ status: string; timestamp: string }>('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
