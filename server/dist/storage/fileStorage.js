import { promises as fs } from "fs";
import path from "path";
export const createFileStorage = (logDir) => {
    const getFilePath = (runtime) => {
        const filename = runtime === "node" ? "backend.json" : "frontend.json";
        return path.join(logDir, filename);
    };
    const readLogs = async (runtime) => {
        const filePath = getFilePath(runtime);
        try {
            const data = await fs.readFile(filePath, "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    };
    return {
        appendLog: async (log) => {
            const filePath = getFilePath(log.source.runtime);
            try {
                // Read existing logs
                let logs = [];
                try {
                    const data = await fs.readFile(filePath, "utf-8");
                    logs = JSON.parse(data);
                }
                catch (error) {
                    // File doesn't exist or is empty, start with empty array
                    if (error.code !== "ENOENT")
                        throw error;
                }
                // Append new log
                logs.push(log);
                // Write back to file
                await fs.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");
            }
            catch (error) {
                console.error(`Error appending log to ${filePath}:`, error);
                throw error;
            }
        },
        readLogs,
        getLogById: async (eventId) => {
            // Check both runtime files
            for (const runtime of ["node", "browser"]) {
                const logs = await readLogs(runtime);
                const log = logs.find((l) => l.eventId === eventId);
                if (log)
                    return log;
            }
            return null;
        },
        deleteLogsByIds: async (ids) => {
            const idSet = new Set(ids);
            let backendDeleted = 0;
            let frontendDeleted = 0;
            for (const runtime of ["node", "browser"]) {
                const filePath = getFilePath(runtime);
                const logs = await readLogs(runtime);
                const filtered = logs.filter((l) => !idSet.has(l.eventId));
                const deleted = logs.length - filtered.length;
                if (deleted > 0) {
                    await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), "utf-8");
                    if (runtime === "node")
                        backendDeleted = deleted;
                    else
                        frontendDeleted = deleted;
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
        clearLogs: async (keepStarredIds) => {
            let backendDeleted = 0;
            let frontendDeleted = 0;
            for (const runtime of ["node", "browser"]) {
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
            }
            catch (error) {
                console.error(`Error initializing log directory ${logDir}:`, error);
                throw error;
            }
        },
    };
};
//# sourceMappingURL=fileStorage.js.map