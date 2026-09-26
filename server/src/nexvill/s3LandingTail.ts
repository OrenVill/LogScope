import type { S3Client } from "@aws-sdk/client-s3";
import type { NexvillBucketConfig } from "./bucketConfig.js";
import type { WsLogServer } from "../ws/wsServer.js";
import { currentUtcHourSlot, readLandingEntriesForSlot } from "./landingHour.js";

const POLL_MS = 5_000;

/**
 * Polls `landing/` for the current UTC hour and pushes new rows over WebSocket (S3 read-only mode).
 */
export class S3LandingTailPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly seenByScope = new Map<string, Set<string>>();
  private lastHourKey = "";

  constructor(
    private readonly config: NexvillBucketConfig,
    private readonly client: S3Client,
    private readonly wsServer: WsLogServer
  ) {}

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scopeKey(env: string, service: string, slot: { datePart: string; hourPart: string }): string {
    return `${env}|${service}|${slot.datePart}|${slot.hourPart}`;
  }

  private async poll(): Promise<void> {
    if (this.wsServer.getClientCount() === 0) return;

    const scopes = this.wsServer.getActiveArchiveScopes(this.config.defaultEnv, this.config.defaultService);
    if (scopes.length === 0) return;

    const slot = currentUtcHourSlot();
    const hourKey = `${slot.datePart}|${slot.hourPart}`;
    if (hourKey !== this.lastHourKey) {
      this.seenByScope.clear();
      this.lastHourKey = hourKey;
    }

    for (const { env, service } of scopes) {
      const sk = this.scopeKey(env, service, slot);
      let seen = this.seenByScope.get(sk);
      if (!seen) {
        seen = new Set();
        this.seenByScope.set(sk, seen);
      }

      try {
        const entries = await readLandingEntriesForSlot({
          client: this.client,
          bucket: this.config.bucket,
          env,
          service,
          slot,
        });
        for (const entry of entries) {
          if (seen.has(entry.eventId)) continue;
          seen.add(entry.eventId);
          this.wsServer.broadcastLog(entry);
        }
      } catch (err) {
        console.error(`[Archive tail] poll failed env=${env} service=${service}:`, err);
      }
    }
  }
}
