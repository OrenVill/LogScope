import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { LogEntry } from "../types";

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
 * Client connection with optional filters
 */
interface WsClient {
  id: string;
  ws: WebSocket;
  filters?: {
    level?: string;
    subject?: string;
  };
}

/**
 * WebSocket server for real-time log streaming
 */
export class WsLogServer {
  private wss: WebSocketServer;
  private clients: Map<string, WsClient> = new Map();
  private clientCounter: number = 0;

  constructor(httpServer: Server) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = `client-${++this.clientCounter}`;
      const client: WsClient = { id: clientId, ws };

      this.clients.set(clientId, client);
      console.log(`[WS] Client connected: ${clientId} (total: ${this.clients.size})`);

      // Send greeting
      ws.send(
        JSON.stringify({
          type: "connected",
          data: { clientId },
        })
      );

      // Handle incoming messages
      ws.on("message", (data: string) => {
        try {
          const message: WsMessage = JSON.parse(data);

          if (message.type === "subscribe") {
            // Apply filters
            if (message.filters) {
              client.filters = {
                level: message.filters.level,
                subject: message.filters.subject,
              };
            }
            console.log(`[WS] Client ${clientId} subscribed with filters:`, client.filters);

            ws.send(
              JSON.stringify({
                type: "subscribed",
                data: { filters: client.filters },
              })
            );
          } else if (message.type === "unsubscribe") {
            // Clear filters
            client.filters = undefined;
            ws.send(
              JSON.stringify({
                type: "unsubscribed",
              })
            );
          }
        } catch (error) {
          console.error(`[WS] Error processing message from ${clientId}:`, error);
          ws.send(
            JSON.stringify({
              type: "error",
              data: { message: "Failed to process message" },
            })
          );
        }
      });

      // Handle disconnect
      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      ws.on("error", (error) => {
        console.error(`[WS] Error for client ${clientId}:`, error);
      });
    });

    this.wss.on("error", (error) => {
      console.error("[WS] Server error:", error);
    });
  }

  /**
   * Broadcast a new log to all connected clients (applying their filters)
   */
  public broadcastLog(log: LogEntry): void {
    this.clients.forEach((client) => {
      // Apply client's filters if present
      if (client.filters) {
        if (
          client.filters.level &&
          log.level !== client.filters.level
        ) {
          return; // Skip if level doesn't match
        }
        if (
          client.filters.subject &&
          !log.subject.toLowerCase().includes(client.filters.subject.toLowerCase())
        ) {
          return; // Skip if subject doesn't match
        }
      }

      // Send log to client
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(
          JSON.stringify({
            type: "log",
            data: log,
          })
        );
      }
    });
  }

  /**
   * Get current connected client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close the WebSocket server
   */
  public close(): void {
    this.wss.close();
  }
}
