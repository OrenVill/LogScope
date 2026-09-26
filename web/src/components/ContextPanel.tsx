import React, { useEffect, useState } from "react";
import { logsApi } from "../api/logsService";
import type { LogEntry } from "../types/log";
import { relativeTime } from "../lib/inspection";
import "./TracePanel.css";

interface ContextPanelProps {
  eventId: string;
  onClose: () => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ eventId, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState(eventId);

  if (eventId !== loadedId) {
    setLoadedId(eventId);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    logsApi.getLogContext(eventId, 10).then((response) => {
      if (cancelled) return;
      if (!response.success) {
        setError(response.error);
        setLogs([]);
        return;
      }
      setLogs(response.data || []);
      setFocusIndex(response.focusIndex ?? 0);
      setError(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="modal-layer">
      <button className="modal-scrim" aria-label="Close context" onClick={onClose} />
      <div className="dialog trace-dialog" role="dialog" aria-modal="true" aria-labelledby="contextTitle">
        <p className="dialog-kicker">Surrounding logs</p>
        <div className="trace-heading">
          <h2 id="contextTitle">Context</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <p className="trace-empty">Ten events before and after this one, including lines outside the current filter.</p>
        {loading && (
          <div className="table-status" role="status">
            <div className="ring" />
            <span>Loading context...</span>
          </div>
        )}
        {error && <p className="trace-error">{error}</p>}
        {!loading && logs.length > 0 && (
          <ol className="trace-list">
            {logs.map((log, index) => (
              <li key={log.eventId} className={`trace-item log-row-${log.level}${index === focusIndex ? " is-focus" : ""}`}>
                <span className="trace-index">{index === focusIndex ? "•" : index + 1}</span>
                <div>
                  <div className="trace-meta">
                    <time dateTime={log.timestamp} title={new Date(log.timestamp).toLocaleString()}>
                      {relativeTime(log.timestamp)}
                    </time>
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
