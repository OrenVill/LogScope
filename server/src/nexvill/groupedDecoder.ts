/**
 * Decoder: grouped-chunk NDJSON lines → individual events.
 * Ported from NexVill apps/backend/observability/groupedLog/decoder.ts (main).
 */

import type { DecodedEvent, DeltaItem, GroupedChunk, WarnGroup } from "./groupedTypes.js";

const LEVEL_ORDER: Record<DecodedEvent["level"], number> = { ERROR: 0, WARN: 1, INFO: 2 };

export class GroupedLogDecodeError extends Error {
  constructor(
    message: string,
    readonly lineNumber: number
  ) {
    super(`line ${lineNumber}: ${message}`);
    this.name = "GroupedLogDecodeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChunkLine(line: string, lineNumber = 1): GroupedChunk {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new GroupedLogDecodeError("not valid JSON", lineNumber);
  }
  if (!isRecord(value) || typeof value.svc !== "string" || typeof value.t0 !== "number") {
    throw new GroupedLogDecodeError('expected an object with string "svc" and numeric "t0"', lineNumber);
  }
  return value as unknown as GroupedChunk;
}

export function expandDeltas(items: readonly DeltaItem[], t0: number): number[] {
  const out: number[] = [];
  let ts = t0;
  for (const item of items) {
    if (Array.isArray(item)) {
      const [delta, count] = item;
      for (let i = 0; i < count; i++) {
        ts += delta;
        out.push(ts);
      }
    } else {
      ts += item;
      out.push(ts);
    }
  }
  return out;
}

function decodeWarn(chunk: GroupedChunk, key: string, group: WarnGroup, out: DecodedEvent[]): void {
  const times = expandDeltas(group.dt, chunk.t0);
  const numericColumns = Object.entries(group).filter(
    (entry): entry is [string, (number | null)[]] =>
      entry[0] !== "dt" && entry[0] !== "rid" && Array.isArray(entry[1])
  );
  times.forEach((ts, i) => {
    const rid = group.rid?.[i];
    const num: Record<string, number> = {};
    for (const [field, column] of numericColumns) {
      const v = column[i];
      if (typeof v === "number") num[field] = v;
    }
    out.push({
      ts,
      level: "WARN",
      svc: chunk.svc,
      key,
      ...(chunk.pod ? { pod: chunk.pod } : {}),
      ...(typeof rid === "string" ? { rid } : {}),
      ...(Object.keys(num).length > 0 ? { num } : {}),
    });
  });
}

export function decodeChunk(chunk: GroupedChunk): DecodedEvent[] {
  const out: DecodedEvent[] = [];
  const pod = chunk.pod ? { pod: chunk.pod } : {};

  for (const [key, count] of Object.entries(chunk.Pc ?? {})) {
    out.push({
      ts: chunk.t0,
      level: "INFO",
      svc: chunk.svc,
      key,
      msg: `probe_count=${count}`,
      num: { n: count },
      ...pod,
    });
  }
  for (const [key, items] of Object.entries(chunk.I ?? {})) {
    for (const ts of expandDeltas(items, chunk.t0)) {
      out.push({ ts, level: "INFO", svc: chunk.svc, key, ...pod });
    }
  }
  for (const [key, group] of Object.entries(chunk.W ?? {})) {
    decodeWarn(chunk, key, group, out);
  }

  let prev = chunk.t0;
  for (const record of chunk.E ?? []) {
    const ts = prev + record.dt;
    prev = ts;
    out.push({
      ts,
      level: "ERROR",
      svc: chunk.svc,
      key: record.k,
      ...pod,
      ...(record.rid ? { rid: record.rid } : {}),
      ...(record.msg ? { msg: record.msg } : {}),
      ...(record.num ? { num: record.num } : {}),
      ...(record.d !== undefined ? { data: record.d } : {}),
    });
  }
  return out;
}

/** Decodes NDJSON lines (blank lines ignored) into one time-ordered event list. */
export function decodeGroupedLines(lines: Iterable<string>): DecodedEvent[] {
  const events: DecodedEvent[] = [];
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    if (line.trim() === "") continue;
    events.push(...decodeChunk(parseChunkLine(line, lineNumber)));
  }
  return events.sort(
    (a, b) =>
      a.ts - b.ts ||
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      a.svc.localeCompare(b.svc) ||
      a.key.localeCompare(b.key)
  );
}
