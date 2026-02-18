import { LogEntry } from "../types";

/**
 * In-memory query index for efficient log searches.
 */

export interface IQueryIndex {
  /**
   * Build index from existing logs
   */
  buildIndex(logs: LogEntry[]): Promise<void>;

  /**
   * Query logs with filters
   */
  query(filters: {
    timeFrom?: string;
    timeTo?: string;
    level?: string;
    subject?: string;
    text?: string;
    requestId?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: LogEntry[];
    total: number;
  }>;

  /**
   * Add a log to the index
   */
  addToIndex(log: LogEntry): void;

  /**
   * Get a log by ID from the index
   */
  getById(eventId: string): LogEntry | null;
}

// Stub for Phase 2 implementation
export const createQueryIndex = (): IQueryIndex => {
  return {
    buildIndex: async () => {
      throw new Error("Not implemented in Phase 1");
    },
    query: async () => {
      throw new Error("Not implemented in Phase 1");
    },
    addToIndex: () => {
      throw new Error("Not implemented in Phase 1");
    },
    getById: () => {
      throw new Error("Not implemented in Phase 1");
    },
  };
};
