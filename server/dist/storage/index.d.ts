import { LogEntry, LogSummary } from "../types/index.js";
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
        lightweight?: boolean;
    }): Promise<{
        logs: (LogEntry | LogSummary)[];
        total: number;
    }>;
    /**
     * Add a log to the index
     */
    addToIndex(log: LogEntry): void;
    /**
     * Remove log entries from the index by their event IDs
     */
    removeFromIndex(eventIds: string[]): void;
    /**
     * Clear all entries from the index. Optionally keep specific event IDs.
     */
    clearIndex(keepEventIds?: string[]): void;
    /**
     * Get a log by ID from the index
     */
    getById(eventId: string): LogEntry | null;
}
export declare const createQueryIndex: (maxSize?: number) => IQueryIndex;
//# sourceMappingURL=index.d.ts.map