import React, { useEffect, useState } from "react";
import { logsApi } from "../api/logsService";
import type { LogEntry } from "../types/log";
import "./TracePanel.css";

interface TracePanelProps {
  kind: "request" | "session";
  id: string;
  onClose: () => void;
}

export const TracePanel: React.FC<TracePanelProps> = ({ kind, id, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const request =
      kind === "request"
        ? logsApi.getCorrelatedByRequestId(id, { limit: 200 })
        : logsApi.getCorrelatedBySessionId(id, { limit: 200 });

    request
      .then((response) => {
        if (cancelled) return;
        if (!response.success) {
          setError(response.error);
          setLogs([]);
          return;
        }
        const ordered = [...(response.data || [])].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        setLogs(ordered);
        setError(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return (
    <div className="modal-layer">
      <button className="modal-scrim" aria-label="Close trace" onClick={onClose} />
      <div className="dialog trace-dialog" role="dialog" aria-modal="true" aria-labelledby="traceTitle">
        <p className="dialog-kicker">{kind === "request" ? "Request" : "Session"}</p>
        <div className="trace-heading">
          <h2 id="traceTitle">Trace</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <code className="event-id">{id}</code>

        {loading && (
          <div className="table-status" role="status">
            <div className="ring" />
            <span>Loading trace...</span>
          </div>
        )}
        {error && <p className="trace-error">{error}</p>}
        {!loading && !error && logs.length === 0 && <p className="trace-empty">No correlated logs.</p>}
        {!loading && logs.length > 0 && (
          <ol className="trace-list">
            {logs.map((log, index) => (
              <li key={log.eventId} className={`trace-item log-row-${log.level}`}>
                <span className="trace-index">{index + 1}</span>
                <div>
                  <div className="trace-meta">
                    <time dateTime={log.timestamp}>{new Date(log.timestamp).toLocaleString()}</time>
                    <span className="level-pill">
                      <span className="level-dot" aria-hidden="true" />
                      {log.level}
                    </span>
                  </div>
                  <strong>{log.subject}</strong>
                  <p>{log.message || "No message"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
