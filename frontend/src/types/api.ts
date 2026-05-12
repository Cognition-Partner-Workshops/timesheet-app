/**
 * @fileoverview Shared TypeScript interfaces for API request/response payloads.
 *
 * These types mirror the backend data models and are used throughout the
 * frontend to ensure type-safe communication with the Express API.
 *
 * @module types/api
 */

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

/** Authenticated user profile returned by the auth endpoints. */
export interface User {
  email: string;
  createdAt: string;
}

/** A client record that work entries are logged against. */
export interface Client {
  id: number;
  name: string;
  description: string | null;
  department: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

/** A single time-tracking entry linked to a client. */
export interface WorkEntry {
  id: number;
  /** Foreign key referencing the parent {@link Client}. */
  client_id: number;
  /** Number of hours worked (decimal, e.g. 1.5). */
  hours: number;
  description: string | null;
  /** ISO date string (YYYY-MM-DD) for the day the work was performed. */
  date: string;
  created_at: string;
  updated_at: string;
  /** Denormalized client name; present when entries are fetched with a JOIN. */
  client_name?: string;
}

/** Work entry that is guaranteed to include the associated client name. */
export interface WorkEntryWithClient extends WorkEntry {
  client_name: string;
}

/** Aggregated report data for a single client's work entries. */
export interface ClientReport {
  client: Client;
  workEntries: WorkEntry[];
  totalHours: number;
  entryCount: number;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/** Payload for creating a new client. */
export interface CreateClientRequest {
  name: string;
  description?: string;
  department?: string;
  email?: string;
}

/** Payload for partially updating an existing client. */
export interface UpdateClientRequest {
  name?: string;
  description?: string;
  department?: string;
  email?: string;
}

/** Payload for creating a new work entry. */
export interface CreateWorkEntryRequest {
  clientId: number;
  /** Decimal hours worked (0 < hours <= 24). */
  hours: number;
  description?: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
}

/** Payload for partially updating an existing work entry. */
export interface UpdateWorkEntryRequest {
  clientId?: number;
  hours?: number;
  description?: string;
  date?: string;
}

/** Payload for the passwordless login endpoint. */
export interface LoginRequest {
  email: string;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

/** Response returned on successful login. */
export interface LoginResponse {
  message: string;
  user: User;
}

/** Generic envelope used by various API responses. */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
