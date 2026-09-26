import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable } from './components/LogTable'
import { StatsPanel } from './components/StatsPanel'
import { logsApi } from './api/logsService'
import type { LogEntry, LogLevel, SearchFilters, ArchiveConfig } from './types/api'

interface ErrorState {
  message: string
  code?: string
  isRateLimit?: boolean
}

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<ErrorState | null>(null)
  const [isRealTime, setIsRealTime] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('logscope-dark-mode')
    return saved ? JSON.parse(saved) : false
  })
  const [sortBy, setSortBy] = useState<'timestamp' | 'level'>('timestamp')
  const [runtime, setRuntime] = useState<'frontend' | 'backend' | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [archiveConfig, setArchiveConfig] = useState<ArchiveConfig | null>(null)
  const [archiveDailyStats, setArchiveDailyStats] = useState<{ info: number; warn: number; error: number } | null>(null)
  const [hasCritical, setHasCritical] = useState(false)
  const [hasNoIssues, setHasNoIssues] = useState(false)
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef<number>(offset)
  useEffect(() => { offsetRef.current = offset }, [offset])

  const [currentFilters, setCurrentFilters] = useState<SearchFilters | undefined>(undefined)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearKeepStarred, setClearKeepStarred] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('logscope-sidebar-collapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const PAGE_SIZE = 20

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('logscope-sidebar-collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.documentElement.classList.add('is-resizing')
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !sidebarRef.current) return

      const container = sidebarRef.current.parentElement
      if (!container) return

      const newWidth = e.clientX - container.getBoundingClientRect().left
      if (newWidth >= 240 && newWidth <= 460) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.documentElement.classList.remove('is-resizing')
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.bsTheme = isDarkMode ? 'dark' : 'light'
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light'
  }, [isDarkMode])

  // Periodically sync totalCount from server to detect cleanup events
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const response = await logsApi.searchLogs(currentFilters || {}, { limit: 1, offset: 0 })
        if (response.success && response.total !== undefined) {
          const newTotal = response.total
          setTotalCount(prev => {
            // If server total dropped significantly (cleanup happened), reset pagination
            if (newTotal < prev * 0.8) {
              console.log(`[Sync] Cleanup detected: ${prev} → ${newTotal}. Resetting pagination.`)
              setOffset(0)
              offsetRef.current = 0
              setHasMore(newTotal > 0)
            }
            return newTotal
          })
        }
      } catch {
        // Silently ignore sync errors
      }
    }, 3000) // Check every 3 seconds

    return () => clearInterval(syncInterval)
  }, [currentFilters])

  // Ensure logs are unique by eventId (dedupe helper)
  const dedupeByEventId = (items: LogEntry[]) => {
    const seen = new Set<string>()
    return items.filter(item => {
      if (seen.has(item.eventId)) return false
      seen.add(item.eventId)
      return true
    })
  }

  // Load logs from API
  // loadLogs: when reset=true we replace the list (initial search/filter); when false we append (load more)
  // NOTE: use a ref for `offset` so `loadLogs` identity stays stable and doesn't re-trigger
  // FilterPanel.auto-apply via changing onSearch prop (prevents feedback loop).
  const loadLogs = useCallback(async (filters?: SearchFilters, reset: boolean = true) => {
      if (reset) {
      setLoading(true)
      setError(null)
      setOffset(0)
      offsetRef.current = 0
      setCurrentFilters(filters)
    } else {
      setLoadingMore(true)
    }

    try {
      const currentOffset = reset ? 0 : offsetRef.current
      const response = await logsApi.searchLogs(filters || {}, { limit: PAGE_SIZE, offset: currentOffset })

      if (response.success) {
        const returned = response.data || []

        if (reset) {
          setLogs(dedupeByEventId(returned))
        } else {
          setLogs(prev => dedupeByEventId([...prev, ...returned]))
        }

        // Show server's total count, not just what we've loaded
        const serverTotal = response.total || 0
        setTotalCount(serverTotal)

        const newTotal = (reset ? returned.length : offsetRef.current + returned.length)
        setOffset(newTotal)
        offsetRef.current = newTotal
        // hasMore is true if we got a full page back (more might exist).
        // Ignore response.total since it can decrease due to cleanup/deletion.
        setHasMore(returned.length === PAGE_SIZE)
      } else {
        const isRateLimit = response.errorCode === 'RATE_LIMIT_EXCEEDED'
        setError({
          message: response.error,
          code: response.errorCode,
          isRateLimit,
        })
      }
    } catch (err) {
      setError({
        message: (err as Error).message,
        code: 'UNKNOWN_ERROR',
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const cfg = await logsApi.getArchiveConfig()
      if (cfg.success && cfg.data) {
        setArchiveConfig(cfg.data)
      }
    })()
  }, [])

  const refreshDailyStats = useCallback(async (filters?: SearchFilters) => {
    if (!archiveConfig?.readOnly) {
      setArchiveDailyStats(null)
      return
    }
    const res = await logsApi.getDailyStats(filters || {})
    if (res.success && res.data) {
      setArchiveDailyStats({
        info: res.data.info,
        warn: res.data.warn,
        error: res.data.error,
      })
    } else {
      setArchiveDailyStats(null)
    }
  }, [archiveConfig?.readOnly])

  // Load initial page on mount
  useEffect(() => {
    loadLogs(undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (archiveConfig?.readOnly) {
      void refreshDailyStats(currentFilters)
    }
  }, [archiveConfig?.readOnly, currentFilters, refreshDailyStats])

  // Auto-connect WebSocket if real-time mode is enabled
  useEffect(() => {
    if (isRealTime) {
      connectWebSocket(currentFilters)
    } else {
      disconnectWebSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealTime])

  // Load more logs (called from UI / LogTable)
  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    await loadLogs(undefined, false)
  }

  // Check for critical logs and issues
  useEffect(() => {
    const hasCriticalLog = logs.some(log => log.level === 'critical')
    setHasCritical(hasCriticalLog)
    
    const hasIssues = logs.some(log => (['error', 'warn', 'critical'] as LogLevel[]).includes(log.level))
    setHasNoIssues(!hasIssues && logs.length > 0)
  }, [logs])

  // Filter logs by runtime and level
  const filteredLogs = logs.filter(log => {
    const runtimeMatch = runtime === 'all' || log.source.runtime === (runtime === 'backend' ? 'node' : 'browser')
    const levelMatch = levelFilter === 'all' || log.level === levelFilter
    return runtimeMatch && levelMatch
  })

  // Connect to WebSocket (stable identity to avoid re-creating handlers)
  const connectWebSocket = useCallback((filters?: SearchFilters) => {
    // If a socket is already open or connecting, don't recreate it (avoids StrictMode double-invoke noise)
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    // Clean up any stale socket references that are CLOSED/ERROR
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CLOSING || wsRef.current.readyState === WebSocket.CLOSED)) {
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
    }

    // Suppress benign errors that can occur when React StrictMode mounts/unmounts quickly in dev
    let ignoreInitialErrors = true

    wsRef.current = logsApi.connectWebSocket(
      (log: LogEntry) => {
        setLogs((prev) => {
          // remove any existing entry with same eventId then append the new one at the bottom
          const filtered = prev.filter(p => p.eventId !== log.eventId)
          return [...filtered, log]
        })
        // New log arrived: enable pagination again in case cleanup has removed old logs
        setHasMore(true)
        // Increment total count (a new log was added server-side)
        setTotalCount(prev => prev + 1)
      },
      (error: Error) => {
        // If we're still in the initial connect window and socket isn't open yet, ignore the error
        if (ignoreInitialErrors && wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          return
        }

        setError({
          message: `WebSocket error: ${error.message}`,
          code: 'WEBSOCKET_ERROR',
        })
      },
      filters
        ? {
            level: filters.level,
            subject: filters.subject,
            env: filters.env,
            service: filters.service,
          }
        : undefined
    )

    // Clear the ignore flag once the socket opens or after a short timeout
    if (wsRef.current) {
      wsRef.current.addEventListener('open', () => { ignoreInitialErrors = false })
      setTimeout(() => { ignoreInitialErrors = false }, 2000)
    }
  }, [])

  // Disconnect WebSocket (stable identity)
  const disconnectWebSocket = useCallback(() => {
    // Ensure the API client's internal reconnect loop is stopped first
    try { logsApi.closeWebSocket() } catch { /* ignore */ }

    if (!wsRef.current) return

    const cur = wsRef.current

    try {
      // Only call close when the socket is open; avoid closing a CONNECTING socket (prevents the dev-only browser message)
      if (cur.readyState === WebSocket.OPEN) {
        cur.close()
      } else {
        // Remove our handlers so a late error/close won't propagate to the app
        try { cur.onopen = null } catch { /* ignore */ }
        try { cur.onmessage = null } catch { /* ignore */ }
        try { cur.onerror = null } catch { /* ignore */ }
        try { cur.onclose = null } catch { /* ignore */ }
      }
    } catch {
      /* ignore */
    }

    wsRef.current = null
  }, [])

  // Memoized handler passed to FilterPanel to prevent auto-apply from retriggering
  const handleSearch = useCallback((f?: SearchFilters) => {
    loadLogs(f, true);
    void refreshDailyStats(f);

    if (!isRealTime) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          filters: f
            ? {
                level: f.level,
                subject: f.subject,
                env: f.env,
                service: f.service,
              }
            : undefined,
        }));
        return;
      } catch {
        // fallback to reconnect if send fails
        disconnectWebSocket();
        connectWebSocket(f);
        return;
      }
    }

    // if no socket exists, create one with filters
    connectWebSocket(f);
  }, [isRealTime, loadLogs, connectWebSocket, disconnectWebSocket, refreshDailyStats]);

  // Toggle real-time mode
  const toggleRealTime = (enabled: boolean) => {
    setIsRealTime(enabled)
    if (enabled) {
      connectWebSocket(currentFilters)
    } else {
      disconnectWebSocket()
    }
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => {
      const newValue = !prev
      localStorage.setItem('logscope-dark-mode', JSON.stringify(newValue))
      return newValue
    })
  }

  // Get error alert class based on error code
  const getErrorAlertClass = () => {
    if (error?.isRateLimit) return 'banner banner-warn'
    return 'banner banner-danger'
  }

  // Get error message with helpful context
  const getErrorMessage = () => {
    if (error?.isRateLimit) {
      return `${error.message} Please wait a moment before trying again.`
    }
    return error?.message || 'An error occurred'
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket()
    }
  }, [disconnectWebSocket])

  // Clear all logs
  const handleClearLogs = async () => {
    setIsClearing(true)
    try {
      await logsApi.clearAllLogs(clearKeepStarred)
      setShowClearModal(false)
      // Reload from server: this shows any kept starred logs immediately and updates totalCount
      await loadLogs(currentFilters, true)
    } catch (err) {
      setError({ message: (err as Error).message, code: 'CLEAR_ERROR' })
      setShowClearModal(false)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="app" data-bs-theme={isDarkMode ? 'dark' : 'light'}>
      <header className="topbar">
        <div className="brand">
          <img src="/mark.svg" alt="" className="brand-mark" />
          <div>
            <h1>Log<span>Scope</span></h1>
            <p>Precision log inspection</p>
          </div>
        </div>

        <div className="topbar-status">
          {hasCritical && (
            <div className="status-pill status-pill-critical" role="status">
              <span className="status-dot" aria-hidden="true" />
              <span>
                <strong>Critical</strong>
                <small>A critical event is in view</small>
              </span>
            </div>
          )}
          {hasNoIssues && (
            <div className="status-pill status-pill-ok" role="status">
              <span className="status-dot" aria-hidden="true" />
              <span>
                <strong>Clear</strong>
                <small>No warnings or errors in view</small>
              </span>
            </div>
          )}
        </div>

        <div className="topbar-actions">
          <label className={`live-switch${isRealTime ? ' is-on' : ''}`} htmlFor="rtToggle">
            <input
              className="form-check-input"
              type="checkbox"
              id="rtToggle"
              checked={isRealTime}
              onChange={(e) => toggleRealTime(e.target.checked)}
            />
            {isRealTime ? 'Live' : 'Historical'}
          </label>

          <button
            className="icon-btn"
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            aria-label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M16.5 13.2A6.8 6.8 0 0 1 10.7 4 7.2 7.2 0 1 0 16.5 13.2Z" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <button
            className="icon-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
              <path d="M9.5 4.5v15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside
          ref={sidebarRef}
          className={`sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}
          style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
        >
          {!sidebarCollapsed && (
            <div
              className="sidebar-resize-handle"
              onMouseDown={handleMouseDown}
              title="Drag to resize sidebar"
              role="separator"
              aria-orientation="vertical"
            />
          )}

          {sidebarCollapsed ? (
            <div className="sidebar-collapsed-mark">Filters</div>
          ) : (
            <FilterPanel
              onSearch={handleSearch}
              isRealTime={isRealTime}
              showArchiveFilters={archiveConfig?.readOnly === true}
              defaultEnv={archiveConfig?.defaultEnv}
              defaultService={archiveConfig?.defaultService}
            />
          )}
        </aside>

        <main className="stage">
          {error && (
            <div className={getErrorAlertClass()} role="alert">
              <div>
                <strong>{error.isRateLimit ? 'Rate limit' : 'Error'}</strong>
                <span>{getErrorMessage()}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <div className="stream-toolbar">
            <div className="segmented" role="group" aria-label="Runtime">
              <button className={runtime === 'all' ? 'is-active' : ''} onClick={() => setRuntime('all')}>All</button>
              <button className={runtime === 'backend' ? 'is-active' : ''} onClick={() => setRuntime('backend')}>Backend</button>
              <button className={runtime === 'frontend' ? 'is-active' : ''} onClick={() => setRuntime('frontend')}>Frontend</button>
            </div>
            <p className="pin-hint">Pin a log to keep it through cleanup.</p>
            <button
              className="btn-danger"
              onClick={() => setShowClearModal(true)}
              title="Permanently delete all log entries"
            >
              Clear logs
            </button>
          </div>

          {showClearModal && (
            <div className="modal-layer">
              <button className="modal-scrim" aria-label="Close dialog" onClick={() => setShowClearModal(false)} />
              <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="clearModalTitle">
                <p className="dialog-kicker">Destructive</p>
                <h2 id="clearModalTitle">Clear all logs</h2>
                <p>This permanently deletes log entries. You cannot undo it.</p>
                <div className="keep-starred">
                  <input
                    type="checkbox"
                    id="keepStarredCheck"
                    checked={clearKeepStarred}
                    onChange={(e) => setClearKeepStarred(e.target.checked)}
                  />
                  <label htmlFor="keepStarredCheck">Keep pinned logs</label>
                </div>
                <div className="dialog-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowClearModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleClearLogs}
                    disabled={isClearing}
                  >
                    {isClearing ? <><span className="spinner" role="status" aria-hidden="true" />Clearing…</> : 'Clear logs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <StatsPanel
            logs={filteredLogs}
            onLevelFilter={setLevelFilter}
            currentLevel={levelFilter}
            archiveDailyStats={archiveDailyStats}
          />

          <LogTable
            logs={filteredLogs}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            sortBy={sortBy}
            onSort={setSortBy}
            onLoadMore={loadMore}
            totalCount={totalCount}
          />
        </main>
      </div>
    </div>
  )
}

export default App
