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

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface WeeklyUsageEntry {
  week: string;
  weekStart: string;
  usageCount: number;
  uniqueUsers: number;
}

export interface WeeklyUsageResponse {
  weeklyUsage: Record<string, WeeklyUsageEntry[]>;
}

export interface FeatureTrend {
  featureFamily: string;
  currentWeekCount: number;
  previousWeekCount: number;
  percentChange: number;
  traction: 'gaining' | 'losing' | 'stable';
  currentUsers: number;
  previousUsers: number;
}

export interface FeatureTrendsResponse {
  trends: FeatureTrend[];
}

export interface ActionBreakdownEntry {
  action: string;
  totalCount: number;
  uniqueUsers: number;
  lastUsed: string;
}

export interface FeatureBreakdownResponse {
  breakdown: Record<string, ActionBreakdownEntry[]>;
}
