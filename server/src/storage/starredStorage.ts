import { promises as fs } from "fs";
import path from "path";

export interface IStarredStorage {
  /** Load starred IDs from disk into memory. Call once at startup. */
  load(): Promise<void>;
  /** Star a log entry. Persists immediately. */
  add(eventId: string): Promise<void>;
  /** Unstar a log entry. Persists immediately. */
  remove(eventId: string): Promise<void>;
  /** Check if a log entry is starred (in-memory, O(1)). */
  isStarred(eventId: string): boolean;
  /** Return a snapshot of all starred event IDs. */
  getAll(): Set<string>;
  /** Remove all starred IDs (use when all logs are deleted). Persists immediately. */
  clear(): Promise<void>;
}

export const createStarredStorage = (logDir: string): IStarredStorage => {
  const filePath = path.join(logDir, "starred.json");
  let starred: Set<string> = new Set();

  const persist = async (): Promise<void> => {
    await fs.writeFile(filePath, JSON.stringify([...starred], null, 2), "utf-8");
  };

  return {
    load: async () => {
      try {
        const data = await fs.readFile(filePath, "utf-8");
        const ids: string[] = JSON.parse(data);
        starred = new Set(ids.filter((id) => typeof id === "string"));
      } catch (error: any) {
        if (error.code === "ENOENT") {
          starred = new Set();
        } else {
          throw error;
        }
      }
    },

    add: async (eventId: string) => {
      starred.add(eventId);
      await persist();
    },

    remove: async (eventId: string) => {
      starred.delete(eventId);
      await persist();
    },

    isStarred: (eventId: string) => starred.has(eventId),

    getAll: () => new Set(starred),

    clear: async () => {
      starred.clear();
      await persist();
    },
  };
};
