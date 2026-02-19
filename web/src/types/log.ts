export type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "critical";

export interface LogSource {
  function: string;
  file: string;
  process: string;
  runtime: "node" | "browser";
  serviceName: string;
}

export interface Correlation {
  requestId?: string;
  sessionId?: string;
  userId?: string;
}

export interface LogEntry {
  eventId: string;
  timestamp: string;
  level: LogLevel;
  subject: string;
  message: string;
  data?: string | Record<string, unknown>;
  source: LogSource;
  correlation: Correlation;
}

/**
 * Lightweight log summary for list views
 * Contains only essential information to minimize data transfer
 */
export interface LogSummary {
  eventId: string;
  timestamp: string;
  level: LogLevel;
  subject: string;
  message: string;
  source: {
    runtime: "node" | "browser";
    serviceName: string;
  };
}
