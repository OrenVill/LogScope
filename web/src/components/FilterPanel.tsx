import React, { useState } from "react";
import type { SearchFilters, LogLevel, ArchiveEnv, ArchiveService } from "../types/api";
import "./FilterPanel.css";

interface FilterPanelProps {
  onSearch: (filters: SearchFilters) => void;
  isRealTime: boolean;
  preset?: { nonce: number; filters: SearchFilters } | null;
  showArchiveFilters?: boolean;
  defaultEnv?: ArchiveEnv;
  defaultService?: ArchiveService;
}

const ENV_OPTIONS: ArchiveEnv[] = ["dev", "preprod", "prod"];
const SERVICE_OPTIONS: ArchiveService[] = ["api", "worker"];

const logLevels: LogLevel[] = ["debug", "info", "warn", "error", "critical", "success"];

const AUTO_APPLY_DEBOUNCE_MS = 400;

/**
 * FilterPanel component - search and filter controls
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  onSearch,
  isRealTime,
  preset = null,
  showArchiveFilters = false,
  defaultEnv = "prod",
  defaultService = "api",
}) => {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [path, setPath] = useState("");
  const [status, setStatus] = useState("");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [env, setEnv] = useState<ArchiveEnv>(defaultEnv);
  const [service, setService] = useState<ArchiveService>(defaultService);
  const [autoApply, setAutoApply] = useState(true);

  React.useEffect(() => {
    setEnv(defaultEnv);
    setService(defaultService);
  }, [defaultEnv, defaultService]);

  // element ids for accessibility
  const subjectId = "filter-subject";
  const textId = "filter-text";
  const pathId = "filter-path";
  const statusId = "filter-status";
  const timeFromId = "filter-timefrom";
  const timeToId = "filter-toto";
  const requestIdId = "filter-requestId";
  const sessionIdId = "filter-sessionId";

  // Build a filter object from local state (stable reference)
  const buildFilters = React.useCallback((): SearchFilters => {
    const filters: SearchFilters = {};
    if (subject) filters.subject = subject;
    if (text) filters.text = text;
    if (path) filters.path = path;
    if (status) filters.status = status;
    if (level) filters.level = level as LogLevel;
    if (timeFrom) filters.timeFrom = timeFrom;
    if (timeTo) filters.timeTo = timeTo;
    if (requestId) filters.requestId = requestId;
    if (sessionId) filters.sessionId = sessionId;
    if (showArchiveFilters) {
      filters.env = env;
      filters.service = service;
    }
    return filters;
  }, [subject, text, path, status, level, timeFrom, timeTo, requestId, sessionId, showArchiveFilters, env, service]);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(buildFilters());
  };

  const handleClear = () => {
    setSubject("");
    setText("");
    setPath("");
    setStatus("");
    setLevel("");
    setTimeFrom("");
    setTimeTo("");
    setRequestId("");
    setSessionId("");
    if (showArchiveFilters) {
      setEnv(defaultEnv);
      setService(defaultService);
    }
    onSearch(showArchiveFilters ? { env: defaultEnv, service: defaultService } : {});
  };

  // Debounced auto-apply effect: watches filter inputs and calls onSearch when autoApply is enabled
  React.useEffect(() => {
    if (!preset) return;
    const next = preset.filters;
    setSubject(next.subject ?? "");
    setText(next.text ?? "");
    setPath(next.path ?? "");
    setStatus(next.status ?? "");
    setLevel((next.level as LogLevel) ?? "");
    setTimeFrom(next.timeFrom ?? "");
    setTimeTo(next.timeTo ?? "");
    setRequestId(next.requestId ?? "");
    setSessionId(next.sessionId ?? "");
    const envValue = next.env ?? env;
    const serviceValue = next.service ?? service;
    if (next.env) setEnv(next.env);
    if (next.service) setService(next.service);
    onSearch(showArchiveFilters ? { env: envValue, service: serviceValue, ...next } : next);
  }, [preset?.nonce]);

  React.useEffect(() => {
    if (!autoApply) return;
    const timer = setTimeout(() => {
      onSearch(buildFilters());
    }, AUTO_APPLY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // include buildFilters and onSearch so effect has correct dependencies
  }, [buildFilters, autoApply, onSearch]);

  return (
    <div className="filter-panel">
      <h2>Filters</h2>
      <p className="panel-kicker">Narrow the stream</p>
      {isRealTime && (
        <p className="filter-callout">
          Live mode is on. Filters still apply to stored logs and the incoming stream.
        </p>
      )}

      <form className="filter-form" onSubmit={handleSearch}>
        {showArchiveFilters && (
          <>
            <div className="filter-field">
              <label htmlFor="filter-env">Environment</label>
              <select
                id="filter-env"
                className="form-select"
                value={env}
                onChange={(e) => setEnv(e.target.value as ArchiveEnv)}
              >
                {ENV_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="filter-service">Service</label>
              <select
                id="filter-service"
                className="form-select"
                value={service}
                onChange={(e) => setService(e.target.value as ArchiveService)}
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="filter-field">
          <div className="filter-label-row">
            <label htmlFor={subjectId}>Subject</label>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="autoApplyToggle"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="autoApplyToggle">Auto-apply</label>
            </div>
          </div>
          <input
            id={subjectId}
            type="text"
            className="form-control"
            placeholder="e.g., auth, database"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-level">Log Level</label>
          <select
            id="filter-level"
            className="form-select"
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel | "")}
          >
            <option value="">All levels</option>
            {logLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor={textId}>Search Text</label>
          <input
            id={textId}
            type="text"
            className="form-control"
            placeholder="Search in content"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={pathId}>Path</label>
          <input
            id={pathId}
            type="text"
            className="form-control"
            placeholder="/status, /api/…"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={statusId}>HTTP status</label>
          <input
            id={statusId}
            type="text"
            className="form-control"
            placeholder="200, 500"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={timeFromId}>Time From</label>
          <input
            id={timeFromId}
            type="datetime-local"
            className="form-control"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={timeToId}>Time To</label>
          <input
            id={timeToId}
            type="datetime-local"
            className="form-control"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={requestIdId}>Request ID</label>
          <input
            id={requestIdId}
            type="text"
            className="form-control"
            placeholder="Correlation ID"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor={sessionIdId}>Session ID</label>
          <input
            id={sessionIdId}
            type="text"
            className="form-control"
            placeholder="Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button type="submit" className="btn-accent">
            Search
          </button>
          <button type="button" className="btn-ghost" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};
