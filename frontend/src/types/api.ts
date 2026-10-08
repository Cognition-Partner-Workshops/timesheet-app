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
  hourly_rate: number | null;
  currency: string;
  billing_address: string | null;
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
  invoice_id?: number | null;
  invoice_number?: string | null;
  invoice_status?: InvoiceStatus | null;
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
  hourlyRate?: number | null;
  currency?: string;
  billingAddress?: string;
}

export interface UpdateClientRequest {
  name?: string;
  description?: string;
  department?: string;
  email?: string;
  hourlyRate?: number | null;
  currency?: string;
  billingAddress?: string;
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

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';

export interface Invoice {
  id: number;
  client_id: number;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  issue_date: string | null;
  due_date: string | null;
  client_name: string;
  client_email: string | null;
  billing_address: string | null;
  currency: string;
  subtotal: number;
  total: number;
  total_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: number;
  work_entry_id: number;
  entry_date: string;
  description: string | null;
  hours: number;
  rate: number;
  amount: number;
}

export interface InvoiceDetail {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
}

export type InvoicePreviewLineItem = Omit<InvoiceLineItem, 'id'>;

export interface InvoicePreview {
  client: Pick<Client, 'id' | 'name' | 'email' | 'billing_address' | 'hourly_rate' | 'currency'>;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoicePreviewLineItem[];
  totalHours: number;
  subtotal: number;
  total: number;
  currency: string;
}

export interface InvoicePreviewParams {
  clientId: number;
  periodStart: string;
  periodEnd: string;
}

export interface InvoiceListFilters {
  clientId?: number;
  status?: InvoiceStatus;
}

export interface CreateInvoiceRequest extends InvoicePreviewParams {
  dueDate?: string;
  notes?: string;
  workEntryIds?: number[];
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
