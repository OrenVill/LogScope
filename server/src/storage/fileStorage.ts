import { promises as fs } from "fs";
import path from "path";
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
