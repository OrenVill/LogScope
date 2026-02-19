export type { LogEntry } from "./log";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical" | "success";

export interface SuccessResponse<T = any> {
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

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

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
