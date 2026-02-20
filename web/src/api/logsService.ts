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

  constructor(baseUrl?: string) {
    // Use provided baseUrl, then VITE_API_URL env, then auto-detect same-origin.
    if (baseUrl) {
      this.baseUrl = baseUrl;
      return;
    }

    // Vite-provided env override (set at build time)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viteUrl = (import.meta as any).env?.VITE_API_URL;
    if (viteUrl) {
      this.baseUrl = viteUrl;
      return;
    }

    // Default: use same origin as the page (works when frontend is served by the backend)
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
   * Connect to WebSocket for real-time log streaming
   * Returns WebSocket instance for manual control, or null if connection fails
   * Includes automatic reconnection with exponential backoff
   */
  connectWebSocket(
    onMessage: (log: LogEntry) => void,
    onError?: (error: Error) => void,
    filters?: { level?: string; subject?: string }
  ): WebSocket | null {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const createConnection = (): WebSocket | null => {
      try {
        const protocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
        const host = new URL(this.baseUrl).host;
        const ws = new WebSocket(`${protocol}://${host}/ws`);

        ws.onopen = () => {
          reconnectAttempts = 0; // Reset on successful connection
          
          // Subscribe with filters if provided
          if (filters) {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                filters,
              })
            );
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
          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delayMs = Math.min(
              1000 * Math.pow(1.5, reconnectAttempts - 1),
              30000
            );
            // Clear any existing timeout before setting a new one
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
              console.log(`Reconnecting WebSocket (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
              createConnection();
            }, delayMs);
          } else {
            const error = new Error("WebSocket reconnection failed after maximum attempts");
            if (onError) onError(error);
            console.error("WebSocket connection lost permanently:", error);
          }
        };

        return ws;
      } catch (error) {
        const wsError = new Error(`Failed to connect WebSocket: ${(error as Error).message}`);
        if (onError) onError(wsError);
        console.error("WebSocket connection error:", wsError);
        return null;
      }
    };

    return createConnection();
  }
}

// Export singleton instance
export const logsApi = new LogsApiClient();
