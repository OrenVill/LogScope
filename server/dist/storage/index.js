"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueryIndex = void 0;
/**
 * Convert a full LogEntry to a lightweight LogSummary
 */
const toLogSummary = (log) => ({
    eventId: log.eventId,
    timestamp: log.timestamp,
    level: log.level,
    subject: log.subject,
    message: log.message,
    source: {
        runtime: log.source.runtime,
        serviceName: log.source.serviceName,
    },
});
const createQueryIndex = (maxSize = 10000) => {
    let index = new Map();
    let allLogs = [];
    return {
        buildIndex: async (logs) => {
            index.clear();
            allLogs = [];
            // Keep only the latest maxSize logs
            const logsToIndex = logs.length > maxSize ? logs.slice(logs.length - maxSize) : logs;
            for (const log of logsToIndex) {
                index.set(log.eventId, log);
            }
            allLogs = logsToIndex;
        },
        addToIndex: (log) => {
            // If at capacity, remove oldest log
            if (allLogs.length >= maxSize) {
                const oldest = allLogs.shift();
                if (oldest) {
                    index.delete(oldest.eventId);
                }
            }
            index.set(log.eventId, log);
            allLogs.push(log);
        },
        getById: (eventId) => {
            return index.get(eventId) || null;
        },
        query: async (filters) => {
            let results = [...allLogs];
            // Filter by time range
            if (filters.timeFrom) {
                results = results.filter((log) => new Date(log.timestamp) >= new Date(filters.timeFrom));
            }
            if (filters.timeTo) {
                results = results.filter((log) => new Date(log.timestamp) <= new Date(filters.timeTo));
            }
            // Filter by level
            if (filters.level) {
                results = results.filter((log) => log.level === filters.level);
            }
            // Filter by subject
            if (filters.subject) {
                results = results.filter((log) => log.subject.toLowerCase().includes(filters.subject.toLowerCase()));
            }
            // Filter by text in message or data
            if (filters.text) {
                const searchText = filters.text.toLowerCase();
                results = results.filter((log) => {
                    const messageMatch = log.message.toLowerCase().includes(searchText);
                    const dataStr = log.data
                        ? typeof log.data === "string"
                            ? log.data
                            : JSON.stringify(log.data)
                        : "";
                    const dataMatch = dataStr.toLowerCase().includes(searchText);
                    return messageMatch || dataMatch;
                });
            }
            // Filter by request ID
            if (filters.requestId) {
                results = results.filter((log) => log.correlation.requestId === filters.requestId);
            }
            // Filter by session ID
            if (filters.sessionId) {
                results = results.filter((log) => log.correlation.sessionId === filters.sessionId);
            }
            // Calculate total before pagination
            const total = results.length;
            // Apply pagination
            const offset = filters.offset || 0;
            const limit = filters.limit || 100;
            const paginatedResults = results.slice(offset, offset + limit);
            // Convert to summaries if lightweight mode is enabled
            const finalResults = filters.lightweight
                ? paginatedResults.map(toLogSummary)
                : paginatedResults;
            return {
                logs: finalResults,
                total,
            };
        },
    };
};
exports.createQueryIndex = createQueryIndex;
//# sourceMappingURL=index.js.map