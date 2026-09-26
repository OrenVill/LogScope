import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { NexvillBucketConfig } from "./bucketConfig.js";
import { decodeGroupedLines } from "./groupedDecoder.js";
import type { DecodedEvent } from "./groupedTypes.js";
import type { LogEntry } from "../types/index.js";
import { decodedEventToLogEntry } from "./nexvillMapper.js";
import { readLandingEntriesForSlot, shouldReadLandingForHour } from "./landingHour.js";
import { decodeZstdToUtf8 } from "./zstdDecode.js";

export type HourSlot = { datePart: string; hourPart: string };

export function createS3Client(config: NexvillBucketConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });
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

export async function objectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    throw err;
  }
}

export async function getObjectBytes(client: S3Client, bucket: string, key: string): Promise<Buffer | null> {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return streamToBuffer(out.Body);
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

async function decodeZstdNdjson(bytes: Buffer): Promise<string> {
  return decodeZstdToUtf8(bytes);
}

/** UTC hour buckets from timeFrom (inclusive) through timeTo (inclusive). */
export function listHourSlots(fromMs: number, toMs: number, maxHours: number): HourSlot[] {
  const slots: HourSlot[] = [];
  const cursor = new Date(fromMs);
  cursor.setUTCMinutes(0, 0, 0);

  const end = new Date(toMs);
  end.setUTCMinutes(0, 0, 0);

  while (cursor.getTime() <= end.getTime() && slots.length < maxHours) {
    const iso = cursor.toISOString();
    slots.push({ datePart: iso.slice(0, 10), hourPart: iso.slice(11, 13) });
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  if (cursor.getTime() <= end.getTime()) {
    throw new Error(`Time range exceeds maximum of ${maxHours} hours per query`);
  }

  return slots;
}

function tierForLevelFilter(level: string | undefined): { info: boolean; durable: boolean } {
  if (!level) return { info: true, durable: true };
  const l = level.toLowerCase();
  if (l === "info" || l === "debug" || l === "success") return { info: true, durable: false };
  if (l === "warn") return { info: false, durable: true };
  if (l === "error" || l === "critical") return { info: false, durable: true };
  return { info: true, durable: true };
}

export async function listLandingKeys(
  client: S3Client,
  bucket: string,
  env: string,
  service: string,
  slot: HourSlot
): Promise<string[]> {
  const prefix = `landing/${env}/${service}/date=${slot.datePart}/hour=${slot.hourPart}/`;
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of out.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function fetchLogsFromBucket(options: {
  config: NexvillBucketConfig;
  client: S3Client;
  env: string;
  service: string;
  timeFromMs: number;
  timeToMs: number;
  level?: string;
}): Promise<LogEntry[]> {
  const { config, client, env, service, timeFromMs, timeToMs, level } = options;
  const slots = listHourSlots(timeFromMs, timeToMs, config.maxHoursPerQuery);
  const tiers = tierForLevelFilter(level);
  const entries: LogEntry[] = [];

  for (const slot of slots) {
    const infoKey = `info/${env}/${service}/date=${slot.datePart}/hour=${slot.hourPart}.ndjson.zst`;
    const durableKey = `durable/${env}/${service}/date=${slot.datePart}/hour=${slot.hourPart}.ndjson.zst`;
    const hasInfoObject = await objectExists(client, config.bucket, infoKey);
    const hasDurableObject = await objectExists(client, config.bucket, durableKey);

    if (tiers.info && hasInfoObject) {
      const bytes = await getObjectBytes(client, config.bucket, infoKey);
      if (bytes && bytes.length > 0) {
        const text = await decodeZstdNdjson(bytes);
        const decoded: DecodedEvent[] = decodeGroupedLines(text.split("\n"));
        for (const event of decoded) {
          entries.push(decodedEventToLogEntry(event, env, service));
        }
      }
    }

    if (tiers.durable && hasDurableObject) {
      const bytes = await getObjectBytes(client, config.bucket, durableKey);
      if (bytes && bytes.length > 0) {
        const text = await decodeZstdNdjson(bytes);
        const decoded: DecodedEvent[] = decodeGroupedLines(text.split("\n"));
        for (const event of decoded) {
          entries.push(decodedEventToLogEntry(event, env, service));
        }
      }
    }

    if (
      shouldReadLandingForHour({
        includeLanding: config.includeLanding,
        hasInfoObject,
        hasDurableObject,
      })
    ) {
      const landingEntries = await readLandingEntriesForSlot({
        client,
        bucket: config.bucket,
        env,
        service,
        slot,
      });
      entries.push(...landingEntries);
    }
  }

  return entries.filter((log) => {
    const t = new Date(log.timestamp).getTime();
    return t >= timeFromMs && t <= timeToMs;
  });
}
