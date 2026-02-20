import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable } from './components/LogTable'
import { logsApi } from './api/logsService'
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
  const [levelFilter] = useState<LogLevel | 'all'>('all')
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

  // Handle sidebar resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !sidebarRef.current) return
      
      const container = sidebarRef.current.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      
      // Constrain width between 200px and 450px
      if (newWidth >= 200 && newWidth <= 450) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      isResizing.current = false
    }

    if (isResizing.current) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [])

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

  // Filter logs by runtime and level
  const filteredLogs = logs.filter(log => {
    const runtimeMatch = runtime === 'all' || log.source.runtime === (runtime === 'backend' ? 'node' : 'browser')
    const levelMatch = levelFilter === 'all' || log.level === levelFilter
    return runtimeMatch && levelMatch
  })

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
    if (error?.isRateLimit) return 'alert alert-warning'
    return 'alert alert-danger'
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
    <div className="app d-flex flex-column h-100" data-bs-theme={isDarkMode ? 'dark' : 'light'}>
      <header className="app-header bg-dark text-white py-2 px-4 shadow">
        <div className="container-fluid d-flex justify-content-between align-items-center">
          <div className="app-logo-container">
            <h1 className="visually-hidden">LogScope</h1>
            <img src="/logo.svg" alt="LogScope Logo" className="app-logo" />
          </div>
          
          <div className="d-flex flex-column gap-2">
            {hasCritical && (
              <div className="mb-0 d-flex align-items-center gap-3" style={{
                backgroundColor: '#a80000',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '4px',
                animation: 'pulse-alert 0.8s infinite',
                fontWeight: 600
              }}>
                <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🚨</div>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>CRITICAL ALERT</strong><br />
                  <small>Critical logs detected in the system</small>
                </div>
              </div>
            )}
            {hasNoIssues && (
              <div className="mb-0 d-flex align-items-center gap-3" style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '4px',
                animation: 'pulse-success 1.2s infinite',
                fontWeight: 600
              }}>
                <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>✅</div>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>ALL SYSTEMS OPERATIONAL</strong><br />
                  <small>No errors, warnings, or critical logs</small>
                </div>
              </div>
            )}
          </div>

          <div className="d-flex align-items-center gap-3" style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-sm btn-outline-light"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            style={{ fontSize: '1.2rem', padding: '4px 8px' }}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>

          <button
            className="btn btn-sm btn-outline-light"
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            style={{ fontSize: '1.2rem', padding: '4px 8px' }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

            <div className="d-flex align-items-center gap-2" style={{ minWidth: '180px' }}>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="rtToggle"
                  checked={isRealTime}
                  onChange={(e) => toggleRealTime(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label className="form-check-label" htmlFor="rtToggle" style={{ cursor: 'pointer', marginBottom: 0, fontSize: '0.9rem' }}>
                  {isRealTime ? '🟢 Live' : '⚪ Historical'}
                </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="app-container flex-grow-1 overflow-hidden d-flex gap-3 p-3" style={{ position: 'relative' }}>
        <aside 
          ref={sidebarRef}
          className="sidebar bg-body rounded shadow-sm p-4 overflow-auto"
          style={{ 
            width: sidebarCollapsed ? '50px' : `${sidebarWidth}px`,
            minWidth: sidebarCollapsed ? '50px' : '200px',
            maxWidth: sidebarCollapsed ? '50px' : '450px',
            transition: 'width 0.3s ease',
            position: 'relative',
            flexShrink: 0
          }}
        >
          {/* Resize handle */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Drag to resize sidebar"
            />
          )}
          
          {/* Collapse/expand indicator when collapsed */}
          {sidebarCollapsed && (
            <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '100px' }}>
              <span style={{ fontSize: '0.75rem', color: '#999' }} title="Sidebar collapsed">⋮</span>
            </div>
          )}

          {/* Filter panel - hidden when collapsed */}
          {!sidebarCollapsed && (
            <FilterPanel onSearch={handleSearch} isRealTime={isRealTime} />
          )}
        </aside>

        <main className="main-content bg-body rounded shadow-sm flex-grow-1 overflow-auto p-4">
          {error && (
            <div className={`${getErrorAlertClass()} alert-dismissible fade show mb-3`} role="alert">
              <strong>{error.isRateLimit ? 'Rate Limit:' : 'Error:'}</strong> {getErrorMessage()}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}

          <div className="mb-4 d-flex gap-2 align-items-center flex-wrap">
            <button 
              className={`btn btn-sm ${runtime === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setRuntime('all')}
            >
              All Logs
            </button>
            <button 
              className={`btn btn-sm ${runtime === 'backend' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setRuntime('backend')}
            >
              🖥️ Backend
            </button>
            <button 
              className={`btn btn-sm ${runtime === 'frontend' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setRuntime('frontend')}
            >
              🌐 Frontend
            </button>
            <span className="text-muted small ms-auto me-2" style={{ fontSize: '0.78rem' }}>
              ⭐ Star a log to protect it from auto-deletion
            </span>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => setShowClearModal(true)}
              title="Permanently delete all log entries"
            >
              🗑️ Clear All Logs
            </button>
          </div>

          {/* Clear All Logs confirmation modal */}
          {showClearModal && (
            <>
              <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="clearModalTitle">
                <div className="modal-dialog modal-dialog-centered">
                  <div className="modal-content border-danger">
                    <div className="modal-header bg-danger text-white">
                      <h5 className="modal-title" id="clearModalTitle">⚠️ Clear All Logs</h5>
                      <button type="button" className="btn-close btn-close-white" onClick={() => setShowClearModal(false)} aria-label="Close" />
                    </div>
                    <div className="modal-body">
                      <p className="mb-3">
                        <strong>This will permanently delete all log entries.</strong> This action cannot be undone.
                      </p>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="keepStarredCheck"
                          checked={clearKeepStarred}
                          onChange={(e) => setClearKeepStarred(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="keepStarredCheck">
                          ⭐ Keep pinned logs
                        </label>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowClearModal(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleClearLogs}
                        disabled={isClearing}
                      >
                        {isClearing ? (
                          <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Clearing…</>
                        ) : '🗑️ Clear All Logs'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop fade show" onClick={() => setShowClearModal(false)} />
            </>
          )}

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
