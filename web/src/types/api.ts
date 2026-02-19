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

export interface SearchFilters {
  timeFrom?: string;
  timeTo?: string;
  level?: LogLevel;
  subject?: string;
  text?: string;
  requestId?: string;
  sessionId?: string;
}

export interface Pagination {
  limit?: number;
  offset?: number;
}
