import React, { useMemo, useState } from "react";
import type { LogEntry, LogLevel, LogSummary } from "../types/log";
import { logsApi } from "../api/logsService";
import "./LogTable.css";

type Log = LogEntry | LogSummary;

interface LogTableProps {
  logs: Log[];
  loading: boolean;
  sortBy: "timestamp" | "level";
  onSort: (sortBy: "timestamp" | "level") => void;
}

const levelColors: Record<LogLevel, string> = {
  debug: "secondary",
  info: "info",
  warn: "warning",
  error: "danger",
  critical: "danger",
  success: "success",
};

const levelIcons: Record<LogLevel, string> = {
  debug: "🐛",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  critical: "🚨",
  success: "✅",
};

/**
 * Check if a log is a full entry or just a summary
 */
const isFullEntry = (log: Log): log is LogEntry => {
  return "source" in log && typeof log.source === "object" && "function" in log.source;
};

/**
 * LogTable component - displays logs in a table format with lazy-loaded details
 */
export const LogTable: React.FC<LogTableProps> = ({
  logs,
  loading,
  sortBy,
  onSort,
}) => {
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [fullLogs, setFullLogs] = useState<Map<string, LogEntry>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  const toggleExpanded = async (log: Log) => {
    const wasExpanded = expandedRows.has(log.eventId);
    const newExpanded = new Set(expandedRows);

    if (wasExpanded) {
      newExpanded.delete(log.eventId);
      // collapse immediately
      setExpandedRows(newExpanded);
      return;
    }

    // expand immediately so UI can show loading state while we fetch
    newExpanded.add(log.eventId);
    setExpandedRows(newExpanded);

    // If this is a summary and we don't have full details, fetch them
    if (!isFullEntry(log) && !fullLogs.has(log.eventId)) {
      setLoadingDetails(prev => new Set([...prev, log.eventId]));
      try {
        const response = await logsApi.getLogById(log.eventId);
        if (response.success && response.data) {
          setFullLogs(prev => new Map([...prev, [log.eventId, response.data as LogEntry]]));
        }
      } catch (error) {
        console.error("Failed to fetch log details:", error);
      } finally {
        setLoadingDetails(prev => {
          const updated = new Set(prev);
          updated.delete(log.eventId);
          return updated;
        });
      }
    }
  };

  const getDisplayLog = (log: Log): LogEntry | LogSummary => {
    if (!isFullEntry(log) && fullLogs.has(log.eventId)) {
      return fullLogs.get(log.eventId)!;
    }
    return log;
  };

  const formatContent = (data: unknown): string => {
    if (typeof data === "string") {
      return data;
    }
    return JSON.stringify(data, null, 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard')
    }).catch(() => {
      console.error('Failed to copy to clipboard')
    })
  };
  
  const sortedLogs = useMemo(() => {
    const sorted = [...logs];
    
    if (sortBy === "timestamp") {
      sorted.sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
      });
    } else if (sortBy === "level") {
      const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, success: 2, warn: 3, error: 4, critical: 5 };
      sorted.sort((a, b) => {
        const aLevel = levelOrder[a.level as LogLevel];
        const bLevel = levelOrder[b.level as LogLevel];
        return sortOrder === "desc" ? bLevel - aLevel : aLevel - bLevel;
      });
    }

    return sorted;
  }, [logs, sortBy, sortOrder]);

  const toggleSort = (column: "timestamp" | "level") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      onSort(column);
      setSortOrder("desc");
    }
  };

  if (loading) {
    return (
      <div className="log-table">
        <h2 className="mb-4 h4">📋 Logs</h2>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="log-table">
        <h2 className="mb-4 h4">📋 Logs</h2>
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <h5 className="card-title text-muted">No logs found</h5>
            <p className="card-text text-muted small mb-3">
              Use the search panel on the left to find logs, or enable real-time mode to stream incoming logs
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="log-table">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="h4 mb-1">📋 Logs</h2>
          <p className="text-muted small mb-0">Live structured logging and inspection</p>
        </div>
        <span className="badge bg-primary fs-6 px-3 py-2">{logs.length} logs</span>
      </div>

      <div className="log-table-container card border-0 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden">
        <table className="table table-hover table-sm">
          <thead className="table-light">
            <tr>
              <th style={{ cursor: "pointer", width: "40px" }}>•</th>
              <th style={{ cursor: "pointer", width: "30px" }}>Level</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("timestamp")}>
                Timestamp {sortBy === "timestamp" && (sortOrder === "desc" ? "↓" : "↑")}
              </th>
              <th>Subject</th>
              <th>Content</th>
              <th style={{ width: "120px" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map((log: Log) => (
              <React.Fragment key={log.eventId}>
                <tr 
                  title={`ID: ${log.eventId}`}
                  className={`log-row-${log.level}`}
                >
                  <td className="text-center" style={{ cursor: "pointer" }} onClick={() => toggleExpanded(log)}>
                    <span style={{ fontSize: "1rem" }}>
                      {expandedRows.has(log.eventId) ? "▼" : "▶"}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge bg-${levelColors[log.level]}`}
                      title={`Level: ${log.level}`}
                    >
                      {levelIcons[log.level]}
                    </span>
                  </td>
                  <td>
                    <small className="text-muted">
                      {new Date(log.timestamp).toLocaleString()}
                    </small>
                  </td>
                  <td>
                    <span className="fw-bold">{log.subject}</span>
                  </td>
                  <td>
                    <small>
                      {log.message ? log.message.substring(0, 50) : <em className="text-muted">(no message)</em>}
                      {log.message && log.message.length > 50 && "..."}
                    </small>
                  </td>
                  <td>
                    <small className="text-muted">
                      {log.source.runtime === "node" ? "🖥️ Backend" : "🌐 Frontend"}
                      <br />
                      <code className="small">{log.source.serviceName}</code>
                    </small>
                  </td>
                </tr>
                {expandedRows.has(log.eventId) && (
                  <tr className={`log-row-expanded log-row-${log.level}`}>
                    <td colSpan={6} className="p-3">
                      {loadingDetails.has(log.eventId) ? (
                        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100px" }}>
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span className="visually-hidden">Loading details...</span>
                          </div>
                          <span className="text-muted">Loading log details...</span>
                        </div>
                      ) : (
                        <div className="log-details">
                          {(() => {
                            const displayLog = getDisplayLog(log);
                            return (
                              <>
                                <div className="log-details-section">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="text-uppercase small fw-bold mb-0">📝 Message</h6>
                                  </div>
                                  <p className="mb-3">{displayLog.message || <em className="text-muted">(no message)</em>}</p>
                                </div>

                                {isFullEntry(displayLog) && displayLog.data ? (
                                  <div className="log-details-section">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <h6 className="text-uppercase small fw-bold mb-0">📊 Data</h6>
                                      <button 
                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                        onClick={() => copyToClipboard(formatContent(displayLog.data))}
                                        title="Copy data to clipboard"
                                      >
                                        📋 Copy
                                      </button>
                                    </div>
                                    <pre className="log-content-display mb-3">{formatContent(displayLog.data)}</pre>
                                  </div>
                                ) : null}

                                {isFullEntry(displayLog) ? (
                                  <div className="row">
                                    <div className="col-md-6">
                                      <h6 className="text-uppercase small fw-bold mb-2">📍 Source Information</h6>
                                      <div className="log-metadata">
                                        <div><strong>Function:</strong> <code>{displayLog.source.function}</code></div>
                                        <div><strong>File:</strong> <code>{displayLog.source.file}</code></div>
                                        <div><strong>Process:</strong> <code>{displayLog.source.process}</code></div>
                                        <div><strong>Runtime:</strong> {displayLog.source.runtime === "node" ? "🖥️ Node.js" : "🌐 Browser"}</div>
                                        <div><strong>Service:</strong> {displayLog.source.serviceName}</div>
                                      </div>
                                    </div>

                                    <div className="col-md-6">
                                      <h6 className="text-uppercase small fw-bold mb-2">🔗 Correlation</h6>
                                      <div className="log-metadata">
                                        {displayLog.correlation.requestId && (
                                          <div><strong>Request ID:</strong> <code>{displayLog.correlation.requestId}</code></div>
                                        )}
                                        {displayLog.correlation.sessionId && (
                                          <div><strong>Session ID:</strong> <code>{displayLog.correlation.sessionId}</code></div>
                                        )}
                                        {displayLog.correlation.userId && (
                                          <div><strong>User ID:</strong> <code>{displayLog.correlation.userId}</code></div>
                                        )}
                                        {!displayLog.correlation.requestId && !displayLog.correlation.sessionId && !displayLog.correlation.userId && (
                                          <div className="text-muted small">No correlation data</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="alert alert-info small mb-0">
                                    <strong>Note:</strong> Click to see full log details including source information and correlation data.
                                  </div>
                                )}

                                <div className="mt-3">
                                  <h6 className="text-uppercase small fw-bold mb-2">🆔 Event ID</h6>
                                  <code className="d-inline-block p-2 bg-light rounded small">{log.eventId}</code>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
