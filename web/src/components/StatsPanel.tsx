import React, { useState } from 'react'
import type { LogEntry, LogLevel } from '../types/api'
import './StatsPanel.css'

interface StatsPanelProps {
  logs: LogEntry[]
  onLevelFilter: (level: LogLevel | 'all') => void
  currentLevel: LogLevel | 'all'
}

const levelIcons: Record<LogLevel | 'all', string> = {
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  critical: '🚨',
  success: '✅',
  all: '📊'
}

const levelColors: Record<LogLevel | 'all', { bg: string; text: string; badge: string }> = {
  debug: { bg: 'rgba(108, 117, 125, 0.1)', text: '#6c757d', badge: 'secondary' },
  info: { bg: 'rgba(23, 162, 184, 0.1)', text: '#17a2b8', badge: 'info' },
  success: { bg: 'rgba(40, 167, 69, 0.1)', text: '#28a745', badge: 'success' },
  warn: { bg: 'rgba(255, 149, 0, 0.1)', text: '#ff9500', badge: 'warning' },
  error: { bg: 'rgba(220, 53, 69, 0.1)', text: '#dc3545', badge: 'danger' },
  critical: { bg: 'rgba(255, 0, 0, 0.1)', text: '#ff0000', badge: 'danger' },
  all: { bg: 'rgba(33, 37, 41, 0.05)', text: '#212529', badge: 'secondary' }
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ logs, onLevelFilter, currentLevel }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const stats = {
    debug: logs.filter(l => l.level === 'debug').length,
    info: logs.filter(l => l.level === 'info').length,
    success: logs.filter(l => l.level === 'success').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
    critical: logs.filter(l => l.level === 'critical').length,
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  const hasErrors = stats.error > 0 || stats.critical > 0

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <button 
          className="stats-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse stats' : 'Expand stats'}
        >
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3 className="stats-title">📊 Log Statistics</h3>
        </button>
        <div className="stats-total">
          <span className="stats-label">Total:</span>
          <span className="stats-count">{total}</span>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="stats-grid">
        <button
          className={`stat-card ${currentLevel === 'all' ? 'active' : ''}`}
          onClick={() => onLevelFilter('all')}
          style={{
            backgroundColor: currentLevel === 'all' ? levelColors.all.bg : 'transparent',
            borderColor: levelColors.all.text
          }}
        >
          <div className="stat-icon">📊</div>
          <div className="stat-label">All</div>
          <div className="stat-value">{total}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'debug' ? 'active' : ''}`}
          onClick={() => onLevelFilter('debug')}
          style={{
            backgroundColor: currentLevel === 'debug' ? levelColors.debug.bg : 'transparent',
            borderColor: levelColors.debug.text
          }}
        >
          <div className="stat-icon">{levelIcons.debug}</div>
          <div className="stat-label">Debug</div>
          <div className="stat-value" style={{ color: levelColors.debug.text }}>{stats.debug}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'info' ? 'active' : ''}`}
          onClick={() => onLevelFilter('info')}
          style={{
            backgroundColor: currentLevel === 'info' ? levelColors.info.bg : 'transparent',
            borderColor: levelColors.info.text
          }}
        >
          <div className="stat-icon">{levelIcons.info}</div>
          <div className="stat-label">Info</div>
          <div className="stat-value" style={{ color: levelColors.info.text }}>{stats.info}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'success' ? 'active' : ''}`}
          onClick={() => onLevelFilter('success')}
          style={{
            backgroundColor: currentLevel === 'success' ? levelColors.success.bg : 'transparent',
            borderColor: levelColors.success.text
          }}
        >
          <div className="stat-icon">{levelIcons.success}</div>
          <div className="stat-label">Success</div>
          <div className="stat-value" style={{ color: levelColors.success.text }}>{stats.success}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'warn' ? 'active' : ''}`}
          onClick={() => onLevelFilter('warn')}
          style={{
            backgroundColor: currentLevel === 'warn' ? levelColors.warn.bg : 'transparent',
            borderColor: levelColors.warn.text
          }}
        >
          <div className="stat-icon">{levelIcons.warn}</div>
          <div className="stat-label">Warn</div>
          <div className="stat-value" style={{ color: levelColors.warn.text }}>{stats.warn}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'error' ? 'active' : ''}`}
          onClick={() => onLevelFilter('error')}
          style={{
            backgroundColor: currentLevel === 'error' ? levelColors.error.bg : 'transparent',
            borderColor: levelColors.error.text
          }}
        >
          <div className="stat-icon">{levelIcons.error}</div>
          <div className="stat-label">Error</div>
          <div className="stat-value" style={{ color: levelColors.error.text }}>{stats.error}</div>
        </button>

        <button
          className={`stat-card ${currentLevel === 'critical' ? 'active' : ''}`}
          onClick={() => onLevelFilter('critical')}
          style={{
            backgroundColor: currentLevel === 'critical' ? levelColors.critical.bg : 'transparent',
            borderColor: levelColors.critical.text
          }}
        >
          <div className="stat-icon">{levelIcons.critical}</div>
          <div className="stat-label">Critical</div>
          <div className="stat-value" style={{ color: levelColors.critical.text }}>{stats.critical}</div>
        </button>
      </div>

      {hasErrors && (
        <div className="stats-alert">
          <span className="alert-icon">⚠️</span>
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
