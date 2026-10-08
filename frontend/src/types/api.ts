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
  hourly_rate_cents?: number | null;
  currency?: string | null;
  billing_address?: string | null;
  billing_email?: string | null;
  payment_terms_days?: number | null;
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
  unbilledHours?: number;
  unbilledEntryCount?: number;
  unbilledAmountCents?: number | null;
}

export interface ClientBillingFields {
  hourlyRateCents?: number | null;
  currency?: string | null;
  billingAddress?: string | null;
  billingEmail?: string | null;
  paymentTermsDays?: number | null;
}

export interface CreateClientRequest extends ClientBillingFields {
  name: string;
  description?: string;
  department?: string;
  email?: string;
}

export interface UpdateClientRequest extends ClientBillingFields {
  name?: string;
  description?: string;
  department?: string;
  email?: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';

export interface BillingProfile {
  user_email: string;
  business_name: string | null;
  address: string | null;
  tax_id: string | null;
  invoice_prefix: string;
  next_invoice_seq: number;
  default_currency: string;
  default_tax_rate_bp: number;
  default_payment_terms_days: number;
}

export interface UpdateBillingProfileRequest {
  businessName?: string | null;
  address?: string | null;
  taxId?: string | null;
  invoicePrefix?: string;
  defaultCurrency?: string;
  defaultTaxRateBp?: number;
  defaultPaymentTermsDays?: number;
}

export interface InvoiceParty {
  name: string;
  address?: string | null;
  email?: string | null;
  taxId?: string | null;
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  work_entry_id: number | null;
  date: string | null;
  description: string;
  quantity: number;
  unit_price_cents: number | null;
  amount_cents: number;
  sort_order: number;
}

export interface Invoice {
  id: number;
  client_id: number;
  client_name: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal_cents: number;
  tax_rate_bp: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  sender_snapshot: InvoiceParty | null;
  client_snapshot: InvoiceParty | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  is_overdue: boolean;
  lines?: InvoiceLineItem[];
}

export interface InvoiceSummary {
  currency: string;
  outstanding_cents: number;
  overdue_cents: number;
  paid_cents: number;
  draft_cents: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: { page: number; pageSize: number; total: number };
  summary: InvoiceSummary[];
}

export interface InvoiceListFilters {
  status?: InvoiceStatus | 'overdue';
  clientId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceLineInput {
  workEntryId?: number;
  date?: string | null;
  description?: string;
  quantity?: number;
  unitPriceCents?: number | null;
}

export interface InvoiceInput {
  clientId?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  taxRateBp?: number;
  notes?: string | null;
  lines?: InvoiceLineInput[];
}

export interface InvoicePreview {
  client: Client;
  entries: { id: number; hours: number; description: string | null; date: string }[];
  defaults: {
    issueDate: string;
    dueDate: string;
    currency: string;
    taxRateBp: number;
    hourlyRateCents: number | null;
  };
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

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
