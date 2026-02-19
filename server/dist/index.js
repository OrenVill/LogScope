"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./api/middleware/errorHandler");
const fileStorage_1 = require("./storage/fileStorage");
const storage_1 = require("./storage");
const logsRouter_1 = require("./api/routes/logsRouter");
const wsServer_1 = require("./ws/wsServer");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || "3000", 10);
const LOG_DIR = process.env.LOG_DIR || path_1.default.join(process.cwd(), "logs");
const MAX_INDEX_SIZE = parseInt(process.env.MAX_INDEX_SIZE || "10000", 10);
// Initialize storage and query index
const fileStorage = (0, fileStorage_1.createFileStorage)(LOG_DIR);
const queryIndex = (0, storage_1.createQueryIndex)(MAX_INDEX_SIZE);
// Create HTTP server for WebSocket support
const httpServer = http_1.default.createServer(app);
let wsLogServer;
// Middleware
app.use((0, cors_1.default)());
// Request size limit: 1MB for JSON payloads
// Requests larger than this will receive 413 Payload Too Large
app.use(express_1.default.json({ limit: "1mb" }));
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", wsClients: wsLogServer?.getClientCount() || 0 });
});
// Initialize and start server
(async () => {
    try {
        // Initialize storage (create directories if needed)
        await fileStorage.initialize();
        // Load existing logs and build index
        const backendLogs = await fileStorage.readLogs("node");
        const frontendLogs = await fileStorage.readLogs("browser");
        const allLogs = [...backendLogs, ...frontendLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        await queryIndex.buildIndex(allLogs);
        console.log(`Loaded ${allLogs.length} logs into query index`);
        // Initialize WebSocket server
        wsLogServer = new wsServer_1.WsLogServer(httpServer);
        console.log("WebSocket server initialized on /ws");
        // Mount API routes with WebSocket server
        app.use("/api/logs", (0, logsRouter_1.createLogsRouter)(fileStorage, queryIndex, wsLogServer));
        // Error handling middleware
        app.use(errorHandler_1.errorHandler);
        // Start HTTP server
        httpServer.listen(PORT, "127.0.0.1", () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
            console.log(`Log directory: ${LOG_DIR}`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
})();
//# sourceMappingURL=index.js.map