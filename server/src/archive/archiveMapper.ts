import { createHash } from "node:crypto";
import type { LogEntry, LogLevel } from "../types/index.js";
import type { DecodedEvent } from "./groupedTypes.js";

const VALID_ENVS = new Set(["dev", "preprod", "prod"]);
const VALID_SERVICES = new Set(["api", "worker"]);

export function isArchiveEnv(value: string): boolean {
  return VALID_ENVS.has(value);
}

export function isArchiveService(value: string): boolean {
  return VALID_SERVICES.has(value);
}

function mapSvcToServiceName(svc: string, fallbackService: string): string {
  if (svc === "API") return "api";
  if (svc === "Worker") return "worker";
  return fallbackService;
}

function mapLevel(level: DecodedEvent["level"]): LogLevel {
  if (level === "WARN") return "warn";
  if (level === "ERROR") return "error";
  return "info";
}

function buildMessage(event: DecodedEvent): string {
  if (event.msg) return event.msg;
  const numParts = Object.entries(event.num ?? {}).map(([k, v]) => `${k}=${v}`);
  if (numParts.length > 0) return numParts.join(" ");
  return event.key;
}

const HTTP_ROUTE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+?)(?:\s+-\s+|\s+)(\d{3})$/i;

/** Compacted keys are `GET /api/chat 200`. Raw lines are `GET /status - 200`. */
export function parseHttpRoute(key: string): { method: string; path: string; status: number } | null {
  const match = HTTP_ROUTE.exec(key.trim());
  if (!match) return null;
  return { method: match[1].toUpperCase(), path: match[2], status: Number(match[3]) };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Vector adds `pod` (or kubernetes.pod_name) on each raw landing line. */
export function readPod(obj: Record<string, unknown>): string | undefined {
  const direct = readString(obj.pod) ?? readString(obj.pod_name) ?? readString(obj.podName);
  if (direct) return direct;
  const kubernetes = obj.kubernetes ?? obj.k8s;
  if (kubernetes && typeof kubernetes === "object") {
    const record = kubernetes as Record<string, unknown>;
    const nested = record.pod;
    const nestedName = nested && typeof nested === "object" ? (nested as Record<string, unknown>).name : nested;
    return readString(record.pod_name) ?? readString(record.podName) ?? readString(nestedName);
  }
  return undefined;
}

function readRequestId(obj: Record<string, unknown>, data: unknown): string | undefined {
  const top = readString(obj.requestId) ?? readString(obj.rid);
  if (top) return top;
  if (data && typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    return readString(record.requestId) ?? readString(record.rid);
  }
  return undefined;
}

/**
 * Archive INFO and probes are compacted without a request id.
 * WARN and ERROR keep one when the chunk stored it.
 * Live landing lines keep a request id only when the raw line has one,
 * including probes that have not been compacted yet.
 */
function requestIdFor(event: DecodedEvent, origin: "live" | "archive"): string | undefined {
  if (!event.rid) return undefined;
  if (origin === "archive" && event.level === "INFO") return undefined;
  return event.rid;
}

/** Errors keep the full record (message, request id, numeric fields, and `d`). */
function dataFor(event: DecodedEvent): unknown {
  if (event.level === "ERROR") {
    const record: Record<string, unknown> = {};
    if (event.msg) record.message = event.msg;
    if (event.rid) record.requestId = event.rid;
    if (event.pod) record.pod = event.pod;
    if (event.num) Object.assign(record, event.num);
    if (event.data && typeof event.data === "object" && event.data !== null && !Array.isArray(event.data)) {
      Object.assign(record, event.data as Record<string, unknown>);
    } else if (event.data !== undefined) {
      record.detail = event.data;
    }
    return Object.keys(record).length > 0 ? record : undefined;
  }
  if (event.data !== undefined) return event.data;
  if (event.num && Object.keys(event.num).length > 0) return event.num;
  return undefined;
}

/** Stable id for S3-sourced rows (enables GET /api/logs/:eventId after search). */
export function eventIdForDecoded(event: DecodedEvent, env: string, service: string): string {
  const payload = [
    env,
    service,
    event.ts,
    event.level,
    event.svc,
    event.key,
    event.pod ?? "",
    event.rid ?? "",
    event.msg ?? "",
  ].join("|");
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `s3-${hash}`;
}

export function decodedEventToLogEntry(
  event: DecodedEvent,
  env: string,
  service: string,
  origin: "live" | "archive" = "archive"
): LogEntry {
  const serviceName = mapSvcToServiceName(event.svc, service);
  const message = buildMessage(event);
  const dataPayload = dataFor(event);
  const http = parseHttpRoute(event.key) ?? (event.msg ? parseHttpRoute(event.msg) : null);
  const pod = event.pod?.trim() || undefined;
  const requestId = requestIdFor(event, origin);

  return {
    eventId: eventIdForDecoded(event, env, service),
    timestamp: new Date(event.ts).toISOString(),
    level: mapLevel(event.level),
    subject: event.key,
    message,
    ...(dataPayload !== undefined ? { data: dataPayload as Record<string, unknown> } : {}),
    source: {
      function: origin === "live" ? "landing" : "archive",
      file: origin === "live" ? `landing/${env}/${service}` : `s3://${env}/${service}`,
      process: pod ?? "",
      runtime: "node",
      serviceName,
      env,
      ...(pod ? { pod } : {}),
      ...(http
        ? { method: http.method, path: http.path, status: http.status }
        : {}),
      origin,
    },
    correlation: {
      ...(requestId ? { requestId } : {}),
    },
  };
}

/** One-line JSON landing records from Vector (landing logger JSON shape). */
export function landingJsonLineToLogEntry(
  line: string,
  env: string,
  service: string
): LogEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  const timestamp = obj.timestamp;
  const levelRaw = obj.level;
  const message = obj.message;
  const context = obj.context;
  if (typeof timestamp !== "string" || typeof levelRaw !== "string" || typeof message !== "string") {
    return null;
  }
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return null;

  const upper = levelRaw.toUpperCase();
  let level: LogLevel = "info";
  if (upper === "WARNING") level = "warn";
  else if (upper === "ERROR" || upper === "CRITICAL") level = "error";
  else if (upper === "DEBUG") level = "debug";
  else if (upper === "SUCCESS") level = "success";

  const subject =
    typeof context === "string" && context.length > 0 ? context : String(message).slice(0, 255);

  const data = obj.data;
  const requestId = readRequestId(obj, data);
  const pod = readPod(obj);
  const decodedLevel: DecodedEvent["level"] =
    level === "warn" ? "WARN" : level === "error" ? "ERROR" : "INFO";

  const pseudo: DecodedEvent = {
    ts,
    level: decodedLevel,
    svc: service === "worker" ? "Worker" : "API",
    key: subject,
    msg: message,
    ...(pod ? { pod } : {}),
    ...(requestId ? { rid: requestId } : {}),
    ...(data !== undefined ? { data } : {}),
  };

  return decodedEventToLogEntry(pseudo, env, service, "live");
}
