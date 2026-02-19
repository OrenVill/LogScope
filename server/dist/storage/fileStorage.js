"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileStorage = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const createFileStorage = (logDir) => {
    const getFilePath = (runtime) => {
        const filename = runtime === "node" ? "backend.json" : "frontend.json";
        return path_1.default.join(logDir, filename);
    };
    const readLogs = async (runtime) => {
        const filePath = getFilePath(runtime);
        try {
            const data = await fs_1.promises.readFile(filePath, "utf-8");
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
                    const data = await fs_1.promises.readFile(filePath, "utf-8");
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
                await fs_1.promises.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");
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
        initialize: async () => {
            try {
                await fs_1.promises.mkdir(logDir, { recursive: true });
            }
            catch (error) {
                console.error(`Error initializing log directory ${logDir}:`, error);
                throw error;
            }
        },
    };
};
exports.createFileStorage = createFileStorage;
//# sourceMappingURL=fileStorage.js.map