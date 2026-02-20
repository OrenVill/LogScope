import type { LogEntry, ApiResponse, SearchFilters, Pagination } from "../types/api";

/**
 * Retry configuration for failed requests
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 3000,
  backoffMultiplier: 2,
};

/**
 * Exponential backoff retry handler
 * Retries transient failures (network errors, 5xx, 429)
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryCount = 0
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // Success
    if (response.ok) {
      return response;
    }

    // Don't retry client errors (4xx), except 429 (rate limit)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      return response;
    }

    // Retry on 5xx and 429
    if (response.status >= 500 || response.status === 429) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delayMs = Math.min(
          RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
          RETRY_CONFIG.maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return fetchWithRetry(url, options, retryCount + 1);
      }
    }

    return response;
  } catch (error) {
    // Network error - retry
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delayMs = Math.min(
        RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
        RETRY_CONFIG.maxDelayMs
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, options, retryCount + 1);
    }

    // All retries exhausted
    throw error;
  }
}

/**
 * Client for interacting with the LogScope API
 */
export class LogsApiClient {
  baseUrl: string;
  // Internal WS state to prevent duplicate reconnect loops and allow clean shutdown
  private _ws: WebSocket | null = null;
  private _isConnecting = false; // prevents concurrent connection attempts
  private _reconnectAttempts = 0;
  private _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _shouldReconnect = true;

  constructor(baseUrl?: string) {
    // Use provided baseUrl, then VITE_API_URL env, then (dev) a sensible default backend,
    // finally fallback to same-origin. This makes local `npm run dev` work without
    // requiring the developer to export VITE_API_URL every time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viteEnv = (import.meta as any).env || {}

    if (baseUrl) {
      this.baseUrl = baseUrl;
      return;
    }

    // Respect explicit VITE_API_URL when provided (CI / playwright & explicit runs)
    if (viteEnv.VITE_API_URL) {
      this.baseUrl = viteEnv.VITE_API_URL;
      return;
    }

    // If running in Vite dev and no VITE_API_URL set, point at the default backend
    // (localhost:8000) so WebSocket/API calls work out of the box.
    if (viteEnv.DEV) {
      const defaultBackend = viteEnv.VITE_API_PROXY || 'http://localhost:8000'
      this.baseUrl = defaultBackend;
      return;
    }

    // Production / fallback: use same origin (frontend served from backend)
    const origin = window.location.origin;
    this.baseUrl = origin;
  }

  /**
   * Search logs with filters and pagination (returns summaries by default for better performance)
   */
  async searchLogs(
    filters: SearchFilters,
    pagination?: Pagination,
    lightweight: boolean = true
  ): Promise<ApiResponse<LogEntry[]>> {
    const params = new URLSearchParams();

    if (filters.timeFrom) params.append("timeFrom", filters.timeFrom);
    if (filters.timeTo) params.append("timeTo", filters.timeTo);
    if (filters.level) params.append("level", filters.level);
    if (filters.subject) params.append("subject", filters.subject);
    if (filters.text) params.append("text", filters.text);
    if (filters.requestId) params.append("requestId", filters.requestId);
    if (filters.sessionId) params.append("sessionId", filters.sessionId);
    if (pagination?.limit) params.append("limit", pagination.limit.toString());
    if (pagination?.offset) params.append("offset", pagination.offset.toString());
    params.append("lightweight", lightweight.toString());

    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/logs/search?${params.toString()}`);
      const data = await response.json();
      
      // If response is not ok, ensure error response is returned
      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to search logs",
          errorCode: data.errorCode || "HTTP_ERROR",
        };
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Get a single log entry by ID
   */
  async getLogById(eventId: string): Promise<ApiResponse<LogEntry>> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/api/logs/${eventId}`);
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get log",
          errorCode: data.errorCode || "HTTP_ERROR",
        };
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Get logs correlated by request ID
   */
  async getCorrelatedByRequestId(
    requestId: string,
    pagination?: Pagination
  ): Promise<ApiResponse<LogEntry[]>> {
    const params = new URLSearchParams();
    if (pagination?.limit) params.append("limit", pagination.limit.toString());
    if (pagination?.offset) params.append("offset", pagination.offset.toString());

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}/api/logs/correlation/request/${requestId}?${params.toString()}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get correlated logs",
          errorCode: data.errorCode || "HTTP_ERROR",
        };
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Get logs correlated by session ID
   */
  async getCorrelatedBySessionId(
    sessionId: string,
    pagination?: Pagination
  ): Promise<ApiResponse<LogEntry[]>> {
    const params = new URLSearchParams();
    if (pagination?.limit) params.append("limit", pagination.limit.toString());
    if (pagination?.offset) params.append("offset", pagination.offset.toString());

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}/api/logs/correlation/session/${sessionId}?${params.toString()}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get correlated logs",
          errorCode: data.errorCode || "HTTP_ERROR",
        };
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Pin a log entry so it is protected from automatic deletion
   */
  async starLog(eventId: string): Promise<void> {
    await fetchWithRetry(`${this.baseUrl}/api/logs/${eventId}/star`, { method: "POST" });
  }

  /**
   * Unpin a log entry so it becomes eligible for automatic deletion again
   */
  async unstarLog(eventId: string): Promise<void> {
    await fetchWithRetry(`${this.baseUrl}/api/logs/${eventId}/star`, { method: "DELETE" });
  }

  /**
   * Delete all log entries.
   * @param keepStarred - when true, pinned logs are preserved
   */
  async clearAllLogs(keepStarred = false): Promise<{ deleted: number; keptStarred: number }> {
    const params = keepStarred ? "?keepStarred=true" : "";
    const response = await fetchWithRetry(`${this.baseUrl}/api/logs/all${params}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to clear logs");
    return data.data as { deleted: number; keptStarred: number };
  }

  /**
   * Connect to WebSocket for real-time log streaming
   * Returns WebSocket instance for manual control, or null if connection fails
   * Includes automatic reconnection with exponential backoff
   */
  connectWebSocket(
    onMessage: (log: LogEntry) => void,
    onError?: (error: Error) => void,
    filters?: { level?: string; subject?: string }
  ): WebSocket | null {
    const maxReconnectAttempts = 5;

    // If a connection attempt is already in progress, return the pending ws
    if (this._isConnecting) {
      return this._ws;
    }

    // Reuse existing instance if already open/connecting
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return this._ws;
    }

    // Mark that a connect attempt has started and allow reconnection loop (can be turned off via closeWebSocket)
    this._isConnecting = true;
    this._shouldReconnect = true;
    // Reset the reconnect counter so a fresh manual connection always has full retry budget
    this._reconnectAttempts = 0;

    const createConnection = (): WebSocket | null => {
      try {
        const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
        const host = new URL(this.baseUrl).host;
        const ws = new WebSocket(`${protocol}://${host}/ws`);

        // store instance so callers can close/inspect it and so we can cancel reconnects
        this._ws = ws;

        ws.onopen = () => {
          // connection established -> clear connecting flag and reset reconnect state
          this._isConnecting = false;
          this._reconnectAttempts = 0;
          if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
            this._reconnectTimeout = null;
          }

          // Subscribe with filters if provided
          if (filters) {
            try {
              ws.send(
                JSON.stringify({
                  type: "subscribe",
                  filters,
                })
              );
            } catch (err) {
              console.error('Failed to send subscribe message:', err);
            }
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "log") {
              onMessage(message.data);
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror = (event) => {
          const error = new Error(`WebSocket error: ${event.type}`);
          if (onError) onError(error);
          console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
          // clear the stored reference for this closed socket
          if (this._ws === ws) this._ws = null;
          // A closed socket is no longer "connecting"
          this._isConnecting = false;

          // don't attempt to reconnect if caller requested shutdown
          if (!this._shouldReconnect) return;

          if (this._reconnectAttempts < maxReconnectAttempts) {
            this._reconnectAttempts++;
            const delayMs = Math.min(
              1000 * Math.pow(1.5, this._reconnectAttempts - 1),
              30000
            );
            // Clear any existing timeout before setting a new one
            if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
            this._reconnectTimeout = setTimeout(() => {
              console.log(`Reconnecting WebSocket (attempt ${this._reconnectAttempts}/${maxReconnectAttempts})...`);
              if (this._shouldReconnect) createConnection();
            }, delayMs);
          } else {
            const error = new Error("WebSocket reconnection failed after maximum attempts");
            if (onError) onError(error);
            console.error("WebSocket connection lost permanently:", error);
          }
        };

        return ws;
      } catch (error) {
        // clear in-progress flag so callers can retry later
        this._isConnecting = false;
        const wsError = new Error(`Failed to connect WebSocket: ${(error as Error).message}`);
        if (onError) onError(wsError);
        console.error("WebSocket connection error:", wsError);
        return null;
      }
    };

    const ws = createConnection();
    // if the createConnection returned null immediately, clear connecting flag
    if (!ws) this._isConnecting = false;
    return ws;
  }

  /**
   * Stop and cleanly close any WebSocket managed by the client and cancel reconnects
   */
  closeWebSocket(): void {
    this._shouldReconnect = false;
    this._isConnecting = false; // always reset — prevents the guard from blocking the next connect call

    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }

    if (!this._ws) return;

    const wsToClose = this._ws;
    this._ws = null; // clear reference before closing so no handler can observe a stale ref

    // Detach all handlers first so closing doesn't trigger a reconnect loop
    try { wsToClose.onopen = null } catch { /* ignore */ }
    try { wsToClose.onmessage = null } catch { /* ignore */ }
    try { wsToClose.onerror = null } catch { /* ignore */ }
    try { wsToClose.onclose = null } catch { /* ignore */ }

    // Close regardless of readyState (works for CONNECTING, OPEN, and CLOSING)
    try { wsToClose.close() } catch { /* ignore */ }
  }
}

// Export singleton instance
export const logsApi = new LogsApiClient();
