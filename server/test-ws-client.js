#!/usr/bin/env node

/**
 * WebSocket client test for real-time log streaming
 * Tests subscription and receiving broadcasted logs
 */

const WebSocket = require("ws");

const url = "ws://localhost:3000/ws";
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000;

function connect() {
  console.log(`[Test Client] Connecting to ${url}...`);
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("[Test Client] Connected!");

    // Subscribe with filter for "info" level logs
    const subscribeMsg = {
      type: "subscribe",
      filters: {
        level: "info",
      },
    };
    console.log("[Test Client] Sending subscribe message:", subscribeMsg);
    ws.send(JSON.stringify(subscribeMsg));
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      console.log("[Test Client] Received message:", JSON.stringify(message, null, 2));
    } catch (e) {
      console.log("[Test Client] Received raw data:", data);
    }
  });

  ws.on("close", () => {
    console.log("[Test Client] Connection closed");
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(
        `[Test Client] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`
      );
      setTimeout(connect, reconnectDelay);
    }
  });

  ws.on("error", (error) => {
    console.error("[Test Client] Error:", error.message);
  });
}

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n[Test Client] Exiting...");
  process.exit(0);
});

connect();
