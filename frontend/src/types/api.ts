export interface User {
  email: string;
  createdAt: string;
}

export interface Client {
  id: number;
  name: string;
  description: string | null;
  department: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  client_id: number;
  client_name?: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'on-hold';
  budget_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkEntry {
  id: number;
  client_id: number;
  project_id: number | null;
  hours: number;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  client_name?: string;
  project_name?: string | null;
}

export interface WorkEntryWithClient extends WorkEntry {
  client_name: string;
}

export interface ClientReport {
  client: Client;
  workEntries: WorkEntry[];
  totalHours: number;
  entryCount: number;
}

export interface CreateClientRequest {
  name: string;
  description?: string;
  department?: string;
  email?: string;
}

export interface UpdateClientRequest {
  name?: string;
  description?: string;
  department?: string;
  email?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  clientId: number;
  startDate?: string | null;
  endDate?: string | null;
  status?: 'active' | 'completed' | 'on-hold';
  budgetHours?: number | null;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  clientId?: number;
  startDate?: string | null;
  endDate?: string | null;
  status?: 'active' | 'completed' | 'on-hold';
  budgetHours?: number | null;
}

export interface CreateWorkEntryRequest {
  clientId: number;
  projectId?: number | null;
  hours: number;
  description?: string;
  date: string;
}

export interface UpdateWorkEntryRequest {
  clientId?: number;
  projectId?: number | null;
  hours?: number;
  description?: string;
  date?: string;
}

export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
