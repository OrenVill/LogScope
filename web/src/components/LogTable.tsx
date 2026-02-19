import React, { useMemo, useState } from "react";
import type { LogEntry, LogLevel } from "../types/api";
import "./LogTable.css";

interface LogTableProps {
  logs: LogEntry[];
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
 * LogTable component - displays logs in a table format
 */
export const LogTable: React.FC<LogTableProps> = ({
  logs,
  loading,
  sortBy,
  onSort,
}) => {
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const sortedLogs = useMemo(() => {
    const sorted = [...logs];
    
    if (sortBy === "timestamp") {
      sorted.sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
      });
    } else if (sortBy === "level") {
      const levelOrder = { debug: 0, info: 1, success: 2, warn: 3, error: 4, critical: 5 };
      sorted.sort((a, b) => {
        const aLevel = levelOrder[a.level];
        const bLevel = levelOrder[b.level];
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
        <h2 className="h4 mb-0">📋 Logs</h2>
        <span className="badge bg-primary">{logs.length} logs</span>
      </div>

      <div className="table-responsive">
        <table className="table table-hover table-sm">
          <thead className="table-light">
            <tr>
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
            {sortedLogs.map((log) => (
              <tr 
                key={log.eventId} 
                title={`ID: ${log.eventId}`}
                className={`log-row-${log.level}`}
              >
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
                    {typeof log.content === "string"
                      ? log.content.substring(0, 50)
                      : JSON.stringify(log.content).substring(0, 50)}
                    {(typeof log.content === "string"
                      ? log.content
                      : JSON.stringify(log.content)
                    ).length > 50 && "..."}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
