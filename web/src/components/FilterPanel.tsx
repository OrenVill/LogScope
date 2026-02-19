import React, { useState } from "react";
import type { SearchFilters, LogLevel } from "../types/api";

interface FilterPanelProps {
  onSearch: (filters: SearchFilters) => void;
  isRealTime: boolean;
}

const logLevels: LogLevel[] = ["debug", "info", "warn", "error", "success"];

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filters: SearchFilters = {};
    if (subject) filters.subject = subject;
    if (text) filters.text = text;
    if (level) filters.level = level as LogLevel;
    if (timeFrom) filters.timeFrom = timeFrom;
    if (timeTo) filters.timeTo = timeTo;
    if (requestId) filters.requestId = requestId;
    if (sessionId) filters.sessionId = sessionId;

    onSearch(filters);
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

  return (
    <div className="filter-panel">
      <h3 className="mb-3">🔍 Search & Filter</h3>
      {isRealTime && (
        <div className="alert alert-info alert-sm py-2 px-3 mb-3" role="alert">
          <small><strong>Real-time mode:</strong> Live logs streaming</small>
        </div>
      )}

      <form onSubmit={handleSearch}>
        <div className="mb-3">
          <label className="form-label small mb-2">
            <strong>Subject</strong>
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="e.g., auth, database"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isRealTime}
          />
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
            disabled={isRealTime}
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
          <label className="form-label small mb-2">
            <strong>Search Text</strong>
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search in content"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isRealTime}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small mb-2">
            <strong>Time From</strong>
          </label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            disabled={isRealTime}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small mb-2">
            <strong>Time To</strong>
          </label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            disabled={isRealTime}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small mb-2">
            <strong>Request ID</strong>
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Correlation ID"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            disabled={isRealTime}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small mb-2">
            <strong>Session ID</strong>
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            disabled={isRealTime}
          />
        </div>

        <div className="d-grid gap-2">
          <button 
            type="submit" 
            className="btn btn-primary btn-sm" 
            disabled={isRealTime}
          >
            🔍 Search
          </button>
          <button 
            type="button" 
            className="btn btn-outline-secondary btn-sm" 
            onClick={handleClear}
            disabled={isRealTime}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};
