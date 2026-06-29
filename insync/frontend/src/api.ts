// Thin Axios wrapper around the TalentBridge backend API.
import axios from "axios";
import type {
  AuthResponse,
  AuthUser,
  ChatMeta,
  ChatResponse,
  CreateOpportunityPayload,
  CreateOpportunityResult,
  DashboardData,
  EWARequest,
  Meta,
  OpportunityFormOptions,
  ParsedRequirement,
  PersonDetail,
  PersonSummary,
  RecommendationResult,
  Role,
  RoleOption,
} from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "",
});

const TOKEN_KEY = "tb_token";

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Attach the bearer token (if any) to every request.
api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ----------------------------- Auth ----------------------------------- //
export async function getRoles(): Promise<RoleOption[]> {
  return (await api.get("/api/auth/roles")).data;
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  return (await api.post("/api/auth/signin", { email, password })).data;
}

export async function signUp(payload: {
  full_name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<AuthResponse> {
  return (await api.post("/api/auth/signup", payload)).data;
}

export async function fetchMe(): Promise<AuthUser> {
  return (await api.get("/api/auth/me")).data;
}

// ----------------------------- Chat ------------------------------------ //
export async function getChatMeta(): Promise<ChatMeta> {
  return (await api.get("/api/chat")).data;
}

export async function sendChat(message: string): Promise<ChatResponse> {
  return (await api.post("/api/chat", { message })).data;
}

export async function getMeta(): Promise<Meta> {
  return (await api.get("/api/meta")).data;
}

export async function getDashboard(): Promise<DashboardData> {
  return (await api.get("/api/dashboard")).data;
}

export interface PeopleFilters {
  skill?: string;
  role?: string;
  grade?: string;
  region?: string;
  country?: string;
  domain?: string;
  availability?: string;
  bench_only?: boolean;
  q?: string;
}

export async function searchPeople(
  filters: PeopleFilters
): Promise<{ total: number; results: PersonSummary[] }> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined && v !== false)
  );
  return (await api.get("/api/people", { params })).data;
}

// Employee identifiers are short alphanumeric codes (e.g. "EMP-001"). Validate
// the value before putting it in the request path so untrusted input can never
// be used to construct an arbitrary URL.
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export async function getPerson(id: string): Promise<PersonDetail> {
  if (!EMPLOYEE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid employee id: ${id}`);
  }
  return (await api.get(`/api/people/${encodeURIComponent(id)}`)).data;
}

export async function parseRequirement(text: string): Promise<ParsedRequirement> {
  return (await api.post("/api/parse", { text })).data;
}

export async function recommend(payload: {
  summary: string;
  start_date: string;
  roles: ParsedRequirement["roles"];
}): Promise<RecommendationResult> {
  return (await api.post("/api/recommend", payload)).data;
}

export async function getOpportunityFormOptions(): Promise<OpportunityFormOptions> {
  return (await api.get("/api/opportunities/form-options")).data;
}

export async function createOpportunity(
  payload: CreateOpportunityPayload
): Promise<CreateOpportunityResult> {
  return (await api.post("/api/opportunities", payload)).data;
}

export async function submitEWA(payload: {
  employee_id: string;
  employee_name?: string;
  role_name?: string;
  option_label?: string;
  proposed_start_date?: string | null;
  requested_fte?: number;
  match_score?: number;
  opportunity_summary?: string;
}): Promise<{ success: boolean; message: string; request: EWARequest }> {
  return (await api.post("/api/ewa", payload)).data;
}

export async function listEWA(): Promise<{ requests: EWARequest[]; role: string }> {
  return (await api.get("/api/ewa")).data;
}

export async function setDeliveryFit(
  requestId: string,
  approve: boolean,
  note?: string
): Promise<{ success: boolean; request: EWARequest }> {
  return (
    await api.post(
      `/api/ewa/${encodeURIComponent(requestId)}/delivery?approve=${approve}`,
      { note }
    )
  ).data;
}

export async function setBusinessFit(
  requestId: string,
  approve: boolean,
  note?: string
): Promise<{ success: boolean; request: EWARequest }> {
  return (
    await api.post(
      `/api/ewa/${encodeURIComponent(requestId)}/business?approve=${approve}`,
      { note }
    )
  ).data;
}
