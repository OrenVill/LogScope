"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogsRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const validation_1 = require("../middleware/validation");
const createLogsRouter = (storage, queryIndex, wsServer) => {
    const router = (0, express_1.Router)();
    /**
     * POST /api/logs/collect
     * Collect a log entry from frontend or backend
     */
    router.post("/collect", validation_1.rateLimitMiddleware, validation_1.validateLogEntry, async (req, res) => {
        try {
            const { timestamp, level, subject, message, data, source, correlation, } = req.body;
            // Generate event ID on server
            const eventId = (0, uuid_1.v4)();
            // Create log entry
            const logEntry = {
                eventId,
                timestamp,
                level,
                subject,
                message: message || "",
                data: data,
                source: {
                    function: source.function || "unknown",
                    file: source.file || "unknown",
                    process: source.process || "unknown",
                    runtime: source.runtime,
                    serviceName: source.serviceName || "unknown",
                },
                correlation: correlation || {},
            };
            // Persist to storage
            await storage.appendLog(logEntry);
            // Add to query index
            queryIndex.addToIndex(logEntry);
            // Broadcast to WebSocket clients
            if (wsServer) {
                wsServer.broadcastLog(logEntry);
            }
            // Return success response
            res.status(201).json({
                success: true,
                data: {
                    eventId: logEntry.eventId,
                    timestamp: logEntry.timestamp,
                },
            });
        }
        catch (error) {
            console.error("Error collecting log:", error);
            res.status(500).json({
                success: false,
                error: "Failed to collect log",
                errorCode: "SERVER_ERROR",
            });
        }
    });
    /**
     * GET /api/logs/search
     * Search and filter logs with various criteria
     * Query parameters:
     *   - timeFrom: ISO 8601 timestamp (inclusive)
     *   - timeTo: ISO 8601 timestamp (inclusive)
     *   - level: log level (debug|info|warn|error|success)
     *   - subject: search in subject (case-insensitive partial match)
     *   - text: search in content (case-insensitive partial match)
     *   - requestId: correlation request ID
     *   - sessionId: correlation session ID
     *   - limit: number of results per page (default: 100, max: 1000)
     *   - offset: number of results to skip (default: 0)
     */
    router.get("/search", validation_1.validateSearchParams, async (req, res) => {
        try {
            const { timeFrom, timeTo, level, subject, text, requestId, sessionId, limit = 100, offset = 0, } = req.query;
            // Validate pagination parameters
            const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
            const parsedOffset = Math.max(parseInt(offset) || 0, 0);
            // Execute query
            const result = await queryIndex.query({
                timeFrom: timeFrom,
                timeTo: timeTo,
                level: level,
                subject: subject,
                text: text,
                requestId: requestId,
                sessionId: sessionId,
                limit: parsedLimit,
                offset: parsedOffset,
            });
            res.json({
                success: true,
                data: result.logs,
                total: result.total,
                limit: parsedLimit,
                offset: parsedOffset,
            });
        }
        catch (error) {
            console.error("Error searching logs:", error);
            res.status(500).json({
                success: false,
                error: "Failed to search logs",
                errorCode: "SERVER_ERROR",
            });
        }
    });
    /**
     * GET /api/logs/correlation/request/:requestId
     * Find all logs correlated by request ID
     */
    router.get("/correlation/request/:requestId", async (req, res) => {
        try {
            const { requestId } = req.params;
            const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);
            const result = await queryIndex.query({
                requestId,
                limit,
                offset,
            });
            res.json({
                success: true,
                data: result.logs,
                total: result.total,
                limit,
                offset,
            });
        }
        catch (error) {
            console.error("Error querying by request ID:", error);
            res.status(500).json({
                success: false,
                error: "Failed to query logs",
                errorCode: "SERVER_ERROR",
            });
        }
    });
    /**
     * GET /api/logs/correlation/session/:sessionId
     * Find all logs correlated by session ID
     */
    router.get("/correlation/session/:sessionId", async (req, res) => {
        try {
            const { sessionId } = req.params;
            const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);
            const result = await queryIndex.query({
                sessionId,
                limit,
                offset,
            });
            res.json({
                success: true,
                data: result.logs,
                total: result.total,
                limit,
                offset,
            });
        }
        catch (error) {
            console.error("Error querying by session ID:", error);
            res.status(500).json({
                success: false,
                error: "Failed to query logs",
                errorCode: "SERVER_ERROR",
            });
        }
    });
    /**
     * GET /api/logs/health
     * Diagnostic endpoint to check storage health
     */
    router.get("/health", async (req, res) => {
        try {
            const backendLogs = await storage.readLogs("node");
            const frontendLogs = await storage.readLogs("browser");
            res.json({
                success: true,
                data: {
                    backend: { count: backendLogs.length },
                    frontend: { count: frontendLogs.length },
                    total: backendLogs.length + frontendLogs.length,
                },
            });
        }
        catch (error) {
            console.error("Error checking health:", error);
            res.status(500).json({
                success: false,
                error: "Failed to check health",
                errorCode: "SERVER_ERROR",
            });
        }
    });
    return router;
};
exports.createLogsRouter = createLogsRouter;
//# sourceMappingURL=logsRouter.js.map