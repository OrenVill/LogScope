import React, { useState } from 'react'
import type { LogEntry, LogLevel } from '../types/api'
import './StatsPanel.css'

interface StatsPanelProps {
  logs: LogEntry[]
  onLevelFilter: (level: LogLevel | 'all') => void
  currentLevel: LogLevel | 'all'
  /** When set (S3 archive mode), info/warn/error totals come from `stats/daily/` objects. */
  archiveDailyStats?: { info: number; warn: number; error: number } | null
}

const levels: Array<LogLevel | 'all'> = ['all', 'debug', 'info', 'success', 'warn', 'error', 'critical']

export const StatsPanel: React.FC<StatsPanelProps> = ({
  logs,
  onLevelFilter,
  currentLevel,
  archiveDailyStats = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const fromLogs = {
    debug: logs.filter(l => l.level === 'debug').length,
    info: logs.filter(l => l.level === 'info').length,
    success: logs.filter(l => l.level === 'success').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
    critical: logs.filter(l => l.level === 'critical').length,
  }
  const stats = archiveDailyStats
    ? {
        ...fromLogs,
        info: archiveDailyStats.info,
        warn: archiveDailyStats.warn,
        error: archiveDailyStats.error,
      }
    : fromLogs

  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  const hasErrors = stats.error > 0 || stats.critical > 0

  const counts: Record<LogLevel | 'all', number> = { ...stats, all: total }

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <button
          className="stats-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse stats' : 'Expand stats'}
        >
          <span className={`stats-chevron${isExpanded ? ' is-open' : ''}`} aria-hidden="true" />
          <h2 className="stats-title">
            Log statistics{archiveDailyStats ? ' · bucket daily' : ''}
          </h2>
        </button>
        <div className="stats-total">
          <span className="stats-label">Total:</span>
          <span className="stats-count">{total}</span>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="stats-grid">
            {levels.map((level) => (
              <button
                key={level}
                className={`stat-card${currentLevel === level ? ' active' : ''}`}
                data-level={level}
                onClick={() => onLevelFilter(level)}
              >
                <span className="stat-label">{level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}</span>
                <span className="stat-value">{counts[level]}</span>
              </button>
            ))}
          </div>

          {hasErrors && (
            <div className="stats-alert">
              <span className="alert-icon" aria-hidden="true" />
              <span className="alert-text">
                {stats.critical > 0 && `${stats.critical} critical`}
                {stats.critical > 0 && stats.error > 0 && ' and '}
                {stats.error > 0 && `${stats.error} error`}
                {stats.critical > 0 || stats.error > 0 ? ' log(s) detected' : ''}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
