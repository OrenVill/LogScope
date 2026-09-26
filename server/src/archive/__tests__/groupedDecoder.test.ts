import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeGroupedLines, expandDeltas } from "../groupedDecoder.js";
import { decodedEventToLogEntry, eventIdForDecoded, landingJsonLineToLogEntry } from "../archiveMapper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "fixtures/grouped-hour.ndjson"), "utf8");

describe("groupedDecoder", () => {
  it("expands plain and run-length deltas", () => {
    expect(expandDeltas([0, 100, [50, 2]], 1_000)).toEqual([1_000, 1_100, 1_150, 1_200]);
  });

  it("decodes a compacted hour chunk into ordered events", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    expect(events.length).toBeGreaterThan(0);
    const probe = events.find((e) => e.msg?.startsWith("probe_count"));
    expect(probe?.key).toBe("GET /api/auth/status 200");
    const warn = events.find((e) => e.level === "WARN");
    expect(warn?.rid).toBe("req-warn-1");
    const err = events.find((e) => e.level === "ERROR");
    expect(err?.msg).toBe("stream failed");
  });
});

describe("archiveMapper", () => {
  it("maps decoded events to LogScope LogEntry rows", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    const entry = decodedEventToLogEntry(events[0], "prod", "api");
    expect(entry.eventId).toMatch(/^s3-/);
    expect(entry.source.runtime).toBe("node");
    expect(entry.source.serviceName).toBe("api");
    expect(entry.timestamp).toMatch(/^\d{4}-\d/);
    expect(eventIdForDecoded(events[0], "prod", "api")).toBe(entry.eventId);
  });

  it("preserves requestId on WARN/ERROR only when present in archive", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    const info = events.find((e) => e.level === "INFO" && !e.msg?.startsWith("probe_count"));
    const warn = events.find((e) => e.level === "WARN");
    const infoEntry = decodedEventToLogEntry(info!, "dev", "api");
    const warnEntry = decodedEventToLogEntry(warn!, "dev", "api");
    expect(infoEntry.correlation.requestId).toBeUndefined();
    expect(warnEntry.correlation.requestId).toBe("req-warn-1");
    expect(infoEntry.source.origin).toBe("archive");
    expect(infoEntry.source.pod).toBe("api-abc");
    expect(infoEntry.source.process).toBe("api-abc");
    expect(infoEntry.source.method).toBe("GET");
    expect(infoEntry.source.path).toBe("/api/chat");
    expect(infoEntry.source.status).toBe(200);
    expect(infoEntry.source.env).toBe("dev");
  });

  it("drops request ids on archive probes and keeps the full error record", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    const probe = events.find((e) => e.msg?.startsWith("probe_count"));
    const error = events.find((e) => e.level === "ERROR");
    const probeEntry = decodedEventToLogEntry(probe!, "prod", "api", "archive");
    const errorEntry = decodedEventToLogEntry(error!, "prod", "api", "archive");

    expect(probeEntry.correlation.requestId).toBeUndefined();
    expect(probeEntry.source.path).toBe("/api/auth/status");
    expect(probeEntry.source.status).toBe(200);
    expect(errorEntry.correlation.requestId).toBe("req-err-1");
    expect(errorEntry.source.method).toBe("POST");
    expect(errorEntry.source.path).toBe("/api/chat-stream");
    expect(errorEntry.source.status).toBe(500);
    expect(errorEntry.data).toMatchObject({
      message: "stream failed",
      requestId: "req-err-1",
      stack: "Error: boom",
    });
  });

  it("marks landing lines as live and keeps a pod plus a request id when the raw line has one", () => {
    const line = JSON.stringify({
      timestamp: "2026-09-26T14:00:00.000Z",
      level: "INFO",
      message: "probe",
      context: "GET /status 200",
      pod: "api-7f",
      data: { requestId: "req-live-probe" },
    });
    const entry = landingJsonLineToLogEntry(line, "prod", "api");
    expect(entry?.source.origin).toBe("live");
    expect(entry?.source.pod).toBe("api-7f");
    expect(entry?.source.process).toBe("api-7f");
    expect(entry?.source.path).toBe("/status");
    expect(entry?.source.status).toBe(200);
    expect(entry?.correlation.requestId).toBe("req-live-probe");
    expect(entry?.source.file.startsWith("landing/")).toBe(true);
  });

  it("reads a raw status probe line and the pod Vector attaches", () => {
    const line = JSON.stringify({
      timestamp: "2026-09-26T14:00:00.000Z",
      level: "INFO",
      message: "GET /status - 200",
      data: { requestId: "req-probe", userAgent: "kube-probe/1.34" },
      kubernetes: { pod_name: "api-7f" },
    });
    const entry = landingJsonLineToLogEntry(line, "dev", "api");
    expect(entry?.message).toBe("GET /status - 200");
    expect(entry?.source.origin).toBe("live");
    expect(entry?.source.env).toBe("dev");
    expect(entry?.source.method).toBe("GET");
    expect(entry?.source.path).toBe("/status");
    expect(entry?.source.status).toBe(200);
    expect(entry?.source.pod).toBe("api-7f");
    expect(entry?.source.process).toBe("api-7f");
    expect(entry?.correlation.requestId).toBe("req-probe");
  });
});
