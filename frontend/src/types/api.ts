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

export interface WorkEntry {
  id: number;
  client_id: number;
  hours: number;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  client_name?: string;
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

export interface CreateWorkEntryRequest {
  clientId: number;
  hours: number;
  description?: string;
  date: string;
}

export interface UpdateWorkEntryRequest {
  clientId?: number;
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

export interface JournalEntry {
  id: number;
  title: string;
  content: string;
  source: string | null;
  source_url: string | null;
  published_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalEntryRequest {
  title: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  publishedDate?: string;
}

export interface UpdateJournalEntryRequest {
  title?: string;
  content?: string;
  source?: string;
  sourceUrl?: string;
  publishedDate?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
