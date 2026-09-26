export type LogLevel = "debug" | "info" | "warn" | "error" | "critical" | "success";

export interface LogSource {
  function: string;
  file: string;
  process: string;
  runtime: "node" | "browser";
  serviceName: string;
  /** Deployment env: dev | preprod | prod */
  env?: string;
  /** Kubernetes pod name. Vector writes this on each landing line. */
  pod?: string;
  method?: string;
  path?: string;
  status?: number;
  /** `live` is the open hour in landing/; `archive` is a compacted hour. */
  origin?: "live" | "archive";
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
  data?: string | Record<string, any>;
  source: LogSource;
  correlation: Correlation;
}

/**
 * Lightweight log summary for initial list views
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
    env?: string;
    pod?: string;
    method?: string;
    path?: string;
    status?: number;
    origin?: "live" | "archive";
  };
}
