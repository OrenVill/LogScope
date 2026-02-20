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
import { createStarredStorage } from "./storage/starredStorage.js";
import { createAutoCleanup } from "./cleanup/autoCleanup.js";
import { createLogsRouter } from "./api/routes/logsRouter.js";
import { WsLogServer } from "./ws/wsServer.js";
// Load environment variables
// Prefer a `.env` in the server folder; if not present, fall back to repository root `.env`.
// This ensures running from the repository root (root `npm start`) can still set values
// such as PORT in the repo-level `.env`.
const serverEnvPath = path.resolve(process.cwd(), '.env');
const repoEnvPath = path.resolve(process.cwd(), '..', '.env');
if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
    console.log(`Loaded environment from ${serverEnvPath}`);
}
else if (fs.existsSync(repoEnvPath)) {
    dotenv.config({ path: repoEnvPath });
    console.log(`Loaded environment from ${repoEnvPath}`);
}
else {
    dotenv.config();
    console.log('No .env file found in server/ or repo root; using process.env');
}
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const MAX_INDEX_SIZE = parseInt(process.env.MAX_INDEX_SIZE || "10000", 10);
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || "10000", 10); // 10 sec
const LOG_MAX_AGE_MS = parseInt(process.env.LOG_MAX_AGE_MS || "3600000", 10); // 1 hour
const LOG_MAX_TOTAL = parseInt(process.env.LOG_MAX_TOTAL || "500", 10);
const LOG_DELETE_COUNT = parseInt(process.env.LOG_DELETE_COUNT || "100", 10);
// Initialize storage and query index
const fileStorage = createFileStorage(LOG_DIR);
const queryIndex = createQueryIndex(MAX_INDEX_SIZE);
const starredStorage = createStarredStorage(LOG_DIR);
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
        // Load starred IDs from disk
        await starredStorage.load();
        console.log(`Loaded ${starredStorage.getAll().size} starred log(s)`);
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
        app.use("/api/logs", createLogsRouter(fileStorage, queryIndex, wsLogServer, starredStorage));
        // Start auto-cleanup service
        const autoCleanup = createAutoCleanup({
            fileStorage,
            queryIndex,
            starredStorage,
            maxAgeMs: LOG_MAX_AGE_MS,
            maxTotal: LOG_MAX_TOTAL,
            deleteCount: LOG_DELETE_COUNT,
        });
        setInterval(() => autoCleanup.runCleanup(), CLEANUP_INTERVAL_MS);
        console.log(`Auto-cleanup scheduled every ${CLEANUP_INTERVAL_MS / 1000}s ` +
            `(max age: ${LOG_MAX_AGE_MS / 1000}s, max total: ${LOG_MAX_TOTAL}, delete count: ${LOG_DELETE_COUNT})`);
        // Serve frontend assets if a built `dist` exists (either bundled into server
        // or `web/dist` in the repo). This makes the server usable in production mode
        // and when you run the repo-level `npm start` after building the web.
        // ESM-safe __dirname
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bundledDist = path.resolve(__dirname, "dist");
        const siblingWebDist = path.resolve(__dirname, "..", "..", "web", "dist");
        const resolvedClientDist = process.env.FRONTEND_DIST
            ? path.resolve(process.env.FRONTEND_DIST)
            : fs.existsSync(bundledDist)
                ? bundledDist
                : siblingWebDist;
        if (fs.existsSync(resolvedClientDist)) {
            console.log(`Serving frontend from: ${resolvedClientDist}`);
            app.use(express.static(resolvedClientDist));
            // SPA fallback - serve index.html for unknown non-API routes
            app.get("*", (req, res) => {
                res.sendFile(path.join(resolvedClientDist, "index.html"));
            });
        }
        else if (process.env.NODE_ENV === "production") {
            console.warn("NODE_ENV=production but no frontend build found at:", resolvedClientDist);
        }
        // Error handling middleware
        app.use(errorHandler);
        // Start HTTP server
        // Bind host can be overridden with BIND_HOST env var. Default is undefined
        // (Node will listen on all interfaces, supporting both IPv4 and IPv6 localhost).
        const BIND_HOST = process.env.BIND_HOST || undefined;
        httpServer.listen(PORT, BIND_HOST, () => {
            const hostDisplay = BIND_HOST ?? 'localhost';
            console.log(`Server running on http://${hostDisplay}:${PORT}`);
            console.log(`WebSocket endpoint: ws://${hostDisplay}:${PORT}/ws`);
            console.log(`Log directory: ${LOG_DIR}`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
})();
//# sourceMappingURL=index.js.map