import { promises as fs } from "fs";
import path from "path";
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
  deleteLogsByIds(ids: string[]): Promise<{ backendDeleted: number; frontendDeleted: number }>;

  /**
   * Get the total number of log entries across both files without loading all data.
   */
  getTotalLogCount(): Promise<number>;

  /**
   * Delete all logs. If keepStarredIds is provided, only logs NOT in that set are deleted.
   */
  clearLogs(keepStarredIds?: Set<string>): Promise<{ backendDeleted: number; frontendDeleted: number }>;

  /**
   * Initialize storage (create directories if needed)
   */
  initialize(): Promise<void>;
}

export const createFileStorage = (logDir: string): IFileStorage => {
  const getFilePath = (runtime: "node" | "browser"): string => {
    const filename = runtime === "node" ? "backend.json" : "frontend.json";
    return path.join(logDir, filename);
  };

  const readLogs = async (runtime: "node" | "browser"): Promise<LogEntry[]> => {
    const filePath = getFilePath(runtime);
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  };

  return {
    appendLog: async (log: LogEntry) => {
      const filePath = getFilePath(log.source.runtime);
      try {
        // Read existing logs
        let logs: LogEntry[] = [];
        try {
          const data = await fs.readFile(filePath, "utf-8");
          logs = JSON.parse(data);
        } catch (error: any) {
          // File doesn't exist or is empty, start with empty array
          if (error.code !== "ENOENT") throw error;
        }

        // Append new log
        logs.push(log);

        // Write back to file
        await fs.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");
      } catch (error) {
        console.error(`Error appending log to ${filePath}:`, error);
        throw error;
      }
    },

    readLogs,

    getLogById: async (eventId: string) => {
      // Check both runtime files
      for (const runtime of ["node" as const, "browser" as const]) {
        const logs = await readLogs(runtime);
        const log = logs.find((l: LogEntry) => l.eventId === eventId);
        if (log) return log;
      }
      return null;
    },

    deleteLogsByIds: async (ids: string[]) => {
      const idSet = new Set(ids);
      let backendDeleted = 0;
      let frontendDeleted = 0;

      for (const runtime of ["node" as const, "browser" as const]) {
        const filePath = getFilePath(runtime);
        const logs = await readLogs(runtime);
        const filtered = logs.filter((l) => !idSet.has(l.eventId));
        const deleted = logs.length - filtered.length;
        if (deleted > 0) {
          await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), "utf-8");
          if (runtime === "node") backendDeleted = deleted;
          else frontendDeleted = deleted;
        }
      }

      return { backendDeleted, frontendDeleted };
    },

    getTotalLogCount: async () => {
      const [backend, frontend] = await Promise.all([
        readLogs("node"),
        readLogs("browser"),
      ]);
      return backend.length + frontend.length;
    },

    clearLogs: async (keepStarredIds?: Set<string>) => {
      let backendDeleted = 0;
      let frontendDeleted = 0;

      for (const runtime of ["node" as const, "browser" as const]) {
        const filePath = getFilePath(runtime);
        const logs = await readLogs(runtime);
        const kept = keepStarredIds
          ? logs.filter((l) => keepStarredIds.has(l.eventId))
          : [];
        backendDeleted += runtime === "node" ? logs.length - kept.length : 0;
        frontendDeleted += runtime === "browser" ? logs.length - kept.length : 0;
        await fs.writeFile(filePath, JSON.stringify(kept, null, 2), "utf-8");
      }

      return { backendDeleted, frontendDeleted };
    },

    initialize: async () => {
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (error) {
        console.error(`Error initializing log directory ${logDir}:`, error);
        throw error;
      }
    },
  };
};
