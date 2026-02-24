import { LogEntry } from "../types/index.js";
/**
 * File-based storage for logs.
 * Logs are stored in separate JSON files for backend and frontend.
 */
export interface IFileStorage {
    /**
     * Append a log entry to the appropriate file (backend.json or frontend.json)
     */
    appendLog(log: LogEntry): Promise<void>;
    /**
     * Read all logs from a file
     */
    readLogs(runtime: "node" | "browser"): Promise<LogEntry[]>;
    /**
     * Get a specific log by event ID
     */
    getLogById(eventId: string): Promise<LogEntry | null>;
    /**
     * Delete log entries by their event IDs from both files.
     * Returns count of deleted entries per file.
     */
    deleteLogsByIds(ids: string[]): Promise<{
        backendDeleted: number;
        frontendDeleted: number;
    }>;
    /**
     * Get the total number of log entries across both files without loading all data.
     */
    getTotalLogCount(): Promise<number>;
    /**
     * Delete all logs. If keepStarredIds is provided, only logs NOT in that set are deleted.
     */
    clearLogs(keepStarredIds?: Set<string>): Promise<{
        backendDeleted: number;
        frontendDeleted: number;
    }>;
    /**
     * Initialize storage (create directories if needed)
     */
    initialize(): Promise<void>;
}
export declare const createFileStorage: (logDir: string) => IFileStorage;
//# sourceMappingURL=fileStorage.d.ts.map