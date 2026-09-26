import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { NexvillBucketConfig } from "./bucketConfig.js";
import { createS3Client } from "./s3LogReader.js";

/** Matches NexVill `logsCompact/hourly.ts` daily stats object (last write wins per calendar day). */
export interface NexvillDailyStatsRow {
  date: string;
  env: string;
  svc: string;
  info: number;
  warn: number;
  error: number;
  dictionaryVersion?: number;
}

export interface AggregatedDailyStats {
  info: number;
  warn: number;
  error: number;
  days: NexvillDailyStatsRow[];
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function utcDateParts(fromMs: number, toMs: number): string[] {
  const dates = new Set<string>();
  const cursor = new Date(fromMs);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    dates.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...dates].sort();
}

export async function fetchAggregatedDailyStats(options: {
  config: NexvillBucketConfig;
  client?: S3Client;
  env: string;
  service: string;
  timeFromMs: number;
  timeToMs: number;
}): Promise<AggregatedDailyStats> {
  const client = options.client ?? createS3Client(options.config);
  const { config, env, service, timeFromMs, timeToMs } = options;
  const days: NexvillDailyStatsRow[] = [];
  let info = 0;
  let warn = 0;
  let error = 0;

  for (const datePart of utcDateParts(timeFromMs, timeToMs)) {
    const key = `stats/daily/${env}/${service}/${datePart}.json`;
    try {
      const out = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      const bytes = await streamToBuffer(out.Body);
      if (bytes.length === 0) continue;
      const row = JSON.parse(bytes.toString("utf8")) as NexvillDailyStatsRow;
      if (typeof row.info === "number") info += row.info;
      if (typeof row.warn === "number") warn += row.warn;
      if (typeof row.error === "number") error += row.error;
      days.push(row);
    } catch (err: unknown) {
      const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
      if (name === "NoSuchKey" || name === "NotFound") continue;
      throw err;
    }
  }

  return { info, warn, error, days };
}
