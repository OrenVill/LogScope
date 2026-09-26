import { createHash } from "node:crypto";
import type { LogEntry, LogLevel } from "../types/index.js";
import type { DecodedEvent } from "./groupedTypes.js";

const VALID_ENVS = new Set(["dev", "preprod", "prod"]);
const VALID_SERVICES = new Set(["nexvill-api", "nexvill-worker"]);

export function isNexvillEnv(value: string): boolean {
  return VALID_ENVS.has(value);
}

export function isNexvillService(value: string): boolean {
  return VALID_SERVICES.has(value);
}

function mapSvcToServiceName(svc: string, fallbackService: string): string {
  if (svc === "API") return "nexvill-api";
  if (svc === "Worker") return "nexvill-worker";
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
  service: string
): LogEntry {
  const serviceName = mapSvcToServiceName(event.svc, service);
  const message = buildMessage(event);
  const dataPayload =
    event.data !== undefined
      ? event.data
      : event.num && Object.keys(event.num).length > 0
        ? event.num
        : undefined;

  return {
    eventId: eventIdForDecoded(event, env, service),
    timestamp: new Date(event.ts).toISOString(),
    level: mapLevel(event.level),
    subject: event.key,
    message,
    ...(dataPayload !== undefined ? { data: dataPayload as Record<string, unknown> } : {}),
    source: {
      function: "archive",
      file: `s3://${env}/${service}`,
      process: event.pod ?? "unknown",
      runtime: "node",
      serviceName,
    },
    correlation: {
      ...(event.rid ? { requestId: event.rid } : {}),
    },
  };
}

/** One-line JSON landing records from Vector (NexVill logger JSON shape). */
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

  let requestId: string | undefined;
  const data = obj.data;
  if (data && typeof data === "object" && data !== null) {
    const rid = (data as Record<string, unknown>).requestId;
    if (typeof rid === "string") requestId = rid;
  }

  const pseudo: DecodedEvent = {
    ts,
    level: level === "warn" ? "WARN" : level === "error" ? "ERROR" : "INFO",
    svc: service === "nexvill-worker" ? "Worker" : "API",
    key: subject,
    msg: message,
    ...(requestId ? { rid: requestId } : {}),
    ...(data !== undefined ? { data } : {}),
  };

  return decodedEventToLogEntry(pseudo, env, service);
}
