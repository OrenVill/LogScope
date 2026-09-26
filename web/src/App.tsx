import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable, type TraceTarget } from './components/LogTable'
import { StatsPanel } from './components/StatsPanel'
import { TracePanel } from './components/TracePanel'
import { ContextPanel } from './components/ContextPanel'
import { logsApi } from './api/logsService'
import { acceptLiveLog, flushPending, newestWithLevel } from './lib/inspection'
import type { LogEntry, LogLevel, SearchFilters } from './types/api'

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
  const [pendingCount, setPendingCount] = useState(0)
  const [followTick, setFollowTick] = useState(0)
  const [focusEventId, setFocusEventId] = useState<string | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [trace, setTrace] = useState<TraceTarget | null>(null)
  const [contextEventId, setContextEventId] = useState<string | null>(null)
  const [filterPreset, setFilterPreset] = useState<{ nonce: number; filters: SearchFilters } | null>(null)
  const followingRef = useRef(true)
  const expandHoldRef = useRef(false)
  const pendingRef = useRef<LogEntry[]>([])
  const stageRef = useRef<HTMLElement | null>(null)
  const loadLogsRef = useRef<(filters?: SearchFilters, reset?: boolean) => Promise<void>>(async () => {})
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
            if (newTotal < prev * 0.8) {
              console.log(`[Sync] Cleanup detected: ${prev} → ${newTotal}. Reloading logs.`)
              setOffset(0)
              offsetRef.current = 0
              setHasMore(newTotal > 0)
              pendingRef.current = []
              setPendingCount(0)
              void loadLogsRef.current(currentFilters, true)
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
    loadLogsRef.current = loadLogs
  }, [loadLogs])

  // Load initial page on mount
  useEffect(() => {
    loadLogs(undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const runtimeLogs = logs.filter(log => runtime === 'all' || log.source.runtime === (runtime === 'backend' ? 'node' : 'browser'))
  const filteredLogs = runtimeLogs.filter(log => levelFilter === 'all' || log.level === levelFilter)

  const releasePending = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = []
    setPendingCount(0)
    if (pending.length) setLogs(prev => flushPending(prev, pending))
  }, [])

  const handleFollowChange = useCallback((atBottom: boolean) => {
    followingRef.current = atBottom
    if (atBottom && !expandHoldRef.current) releasePending()
  }, [releasePending])

  const handleExpandedChange = useCallback((open: boolean) => {
    expandHoldRef.current = open
    if (!open && followingRef.current) releasePending()
  }, [releasePending])

  const resumeTail = () => {
    followingRef.current = true
    releasePending()
    setFollowTick(tick => tick + 1)
  }

  const jumpToCritical = () => {
    const newest = newestWithLevel(logs, 'critical')
    setRuntime('all')
    setLevelFilter('critical')
    if (!newest) return
    setFocusEventId(newest.eventId)
    setFocusNonce(nonce => nonce + 1)
  }

  const focusSearch = () => {
    setSidebarCollapsed(false)
    requestAnimationFrame(() => document.getElementById('filter-text')?.focus())
  }

  const applyValueFilter = (filters: SearchFilters) => {
    setRuntime('all')
    setLevelFilter('all')
    setSidebarCollapsed(false)
    setFilterPreset({ nonce: Date.now(), filters })
  }

  const exportView = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'logscope-view.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Connect to WebSocket (stable identity to avoid re-creating handlers)
  const connectWebSocket = useCallback((filters?: { level?: string; subject?: string }) => {
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
        const paused = !followingRef.current || expandHoldRef.current
        if (paused) {
          pendingRef.current = acceptLiveLog(true, [], pendingRef.current, log).pending
          setLogs(prev => prev.filter(item => item.eventId !== log.eventId))
          setPendingCount(pendingRef.current.length)
        } else {
          setLogs(prev => acceptLiveLog(false, prev, [], log).logs)
          setFollowTick(tick => tick + 1)
        }
        setHasMore(true)
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

    if (!isRealTime) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', filters: f }));
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
  }, [isRealTime, loadLogs, connectWebSocket, disconnectWebSocket]);

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
            <button type="button" className="status-pill status-pill-critical" onClick={jumpToCritical}>
              <span className="status-dot" aria-hidden="true" />
              <span>
                <strong>Critical</strong>
                <small>Jump to the newest critical event</small>
              </span>
            </button>
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
            <FilterPanel onSearch={handleSearch} isRealTime={isRealTime} preset={filterPreset} />
          )}
        </aside>

        <main className="stage" ref={stageRef}>
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
            <p className="pin-hint">Pin a log to keep it through cleanup. Keys: / search, j k move, Enter open, s pin.</p>
            <button
              className="btn-ghost"
              onClick={exportView}
              title="Download the logs currently loaded in this view"
            >
              Export view
            </button>
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

          <StatsPanel logs={runtimeLogs} onLevelFilter={setLevelFilter} currentLevel={levelFilter} />

          <LogTable
            logs={filteredLogs}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            sortBy={sortBy}
            onSort={setSortBy}
            onLoadMore={loadMore}
            totalCount={totalCount}
            focusEventId={focusEventId}
            focusNonce={focusNonce}
            followTick={followTick}
            scrollRootRef={stageRef}
            onFollowChange={handleFollowChange}
            onExpandedChange={handleExpandedChange}
            onOpenTrace={setTrace}
            onOpenContext={setContextEventId}
            onApplyFilter={applyValueFilter}
            onFocusSearch={focusSearch}
          />

          {pendingCount > 0 && (
            <div className="tail-chip-wrap">
              <button type="button" className="tail-chip" onClick={resumeTail}>
                {pendingCount} new
              </button>
            </div>
          )}

          {trace && (
            <TracePanel kind={trace.kind} id={trace.id} onClose={() => setTrace(null)} />
          )}
          {contextEventId && (
            <ContextPanel eventId={contextEventId} onClose={() => setContextEventId(null)} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
