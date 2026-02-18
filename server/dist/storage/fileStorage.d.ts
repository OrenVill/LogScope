import { LogEntry } from "../types";
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
     * Initialize storage (create directories if needed)
     */
    initialize(): Promise<void>;
}
export declare const createFileStorage: () => IFileStorage;
//# sourceMappingURL=fileStorage.d.ts.map