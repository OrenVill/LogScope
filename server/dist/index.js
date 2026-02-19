import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { errorHandler } from "./api/middleware/errorHandler.js";
import { createFileStorage } from "./storage/fileStorage.js";
import { createQueryIndex } from "./storage/index.js";
import { createLogsRouter } from "./api/routes/logsRouter.js";
import { WsLogServer } from "./ws/wsServer.js";
// Load environment variables
dotenv.config();
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const MAX_INDEX_SIZE = parseInt(process.env.MAX_INDEX_SIZE || "10000", 10);
// Initialize storage and query index
const fileStorage = createFileStorage(LOG_DIR);
const queryIndex = createQueryIndex(MAX_INDEX_SIZE);
// Create HTTP server for WebSocket support
const httpServer = http.createServer(app);
let wsLogServer;
// Middleware
app.use(cors());
// Request size limit: 1MB for JSON payloads
// Requests larger than this will receive 413 Payload Too Large
app.use(express.json({ limit: "1mb" }));
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
        wsLogServer = new WsLogServer(httpServer);
        console.log("WebSocket server initialized on /ws");
        // Mount API routes with WebSocket server
        app.use("/api/logs", createLogsRouter(fileStorage, queryIndex, wsLogServer));
        // Serve frontend assets in production (built by Vite -> web/dist)
        if (process.env.NODE_ENV === "production") {
            // ESM-safe __dirname
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            // Possible frontend locations (order of preference):
            // 1) copy of frontend inside server dist (e.g. bundled into server artifact)
            //    -> runtime path: <server>/dist (so we check `<__dirname>/dist`)
            // 2) sibling web/dist during local deploy (repo layout)
            //    -> <repo-root>/web/dist
            // 3) override via FRONTEND_DIST env var
            const bundledDist = path.resolve(__dirname, "dist");
            const siblingWebDist = path.resolve(__dirname, "..", "..", "web", "dist");
            const clientDist = process.env.FRONTEND_DIST
                ? path.resolve(process.env.FRONTEND_DIST)
                : fs.existsSync(bundledDist)
                    ? bundledDist
                    : siblingWebDist;
            console.log(`Serving frontend from: ${clientDist}`);
            app.use(express.static(clientDist));
            // SPA fallback - serve index.html for unknown non-API routes
            app.get("*", (req, res) => {
                res.sendFile(path.join(clientDist, "index.html"));
            });
        }
        // Error handling middleware
        app.use(errorHandler);
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