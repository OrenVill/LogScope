import React, { useState } from "react";
import type { SearchFilters, LogLevel } from "../types/api";

interface FilterPanelProps {
  onSearch: (filters: SearchFilters) => void;
  isRealTime: boolean;
}

const logLevels: LogLevel[] = ["debug", "info", "warn", "error", "success"];

const AUTO_APPLY_DEBOUNCE_MS = 400;

/**
 * FilterPanel component - search and filter controls
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({ onSearch, isRealTime }) => {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [autoApply, setAutoApply] = useState(true);

  // element ids for accessibility
  const subjectId = "filter-subject";
  const textId = "filter-text";
  const timeFromId = "filter-timefrom";
  const timeToId = "filter-toto";
  const requestIdId = "filter-requestId";
  const sessionIdId = "filter-sessionId";

  // Build a filter object from local state (stable reference)
  const buildFilters = React.useCallback((): SearchFilters => {
    const filters: SearchFilters = {};
    if (subject) filters.subject = subject;
    if (text) filters.text = text;
    if (level) filters.level = level as LogLevel;
    if (timeFrom) filters.timeFrom = timeFrom;
    if (timeTo) filters.timeTo = timeTo;
    if (requestId) filters.requestId = requestId;
    if (sessionId) filters.sessionId = sessionId;
    return filters;
  }, [subject, text, level, timeFrom, timeTo, requestId, sessionId]);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(buildFilters());
  };

  const handleClear = () => {
    setSubject("");
    setText("");
    setLevel("");
    setTimeFrom("");
    setTimeTo("");
    setRequestId("");
    setSessionId("");
    onSearch({});
  };

  // Debounced auto-apply effect: watches filter inputs and calls onSearch when autoApply is enabled
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
      <h2 className="mb-3">🔍 Search & Filter</h2>
      {isRealTime && (
        <div className="alert alert-info alert-sm py-2 px-3 mb-3" role="alert">
          <small>
            <strong>Real-time mode:</strong> Live logs streaming — you can still set filters here and press
            <em> Search </em> to apply them to both the historical results and the live stream.
          </small>
        </div>
      )}

      <form onSubmit={handleSearch}>
        <div className="mb-3 d-flex align-items-center justify-content-between gap-2">
          <div style={{ flex: 1 }}>
            <label htmlFor={subjectId} className="form-label small mb-2">
              <strong>Subject</strong>
            </label>
            <input
              id={subjectId}
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g., auth, database"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="form-check form-switch" style={{ alignSelf: 'end' }}>
            <input
              className="form-check-input"
              type="checkbox"
              id="autoApplyToggle"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="autoApplyToggle">Auto-apply</label>
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="filter-level" className="form-label small mb-2">
            <strong>Log Level</strong>
          </label>
          <select
            id="filter-level"
            className="form-select form-select-sm"
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

        <div className="mb-3">
          <label htmlFor={textId} className="form-label small mb-2">
            <strong>Search Text</strong>
          </label>
          <input
            id={textId}
            type="text"
            className="form-control form-control-sm"
            placeholder="Search in content"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor={timeFromId} className="form-label small mb-2">
            <strong>Time From</strong>
          </label>
          <input
            id={timeFromId}
            type="datetime-local"
            className="form-control form-control-sm"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor={timeToId} className="form-label small mb-2">
            <strong>Time To</strong>
          </label>
          <input
            id={timeToId}
            type="datetime-local"
            className="form-control form-control-sm"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor={requestIdId} className="form-label small mb-2">
            <strong>Request ID</strong>
          </label>
          <input
            id={requestIdId}
            type="text"
            className="form-control form-control-sm"
            placeholder="Correlation ID"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor={sessionIdId} className="form-label small mb-2">
            <strong>Session ID</strong>
          </label>
          <input
            id={sessionIdId}
            type="text"
            className="form-control form-control-sm"
            placeholder="Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </div>

        <div className="d-grid gap-2">
          <button 
            type="submit" 
            className="btn btn-primary btn-sm"
          >
            🔍 Search
          </button>
          <button 
            type="button" 
            className="btn btn-outline-secondary btn-sm" 
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};
