import React, { useMemo, useState } from "react";
import type { LogEntry, LogLevel, LogSummary } from "../types/log";
import { logsApi } from "../api/logsService";
import { editorLink, groupInView, isTypingTarget, presentedSource, primitiveFields, relativeTime } from "../lib/inspection";
import type { SearchFilters } from "../types/api";
import "./LogTable.css";

type Log = LogEntry | LogSummary;

export interface TraceTarget {
  kind: "request" | "session";
  id: string;
}

interface LogTableProps {
  logs: Log[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  sortBy: "timestamp" | "level";
  onSort: (sortBy: "timestamp" | "level") => void;
  onLoadMore?: () => void;
  totalCount?: number;
  focusEventId?: string | null;
  focusNonce?: number;
  followTick?: number;
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  onFollowChange?: (following: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
  onOpenTrace?: (target: TraceTarget) => void;
  onOpenContext?: (eventId: string) => void;
  onApplyFilter?: (filters: SearchFilters) => void;
  onFocusSearch?: () => void;
}

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
  loadingMore = false,
  hasMore = false,
  sortBy,
  onSort,
  onLoadMore,
  totalCount = 0,
  focusEventId = null,
  focusNonce = 0,
  followTick = 0,
  scrollRootRef,
  onFollowChange,
  onExpandedChange,
  onOpenTrace,
  onOpenContext,
  onApplyFilter,
  onFocusSearch,
}) => {
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [fullLogs, setFullLogs] = useState<Map<string, LogEntry>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [localStarred, setLocalStarred] = useState<Set<string>>(
    () => new Set(logs.filter((l) => l.starred).map((l) => l.eventId))
  );
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Keep refs for latest prop values so observer callback has current state
  const loadingMoreRef = React.useRef<boolean>(false);
  const hasMoreRef = React.useRef<boolean>(false);
  React.useEffect(() => { loadingMoreRef.current = !!loadingMore }, [loadingMore]);
  React.useEffect(() => { hasMoreRef.current = !!hasMore }, [hasMore]);

  // Merge server-side starred state into local state whenever the logs list updates
  React.useEffect(() => {
    setLocalStarred((prev) => {
      const next = new Set(prev);
      for (const log of logs) {
        if (log.starred) next.add(log.eventId);
      }
      return next;
    });
  }, [logs]);

  // IntersectionObserver -> call onLoadMore when sentinel becomes visible
  React.useEffect(() => {
    if (!onLoadMore || typeof window === 'undefined') return;
    const el = sentinelRef.current || document.querySelector('[data-testid="load-more-sentinel"]') as HTMLDivElement | null;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          try {
            onLoadMore()
          } catch (err) {
            // swallow errors from caller
            console.error('onLoadMore handler error', err)
          }
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0.01 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore]);

  const toggleStar = async (e: React.MouseEvent, log: Log) => {
    e.stopPropagation();
    const wasStarred = localStarred.has(log.eventId);
    // Optimistic update
    setLocalStarred((prev) => {
      const next = new Set(prev);
      if (wasStarred) next.delete(log.eventId);
      else next.add(log.eventId);
      return next;
    });
    try {
      if (wasStarred) {
        await logsApi.unstarLog(log.eventId);
      } else {
        await logsApi.starLog(log.eventId);
      }
    } catch (error) {
      // Revert on failure
      setLocalStarred((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.add(log.eventId);
        else next.delete(log.eventId);
        return next;
      });
      console.error("Failed to update star:", error);
    }
  };

  const toggleExpanded = async (log: Log) => {
    setSelectedId(log.eventId);
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

  const groups = useMemo(() => groupInView(sortedLogs), [sortedLogs]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleSort = (column: "timestamp" | "level") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      onSort(column);
      setSortOrder("desc");
    }
  };

  const formatStamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      day: date.toLocaleDateString([], { month: "short", day: "numeric" }),
    };
  };

  const actionRef = React.useRef({ toggleExpanded, toggleStar });
  actionRef.current = { toggleExpanded, toggleStar };
  const expandedRef = React.useRef(expandedRows);
  expandedRef.current = expandedRows;
  const groupsRef = React.useRef(groups);
  groupsRef.current = groups;
  const selectedRef = React.useRef(selectedId);
  selectedRef.current = selectedId;
  const programmaticScroll = React.useRef(false);

  React.useEffect(() => {
    onExpandedChange?.(expandedRows.size > 0);
  }, [expandedRows, onExpandedChange]);

  const logsRef = React.useRef(logs);
  logsRef.current = logs;

  React.useEffect(() => {
    if (!focusNonce || !focusEventId) return;
    const log = logsRef.current.find((item) => item.eventId === focusEventId);
    setSelectedId(focusEventId);
    if (log && !expandedRef.current.has(focusEventId)) {
      void actionRef.current.toggleExpanded(log);
    }
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-event-id="${focusEventId}"]`)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusNonce, focusEventId]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "/") {
        event.preventDefault();
        onFocusSearch?.();
        return;
      }
      const visible = groupsRef.current;
      if (!visible.length) return;
      const current = selectedRef.current;
      const index = visible.findIndex((group) => group.log.eventId === current);
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const nextIndex = event.key === "j"
          ? Math.min(visible.length - 1, (index === -1 ? -1 : index) + 1)
          : Math.max(0, index === -1 ? 0 : index - 1);
        const id = visible[nextIndex].log.eventId;
        setSelectedId(id);
        document.querySelector(`[data-event-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && current) {
        event.preventDefault();
        const group = visible.find((item) => item.log.eventId === current);
        if (group) void actionRef.current.toggleExpanded(group.log);
      } else if ((event.key === "s" || event.key === "S") && current && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const group = visible.find((item) => item.log.eventId === current);
        if (group) void actionRef.current.toggleStar({ stopPropagation() {} } as React.MouseEvent, group.log);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFocusSearch]);

  React.useEffect(() => {
    const root = scrollRootRef?.current;
    if (!root || !onFollowChange) return;
    const onScroll = () => {
      if (programmaticScroll.current) return;
      const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 48;
      onFollowChange(atBottom);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef, onFollowChange]);

  React.useEffect(() => {
    const root = scrollRootRef?.current;
    if (!root || !followTick) return;
    programmaticScroll.current = true;
    root.scrollTop = root.scrollHeight;
    const timer = window.setTimeout(() => {
      programmaticScroll.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [followTick, scrollRootRef]);

  if (loading) {
    return (
      <div className="log-table">
        <div className="log-heading">
          <div>
            <h2>Event stream</h2>
            <p>Structured logs, ready to inspect</p>
          </div>
        </div>
        <div className="table-status" role="status">
          <div className="ring" />
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="log-table">
        <div className="log-heading">
          <div>
            <h2>Event stream</h2>
            <p>Structured logs, ready to inspect</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-mark" aria-hidden="true" />
          <h3>No logs in view</h3>
          <p>Adjust the filters, or leave live mode on to watch new events arrive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="log-table">
      <div className="log-heading">
        <div>
          <h2>Event stream</h2>
          <p>Structured logs, ready to inspect</p>
        </div>
        <span className="count-pill">{totalCount} total</span>
      </div>

      <div className="log-table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "44px" }} title="Pin log to protect from auto-deletion">Pin</th>
              <th style={{ width: "40px" }}><span className="visually-hidden">Expand</span></th>
              <th className="is-sortable" style={{ width: "108px" }} onClick={() => toggleSort("level")}>
                Level {sortBy === "level" && (sortOrder === "desc" ? "↓" : "↑")}
              </th>
              <th className="is-sortable" onClick={() => toggleSort("timestamp")}>
                Timestamp {sortBy === "timestamp" && (sortOrder === "desc" ? "↓" : "↑")}
              </th>
              <th>Subject</th>
              <th>Message</th>
              <th style={{ width: "140px" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const log = group.log;
              const stamp = formatStamp(log.timestamp);
              const expanded = expandedRows.has(log.eventId);
              const rowSource = presentedSource(log);
              return (
              <React.Fragment key={log.eventId}>
                <tr
                  data-event-id={log.eventId}
                  title={`ID: ${log.eventId}`}
                  className={`log-row-${log.level}${selectedId === log.eventId ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(log.eventId)}
                >
                  <td>
                    <button
                      className="star-btn"
                      title={localStarred.has(log.eventId) ? "Unpin (log will be auto-deleted)" : "Pin (protect from auto-deletion)"}
                      onClick={(e) => toggleStar(e, log)}
                      aria-pressed={localStarred.has(log.eventId)}
                      aria-label={localStarred.has(log.eventId) ? "Unpin log" : "Pin log"}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill={localStarred.has(log.eventId) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 3.2 14.7 8.7l6 .9-4.4 4.2 1 6-5.3-2.8L6.7 19.8l1-6L3.3 9.6l6-.9L12 3.2Z" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="expand-btn"
                      onClick={() => toggleExpanded(log)}
                      aria-expanded={expanded}
                      aria-label={expanded ? "Collapse log" : "Expand log"}
                    >
                      <span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
                    </button>
                  </td>
                  <td>
                    <span className="level-pill" title={`Level: ${log.level}`}>
                      <span className="level-dot" aria-hidden="true" />
                      {log.level}
                    </span>
                  </td>
                  <td>
                    <span className="ts" title={new Date(log.timestamp).toLocaleString()}>
                      {relativeTime(log.timestamp, now)}
                      <small>{stamp.day} {stamp.time}</small>
                    </span>
                    <button
                      type="button"
                      className="row-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenContext?.(log.eventId);
                      }}
                    >
                      Context
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="subject-name subject-filter"
                      onClick={(event) => {
                        event.stopPropagation();
                        onApplyFilter?.({ subject: log.subject });
                      }}
                    >
                      {log.subject}
                    </button>
                    {group.count > 1 && (
                      <span className="repeat-count" title={`${group.count} identical events in this view`}>×{group.count}</span>
                    )}
                  </td>
                  <td>
                    <span className="message-preview" title={log.message || undefined}>
                      {log.message || <em>No message</em>}
                    </span>
                  </td>
                  <td>
                    <span className="source-cell">
                      {rowSource && (
                        <span
                          className={`origin-tag origin-${rowSource.origin}`}
                          title={rowSource.origin === "live" ? "Open hour, read from landing/" : "Compacted hour"}
                        >
                          {rowSource.origin === "live" ? "live" : "archive"}
                        </span>
                      )}
                      <span className={`runtime-tag runtime-${log.source.runtime}`}>
                        {log.source.runtime === "node" ? "Backend" : "Frontend"}
                      </span>
                      <code className="service-name">{log.source.serviceName}</code>
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr className={`log-row-expanded log-row-${log.level}`}>
                    <td colSpan={7}>
                      {loadingDetails.has(log.eventId) ? (
                        <div className="table-status" style={{ minHeight: "100px" }}>
                          <div className="ring" role="status" />
                          <span>Loading log details...</span>
                        </div>
                      ) : (
                        <div className="log-details">
                          {(() => {
                            const displayLog = getDisplayLog(log);
                            const httpSource = presentedSource(displayLog);
                            return (
                              <>
                                <div className="detail-block">
                                  <h3>Message</h3>
                                  <p>{displayLog.message || <em>No message</em>}</p>
                                </div>

                                {isFullEntry(displayLog) && displayLog.data ? (
                                  <div className="detail-block">
                                    <div className="detail-head">
                                      <h3>Data</h3>
                                      <button
                                        className="btn-quiet"
                                        onClick={() => copyToClipboard(formatContent(displayLog.data))}
                                        title="Copy data to clipboard"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                    <pre className="log-content-display">{formatContent(displayLog.data)}</pre>
                                    {primitiveFields(displayLog.data).length > 0 && (
                                      <div className="value-filters">
                                        {primitiveFields(displayLog.data).map((field) => (
                                          <button
                                            key={field.key}
                                            type="button"
                                            className="value-chip"
                                            onClick={() => onApplyFilter?.({ text: field.value })}
                                          >
                                            {field.key}: {field.value}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : null}

                                {isFullEntry(displayLog) ? (
                                  <div className="detail-grid">
                                    <div>
                                      <h3>Source</h3>
                                      {httpSource ? (
                                        <div className="log-metadata">
                                          <div>
                                            <strong>Origin:</strong>{" "}
                                            <span className={`origin-tag origin-${httpSource.origin}`}>
                                              {httpSource.origin === "live" ? "live · landing/" : "archive"}
                                            </span>
                                          </div>
                                          {httpSource.env && (
                                            <div><strong>Env:</strong> <span>{httpSource.env}</span></div>
                                          )}
                                          <div><strong>Service:</strong> <span>{httpSource.service}</span></div>
                                          {httpSource.pod && (
                                            <div><strong>Pod:</strong> <code>{httpSource.pod}</code></div>
                                          )}
                                          {httpSource.method && (
                                            <div><strong>Method:</strong> <code>{httpSource.method}</code></div>
                                          )}
                                          {httpSource.path && (
                                            <div>
                                              <strong>Path:</strong>{" "}
                                              <button type="button" className="id-link" onClick={() => onApplyFilter?.({ path: httpSource.path })}>
                                                {httpSource.path}
                                              </button>
                                            </div>
                                          )}
                                          {httpSource.status !== undefined && (
                                            <div>
                                              <strong>HTTP status:</strong>{" "}
                                              <button type="button" className="id-link" onClick={() => onApplyFilter?.({ status: String(httpSource.status) })}>
                                                {httpSource.status}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="log-metadata">
                                          <div><strong>Function:</strong> <code>{displayLog.source.function}</code></div>
                                          <div>
                                            <strong>File:</strong>
                                            <span className="file-value">
                                              <code>{displayLog.source.file}</code>
                                              {editorLink(displayLog.source.file) && (
                                                <a className="editor-link" href={editorLink(displayLog.source.file) ?? undefined}>Open in editor</a>
                                              )}
                                            </span>
                                          </div>
                                          <div><strong>Process:</strong> <code>{displayLog.source.process}</code></div>
                                          <div><strong>Runtime:</strong> <span>{displayLog.source.runtime === "node" ? "Node.js" : "Browser"}</span></div>
                                          <div><strong>Service:</strong> <span>{displayLog.source.serviceName}</span></div>
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <h3>Correlation</h3>
                                      <div className="log-metadata">
                                        {displayLog.correlation.requestId && (
                                          <div>
                                            <strong>Request ID:</strong>
                                            <span className="id-actions">
                                              <button type="button" className="id-link" onClick={() => onOpenTrace?.({ kind: "request", id: displayLog.correlation.requestId! })}>
                                                {displayLog.correlation.requestId}
                                              </button>
                                              <button type="button" className="row-action" onClick={() => onApplyFilter?.({ requestId: displayLog.correlation.requestId })}>
                                                Filter
                                              </button>
                                            </span>
                                          </div>
                                        )}
                                        {displayLog.correlation.sessionId && (
                                          <div>
                                            <strong>Session ID:</strong>
                                            <span className="id-actions">
                                              <button type="button" className="id-link" onClick={() => onOpenTrace?.({ kind: "session", id: displayLog.correlation.sessionId! })}>
                                                {displayLog.correlation.sessionId}
                                              </button>
                                              <button type="button" className="row-action" onClick={() => onApplyFilter?.({ sessionId: displayLog.correlation.sessionId })}>
                                                Filter
                                              </button>
                                            </span>
                                          </div>
                                        )}
                                        {displayLog.correlation.userId && (
                                          <div>
                                            <strong>User ID:</strong>
                                            <button type="button" className="id-link" onClick={() => onApplyFilter?.({ text: displayLog.correlation.userId })}>
                                              {displayLog.correlation.userId}
                                            </button>
                                          </div>
                                        )}
                                        {!displayLog.correlation.requestId && !displayLog.correlation.sessionId && !displayLog.correlation.userId && (
                                          <div>No correlation data</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="detail-note">
                                    Full source and correlation details appear here once they load.
                                  </div>
                                )}

                                <div className="detail-block">
                                  <h3>Event ID</h3>
                                  <code className="event-id">{log.eventId}</code>
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
              );
            })}
          </tbody>
        </table>

        <div className="load-more">
          {loadingMore ? (
            <div className="ring" role="status">
              <span className="visually-hidden">Loading more...</span>
            </div>
          ) : null}

          {hasMore && onLoadMore ? (
            <div
              data-testid="load-more-sentinel"
              ref={sentinelRef}
              style={{ height: 1, width: "100%" }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
