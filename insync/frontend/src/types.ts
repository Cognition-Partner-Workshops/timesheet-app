// Shared TypeScript types mirroring the FastAPI backend responses.

export interface DashboardMetrics {
  total_employees: number;
  bench: number;
  partial_capacity: number;
  rolling_off_30: number;
  rolling_off_60: number;
  rolling_off_61_90: number;
  allocated_over_90: number;
  booked: number;
}

export interface SupplyForecastPoint {
  week_start: string;
  current_bench: number;
  emerging_bench: number;
  partial_capacity: number;
  available_fte: number;
}

export interface DashboardData {
  snapshot_date: string;
  metrics: DashboardMetrics;
  bench_risk: Record<string, number>;
  by_department: Record<string, number>;
  by_region: Record<string, number>;
  bench_by_discipline: Record<string, number>;
  supply_forecast: SupplyForecastPoint[];
}

export interface PersonSummary {
  employee_id: string;
  name: string;
  role_archetype: string;
  department: string;
  discipline: string;
  grade: string;
  region: string;
  country: string;
  city: string;
  primary_domain: string;
  secondary_domain: string | null;
  availability_category: string;
  available_fte_current: number;
  expected_release_date: string | null;
  ewa_status: string;
  work_mode: string;
  top_skills: string[];
}

export type Role = "workforce_planner" | "delivery_manager" | "client_manager";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  role_label: string;
  landing: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RoleOption {
  value: Role;
  label: string;
}

export interface ChatSource {
  document_key: string;
  source_type: string;
  score: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  retrieval: "pgvector" | "fallback" | "none";
  used_ai: boolean;
  restricted: boolean;
  role: Role;
}

export interface ChatMeta {
  retrieval_enabled: boolean;
  suggestions: string[];
  role: Role;
}

export interface Meta {
  snapshot_date: string;
  ai_enabled: boolean;
  ai_provider: string;
  retrieval_enabled?: boolean;
  skills: string[];
  domains: string[];
  regions: string[];
  countries: string[];
  grades: string[];
  roles: string[];
  availability_categories: string[];
  starter_prompts: { id: string; persona: string; prompt: string; expected_output: string }[];
}

export interface ParsedRole {
  role_name: string;
  count: number;
  required_skills: string[];
  desired_skills: string[];
  domain: string | null;
  location_preference: string | null;
  grade_preference: string | null;
  fte_required: number;
  start_window_days: number;
  start_date: string;
}

export interface ParsedRequirement {
  summary: string;
  domain: string | null;
  location: string | null;
  grade_preference: string | null;
  start_window_days: number;
  start_date: string;
  required_fte: number;
  roles: ParsedRole[];
  parser: string;
}

export interface AvailabilityDetail {
  score: number;
  available_fte_at_start: number;
  fte_gap: number;
  earliest_available_date: string | null;
  days_until_available: number;
  days_late: number;
  covers_start: boolean;
}

export interface SkillDetail {
  score: number;
  matched_required: string[];
  missing_required: string[];
  matched_desired: string[];
  required_total: number;
  desired_total: number;
}

export interface Candidate {
  employee_id: string;
  name: string;
  role_archetype: string;
  grade: string;
  country: string;
  region: string;
  city: string;
  primary_domain: string;
  secondary_domain: string | null;
  availability_category: string;
  ewa_status: string;
  work_mode: string;
  overall_score: number;
  components: Record<string, number>;
  weighted_contributions: Record<string, number>;
  skill_detail: SkillDetail;
  availability_detail: AvailabilityDetail;
  domain_detail: { score: number; evidence: string };
  location_detail: { score: number; evidence: string };
  grade_detail: { score: number; evidence: string };
  project_history_detail: { score: number; evidence: string };
  confidence: string;
  risks: string[];
  next_actions: string[];
  explanation?: string;
}

export interface Assignment {
  role_name: string;
  fte_required: number;
  count_required: number;
  required_skills: string[];
  desired_skills: string[];
  candidates: Candidate[];
  unfilled: number;
}

export interface StaffingOption {
  key: string;
  label: string;
  description: string;
  team_score: number;
  team_confidence: string;
  earliest_team_start: string | null;
  assignments: Assignment[];
  explanation?: string;
}

export interface RecommendationResult {
  options: StaffingOption[];
  role_pools: { role_name: string; candidates: Candidate[] }[];
}

export interface PersonDetail extends PersonSummary {
  skills: {
    name: string;
    category: string;
    level: number;
    years: number;
    last_used: string | null;
    evidence: string;
    confidence: string;
  }[];
  profile: {
    summary: string;
    key_strengths: string[];
    certifications: string[];
    domain_experience: string;
    recent_highlights: string;
    mobility_notes: string;
    languages: string[];
  } | null;
  project_history: {
    client_name: string;
    project_name: string;
    domain: string;
    role: string;
    start_date: string | null;
    end_date: string | null;
    technologies: string[];
    responsibilities: string;
  }[];
  availability_calendar: { week_start: string | null; available_fte: number; type: string }[];
}

export interface EWARequest {
  ewa_request_id: string;
  employee_id: string;
  employee_name: string | null;
  role_name: string | null;
  option_label: string | null;
  proposed_start_date: string | null;
  requested_fte: number;
  match_score: number | null;
  status: string;
  submitted_at: string;
  booking_owner: string;
}
