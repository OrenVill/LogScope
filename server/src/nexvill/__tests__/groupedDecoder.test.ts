import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeGroupedLines, expandDeltas } from "../groupedDecoder.js";
import { decodedEventToLogEntry, eventIdForDecoded } from "../nexvillMapper.js";

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

describe("nexvillMapper", () => {
  it("maps decoded events to LogScope LogEntry rows", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    const entry = decodedEventToLogEntry(events[0], "prod", "nexvill-api");
    expect(entry.eventId).toMatch(/^s3-/);
    expect(entry.source.runtime).toBe("node");
    expect(entry.source.serviceName).toBe("nexvill-api");
    expect(entry.timestamp).toMatch(/^\d{4}-\d/);
    expect(eventIdForDecoded(events[0], "prod", "nexvill-api")).toBe(entry.eventId);
  });

  it("preserves requestId on WARN/ERROR only when present in archive", () => {
    const events = decodeGroupedLines(fixture.split("\n"));
    const info = events.find((e) => e.level === "INFO" && !e.msg?.startsWith("probe_count"));
    const warn = events.find((e) => e.level === "WARN");
    const infoEntry = decodedEventToLogEntry(info!, "dev", "nexvill-api");
    const warnEntry = decodedEventToLogEntry(warn!, "dev", "nexvill-api");
    expect(infoEntry.correlation.requestId).toBeUndefined();
    expect(warnEntry.correlation.requestId).toBe("req-warn-1");
  });
});
