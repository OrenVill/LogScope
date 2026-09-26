import type { IQueryIndex } from "../storage/index.js";
import type { LogEntry, LogSummary } from "../types/index.js";
import type { NexvillBucketConfig } from "./bucketConfig.js";
import { createS3Client, fetchLogsFromBucket } from "./s3LogReader.js";
import { isNexvillEnv, isNexvillService } from "./nexvillMapper.js";

export class BucketQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BucketQueryValidationError";
  }
}

const toLogSummary = (log: LogEntry): LogSummary => ({
  eventId: log.eventId,
  timestamp: log.timestamp,
  level: log.level,
  subject: log.subject,
  message: log.message,
  source: {
    runtime: log.source.runtime,
    serviceName: log.source.serviceName,
  },
});

export function createBucketQueryIndex(config: NexvillBucketConfig): IQueryIndex {
  const client = createS3Client(config);
  const entryCache = new Map<string, LogEntry>();
  const CACHE_MAX = 20_000;

  const remember = (logs: LogEntry[]) => {
    for (const log of logs) {
      entryCache.set(log.eventId, log);
    }
    if (entryCache.size > CACHE_MAX) {
      const drop = entryCache.size - CACHE_MAX;
      const iter = entryCache.keys();
      for (let i = 0; i < drop; i++) {
        const k = iter.next().value;
        if (k) entryCache.delete(k);
      }
    }
  };

  const applyFilters = (
    logs: LogEntry[],
    filters: {
      timeFrom?: string;
      timeTo?: string;
      level?: string;
      subject?: string;
      text?: string;
      requestId?: string;
      sessionId?: string;
    }
  ) => {
    let results = logs;
    if (filters.timeFrom) {
      results = results.filter((log) => new Date(log.timestamp) >= new Date(filters.timeFrom!));
    }
    if (filters.timeTo) {
      results = results.filter((log) => new Date(log.timestamp) <= new Date(filters.timeTo!));
    }
    if (filters.level) {
      results = results.filter((log) => log.level === filters.level);
    }
    if (filters.subject) {
      results = results.filter((log) =>
        log.subject.toLowerCase().includes(filters.subject!.toLowerCase())
      );
    }
    if (filters.text) {
      const searchText = filters.text.toLowerCase();
      results = results.filter((log) => {
        const messageMatch = log.message.toLowerCase().includes(searchText);
        const dataStr = log.data
          ? typeof log.data === "string"
            ? log.data
            : JSON.stringify(log.data)
          : "";
        return messageMatch || dataStr.toLowerCase().includes(searchText);
      });
    }
    if (filters.requestId) {
      results = results.filter((log) => log.correlation.requestId === filters.requestId);
    }
    if (filters.sessionId) {
      results = results.filter((log) => log.correlation.sessionId === filters.sessionId);
    }
    results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return results;
  };

  return {
    buildIndex: async () => {},

    addToIndex: () => {},

    removeFromIndex: () => {},

    clearIndex: () => {
      entryCache.clear();
    },

    getById: (eventId: string) => entryCache.get(eventId) || null,

    query: async (filters) => {
      if (filters.env && !isNexvillEnv(filters.env)) {
        throw new BucketQueryValidationError(`Invalid env "${filters.env}"`);
      }
      if (filters.service && !isNexvillService(filters.service)) {
        throw new BucketQueryValidationError(`Invalid service "${filters.service}"`);
      }
      const env = filters.env && isNexvillEnv(filters.env) ? filters.env : config.defaultEnv;
      const service =
        filters.service && isNexvillService(filters.service)
          ? filters.service
          : config.defaultService;

      const now = Date.now();
      const defaultFrom = now - 60 * 60 * 1000;
      const timeFromMs = filters.timeFrom ? new Date(filters.timeFrom).getTime() : defaultFrom;
      const timeToMs = filters.timeTo ? new Date(filters.timeTo).getTime() : now;

      const raw = await fetchLogsFromBucket({
        config,
        client,
        env,
        service,
        timeFromMs,
        timeToMs,
        level: filters.level,
      });

      remember(raw);

      const filtered = applyFilters(raw, filters);
      const total = filtered.length;
      const offset = filters.offset || 0;
      const limit = filters.limit || 100;
      const page = filtered.slice(offset, offset + limit);
      const finalResults = filters.lightweight ? page.map(toLogSummary) : page;

      return { logs: finalResults, total };
    },
  };
}
