import type { S3Client } from "@aws-sdk/client-s3";
import type { HourSlot } from "./s3LogReader.js";
import { decodeZstdToUtf8 } from "./zstdDecode.js";
import { landingJsonLineToLogEntry } from "./archiveMapper.js";
import type { LogEntry } from "../types/index.js";
import { getObjectBytes, listLandingKeys } from "./s3LogReader.js";

export function shouldReadLandingForHour(options: {
  includeLanding: boolean;
  hasInfoObject: boolean;
  hasDurableObject: boolean;
}): boolean {
  if (!options.includeLanding) return false;
  return !options.hasInfoObject && !options.hasDurableObject;
}

export function currentUtcHourSlot(): HourSlot {
  const iso = new Date().toISOString();
  return { datePart: iso.slice(0, 10), hourPart: iso.slice(11, 13) };
}

export async function readLandingEntriesForSlot(options: {
  client: S3Client;
  bucket: string;
  env: string;
  service: string;
  slot: HourSlot;
}): Promise<LogEntry[]> {
  const { client, bucket, env, service, slot } = options;
  const landingKeys = await listLandingKeys(client, bucket, env, service, slot);
  const entries: LogEntry[] = [];

  for (const key of landingKeys) {
    const bytes = await getObjectBytes(client, bucket, key);
    if (!bytes || bytes.length === 0) continue;
    const text = key.endsWith(".zst") ? decodeZstdToUtf8(bytes) : bytes.toString("utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const entry = landingJsonLineToLogEntry(line, env, service);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}
