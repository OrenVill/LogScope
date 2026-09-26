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

export type ArchiveEnv = "dev" | "preprod" | "prod";
export type ArchiveService = "api" | "worker";

export interface SearchFilters {
  timeFrom?: string;
  timeTo?: string;
  level?: LogLevel;
  subject?: string;
  text?: string;
  path?: string;
  status?: string;
  requestId?: string;
  sessionId?: string;
  env?: ArchiveEnv;
  service?: ArchiveService;
}

export interface ArchiveConfig {
  readOnly: boolean;
  defaultEnv?: ArchiveEnv;
  defaultService?: ArchiveService;
  envs?: ArchiveEnv[];
  services?: ArchiveService[];
}

export interface Pagination {
  limit?: number;
  offset?: number;
}
