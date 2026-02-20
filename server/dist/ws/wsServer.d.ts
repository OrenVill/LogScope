import { Server } from "http";
import { LogEntry } from "../types/index.js";
/**
 * WebSocket message types
 */
export interface WsMessage {
    type: "subscribe" | "unsubscribe" | "log" | "error";
    data?: any;
    filters?: {
        level?: string;
        subject?: string;
    };
}
/**
 * WebSocket server for real-time log streaming
 */
export declare class WsLogServer {
    private wss;
    private clients;
    private clientCounter;
    constructor(httpServer: Server);
    /**
     * Broadcast a new log to all connected clients (applying their filters)
     */
    broadcastLog(log: LogEntry): void;
    /**
     * Get current connected client count
     */
    getClientCount(): number;
    /**
     * Close the WebSocket server
     */
    close(): void;
}
//# sourceMappingURL=wsServer.d.ts.map