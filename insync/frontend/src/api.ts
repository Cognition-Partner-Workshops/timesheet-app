// Thin Axios wrapper around the InSync backend API.
import axios from "axios";
import type {
  DashboardData,
  EWARequest,
  Meta,
  ParsedRequirement,
  PersonDetail,
  PersonSummary,
  RecommendationResult,
} from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "",
});

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

export async function submitEWA(payload: {
  employee_id: string;
  employee_name?: string;
  role_name?: string;
  option_label?: string;
  proposed_start_date?: string | null;
  requested_fte?: number;
  match_score?: number;
}): Promise<{ success: boolean; message: string; request: EWARequest }> {
  return (await api.post("/api/ewa", payload)).data;
}

export async function listEWA(): Promise<{ requests: EWARequest[] }> {
  return (await api.get("/api/ewa")).data;
}
