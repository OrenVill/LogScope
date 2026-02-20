import type { IFileStorage } from "../storage/fileStorage.js";
import type { IQueryIndex } from "../storage/index.js";
import type { IStarredStorage } from "../storage/starredStorage.js";

interface AutoCleanupOptions {
  fileStorage: IFileStorage;
  queryIndex: IQueryIndex;
  starredStorage: IStarredStorage;
  /** Logs older than this many milliseconds are deleted. Default: 3 600 000 (1 hour). */
  maxAgeMs: number;
  /** When combined log count exceeds this, the oldest non-starred logs are trimmed. Default: 500. */
  maxTotal: number;
  /** How many logs to delete when the capacity limit is hit. Default: 100. */
  deleteCount: number;
}

export const createAutoCleanup = (options: AutoCleanupOptions) => {
  const { fileStorage, queryIndex, starredStorage, maxAgeMs, maxTotal, deleteCount } = options;

  return {
    runCleanup: async (): Promise<void> => {
      try {
        const starredIds = starredStorage.getAll();

        // --- Time-based cleanup ---
        const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
        const [backendLogs, frontendLogs] = await Promise.all([
          fileStorage.readLogs("node"),
          fileStorage.readLogs("browser"),
        ]);
        const allLogs = [...backendLogs, ...frontendLogs];
        const totalBefore = allLogs.length;

        const expiredIds = allLogs
          .filter((log) => log.timestamp < cutoff && !starredIds.has(log.eventId))
          .map((log) => log.eventId);

        if (expiredIds.length > 0) {
          await fileStorage.deleteLogsByIds(expiredIds);
          queryIndex.removeFromIndex(expiredIds);
        }

        // --- Capacity-based cleanup ---
        // Read the current on-disk count after time-based removal to get an accurate number.
        const totalAfterTimeCleanup = allLogs.length - expiredIds.length;
        if (totalAfterTimeCleanup > maxTotal) {
          // Re-read to get up-to-date order (time-based deletion may have changed the files).
          const [backendAfter, frontendAfter] = await Promise.all([
            fileStorage.readLogs("node"),
            fileStorage.readLogs("browser"),
          ]);
          const remaining = [...backendAfter, ...frontendAfter].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Delete at least deleteCount, but always enough to get back under maxTotal in one pass
          const targetDeleteCount = Math.max(deleteCount, totalAfterTimeCleanup - maxTotal);

          const toDelete: string[] = [];
          for (const log of remaining) {
            if (toDelete.length >= targetDeleteCount) break;
            if (!starredIds.has(log.eventId)) {
              toDelete.push(log.eventId);
            }
          }

          if (toDelete.length > 0) {
            await fileStorage.deleteLogsByIds(toDelete);
            queryIndex.removeFromIndex(toDelete);
          } else if (totalAfterTimeCleanup > 0) {
            // All remaining logs are starred, cannot reduce further
          }
        }
      } catch (error) {
        console.error("[AutoCleanup] Unexpected error during cleanup:", error);
      }
    },
  };
};
