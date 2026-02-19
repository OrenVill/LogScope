import { useState, useEffect, useRef } from 'react'
import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable } from './components/LogTable'
import { RealTimeToggle } from './components/RealTimeToggle'
import { logsApi } from './api/logsService'
import type { LogEntry, SearchFilters } from './types/api'

interface ErrorState {
  message: string
  code?: string
  isRateLimit?: boolean
}

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorState | null>(null)
  const [isRealTime, setIsRealTime] = useState(false)
  const [sortBy, setSortBy] = useState<'timestamp' | 'level'>('timestamp')
  const [runtime, setRuntime] = useState<'frontend' | 'backend' | 'all'>('all')
  const [hasCritical, setHasCritical] = useState(false)
  const [hasNoIssues, setHasNoIssues] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Load logs from API
  const loadLogs = async (filters?: SearchFilters) => {
    setLoading(true)
    setError(null)
    try {
      const response = await logsApi.searchLogs(filters || {}, { limit: 100, offset: 0 })
      if (response.success) {
        setLogs(response.data || [])
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
    }
  }

  // Load logs on mount
  useEffect(() => {
    loadLogs()
  }, [])

  // Check for critical logs and issues
  useEffect(() => {
    const hasCriticalLog = logs.some(log => log.level === 'critical')
    setHasCritical(hasCriticalLog)
    
    const hasIssues = logs.some(log => ['error', 'warn', 'critical'].includes(log.level))
    setHasNoIssues(!hasIssues && logs.length > 0)
  }, [logs])

  // Filter logs by runtime
  const filteredLogs = logs.filter(log => {
    if (runtime === 'all') return true
    return log.source.runtime === (runtime === 'backend' ? 'node' : 'browser')
  })

  // Connect to WebSocket
  const connectWebSocket = (filters?: { level?: string; subject?: string }) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    wsRef.current = logsApi.connectWebSocket(
      (log: LogEntry) => {
        setLogs((prev) => [log, ...prev.slice(0, 99)])
      },
      (error: Error) => {
        setError({
          message: `WebSocket error: ${error.message}`,
          code: 'WEBSOCKET_ERROR',
        })
      },
      filters
    )
  }

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  // Toggle real-time mode
  const toggleRealTime = (enabled: boolean) => {
    setIsRealTime(enabled)
    if (enabled) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }
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
  }, [])

  return (
    <div className="app d-flex flex-column h-100">
      <header className="app-header bg-dark text-white py-4 px-4 shadow-sm">
        <div className="container-fluid d-flex justify-content-between align-items-start">
          <div>
            <h1 className="mb-2 display-6">LogScope</h1>
            <p className="text-white-50 mb-0">Structured log collection and query service</p>
          </div>
          <div className="d-flex flex-column gap-2">
            {hasCritical && (
              <div className="mb-0 d-flex align-items-center gap-3" style={{
                backgroundColor: '#ff0000',
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
        </div>
      </header>

      <div className="app-container flex-grow-1 overflow-hidden d-flex gap-3 p-3">
        <aside className="sidebar bg-white rounded shadow-sm p-4 overflow-auto" style={{ width: '300px' }}>
          <FilterPanel onSearch={loadLogs} isRealTime={isRealTime} />
          <hr className="my-4" />
          <RealTimeToggle isEnabled={isRealTime} onToggle={toggleRealTime} />
        </aside>

        <main className="main-content bg-white rounded shadow-sm flex-grow-1 overflow-auto p-4">
          {error && (
            <div className={`${getErrorAlertClass()} alert-dismissible fade show mb-3`} role="alert">
              <strong>{error.isRateLimit ? 'Rate Limit:' : 'Error:'}</strong> {getErrorMessage()}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}
          
          <div className="mb-4 d-flex gap-2">
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
          </div>

          <LogTable logs={filteredLogs} loading={loading} sortBy={sortBy} onSort={setSortBy} />
        </main>
      </div>
    </div>
  )
}

export default App
