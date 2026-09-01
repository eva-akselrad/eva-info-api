export type CheckType = "http" | "json_ok";
export type MonitorStatus = "up" | "down" | "unknown";
export type OverallStatus = "operational" | "degraded" | "outage";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentImpact = "none" | "minor" | "major" | "critical";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EMAIL: SendEmail;
  ADMIN_API_KEY?: string;
  TURNSTILE_SECRET_PORTFOLIO?: string;
  FROM_EMAIL: string;
  OPS_NOTIFY_EMAIL?: string;
}

export interface MonitorRow {
  id: number;
  slug: string;
  name: string;
  group_name: string;
  url: string;
  check_type: CheckType;
  sort_order: number;
}

export interface MonitorStateRow {
  monitor_id: number;
  consecutive_failures: number;
  consecutive_successes: number;
  current_status: MonitorStatus;
  last_checked_at: string | null;
  last_latency_ms: number | null;
  last_status_code: number | null;
  last_error: string | null;
}

export interface ContactRoute {
  to: string;
  fromEmail: string;
  fromName: string;
  subjectPrefix: string;
  allowedOrigins: string[];
}
