export type { LogEntry, LogSummary } from "./log";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical" | "success";

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export type NexvillEnv = "dev" | "preprod" | "prod";
export type NexvillService = "nexvill-api" | "nexvill-worker";

export interface SearchFilters {
  timeFrom?: string;
  timeTo?: string;
  level?: LogLevel;
  subject?: string;
  text?: string;
  requestId?: string;
  sessionId?: string;
  env?: NexvillEnv;
  service?: NexvillService;
}

export interface ArchiveDailyStats {
  info: number;
  warn: number;
  error: number;
  days: Array<{
    date: string;
    env: string;
    svc: string;
    info: number;
    warn: number;
    error: number;
  }>;
}

export interface ArchiveConfig {
  readOnly: boolean;
  defaultEnv?: NexvillEnv;
  defaultService?: NexvillService;
  envs?: NexvillEnv[];
  services?: NexvillService[];
}

export interface Pagination {
  limit?: number;
  offset?: number;
}
