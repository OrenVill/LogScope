import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import { LogTable } from './LogTable'
import { logsApi } from '../api/logsService'
import type { LogEntry, LogSummary } from '../types/log'

vi.mock('../api/logsService', () => ({
  logsApi: {
    getLogById: vi.fn(),
  },
}))

const mockedLogsApi = logsApi as unknown as { getLogById: vi.Mock }

describe('LogTable (lazy details)', () => {
  const summary: LogSummary = {
    eventId: 'evt-1',
    timestamp: new Date().toISOString(),
    level: 'warn',
    subject: 'user-login',
    message: 'Short summary',
    source: { runtime: 'browser', serviceName: 'test-service' },
  }

  const full: LogEntry = {
    ...summary,
    data: { foo: 'bar' },
    source: {
      function: 'doLogin',
      file: 'auth.ts',
      process: 'web',
      runtime: 'browser',
      serviceName: 'test-service',
    },
    correlation: { requestId: 'r1' },
  }

  it('shows spinner then full details when expanding a summary', async () => {
    // Delay the mocked fetch so we can assert the loading state appears
    let resolveFetch: (value?: unknown) => void = () => {}
    const fetchPromise = new Promise((res: (v?: unknown) => void) => { resolveFetch = res })
    mockedLogsApi.getLogById.mockImplementationOnce(() => fetchPromise)

    render(<LogTable logs={[summary]} loading={false} sortBy="timestamp" onSort={() => {}} />)

    // Expand the row (click the arrow cell)
    const expandButton = screen.getByText('▶')
    fireEvent.click(expandButton)

    // Spinner should appear while loading details
    await waitFor(() => expect(screen.getByText(/Loading log details/i)).toBeInTheDocument())

    // Resolve the fetch and assert full details render
    await resolveFetch({ success: true, data: full })
    await waitFor(() => expect(screen.getByText(/Function:/i)).toBeInTheDocument())
    expect(screen.getByText(/doLogin/)).toBeInTheDocument()
  })

  it('replaces the archive source block with env, pod, route, and origin', () => {
    const archive: LogEntry = {
      eventId: 's3-err',
      timestamp: new Date().toISOString(),
      level: 'error',
      subject: 'POST /api/chat-stream 500',
      message: 'stream failed',
      data: { stack: 'Error: boom', message: 'stream failed', requestId: 'req-err-1' },
      source: {
        function: 'archive',
        file: 's3://prod/api',
        process: 'api-abc',
        runtime: 'node',
        serviceName: 'api',
        env: 'prod',
        pod: 'api-abc',
        method: 'POST',
        path: '/api/chat-stream',
        status: 500,
        origin: 'archive',
      },
      correlation: { requestId: 'req-err-1' },
    }

    render(<LogTable logs={[archive]} loading={false} sortBy="timestamp" onSort={() => {}} />)
    expect(screen.getByText('archive')).toBeInTheDocument()
    fireEvent.click(screen.getByText('▶'))

    expect(screen.getByText('prod')).toBeInTheDocument()
    expect(screen.getByText('api-abc')).toBeInTheDocument()
    expect(screen.getByText('/api/chat-stream')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('req-err-1')).toBeInTheDocument()
    expect(screen.queryByText(/Function:/i)).not.toBeInTheDocument()
    expect(screen.queryByText('s3://prod/api')).not.toBeInTheDocument()
    expect(screen.queryByText('Node.js')).not.toBeInTheDocument()
    expect(screen.queryByText('unknown')).not.toBeInTheDocument()
  })

  it('groups repeated status lines that are not next to each other', () => {
    const probe = (eventId: string, seconds: number): LogSummary => ({
      eventId,
      timestamp: new Date(Date.now() - seconds * 1000).toISOString(),
      level: 'info',
      subject: 'API',
      message: 'GET /status - 200',
      source: { runtime: 'node', serviceName: 'api' },
    })
    const other: LogSummary = {
      eventId: 'other',
      timestamp: new Date(Date.now() - 8000).toISOString(),
      level: 'info',
      subject: 'checkout.start',
      message: 'Checkout started',
      source: { runtime: 'node', serviceName: 'api' },
    }

    render(
      <LogTable
        logs={[probe('p1', 0), other, probe('p2', 5), probe('p3', 15)]}
        loading={false}
        sortBy="timestamp"
        onSort={() => {}}
      />
    )

    expect(screen.getAllByText('GET /status - 200')).toHaveLength(1)
    expect(screen.getByText('×3')).toBeInTheDocument()
    expect(screen.getByText('Checkout started')).toBeInTheDocument()
    expect(screen.getAllByText('▶')).toHaveLength(2)
  })

  it('renders a real bucket status probe without the archive placeholders', () => {
    const probe: LogEntry = {
      eventId: 's3-probe',
      timestamp: new Date().toISOString(),
      level: 'info',
      subject: 'GET /status - 200',
      message: 'GET /status - 200',
      data: { requestId: 'req-probe', userAgent: 'kube-probe/1.34' },
      source: {
        function: 'archive',
        file: 's3://dev/api',
        process: 'unknown',
        runtime: 'node',
        serviceName: 'api',
      },
      correlation: { requestId: 'req-probe' },
    }

    render(<LogTable logs={[probe]} loading={false} sortBy="timestamp" onSort={() => {}} />)
    expect(screen.getByText('live')).toBeInTheDocument()
    fireEvent.click(screen.getByText('▶'))
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('/status')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.queryByText(/Function:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/s3:\/\//)).not.toBeInTheDocument()
    expect(screen.queryByText('unknown')).not.toBeInTheDocument()
    expect(screen.queryByText('Node.js')).not.toBeInTheDocument()
  })

  it('automatically calls onLoadMore when sentinel intersects', async () => {
    // Mock IntersectionObserver so we can trigger the callback
    const observers: Array<{ cb: IntersectionObserverCallback }> = []
    // @ts-expect-error - test environment mock
    global.IntersectionObserver = class {
      cb: IntersectionObserverCallback
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb
        observers.push({ cb })
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    const onLoadMore = vi.fn()

    render(
      <LogTable
        logs={[summary]}
        loading={false}
        loadingMore={false}
        hasMore={true}
        sortBy="timestamp"
        onSort={() => {}}
        onLoadMore={onLoadMore}
      />
    )

    // Trigger the observer callbacks as if sentinel entered viewport
    observers.forEach(o => o.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))

    expect(onLoadMore).toHaveBeenCalled()

    // Clean up mock
    // @ts-expect-error - clean up mocked IntersectionObserver
    delete global.IntersectionObserver
  })
})