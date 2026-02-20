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

  it('automatically calls onLoadMore when sentinel intersects', async () => {
    // Mock IntersectionObserver so we can trigger the callback
    const observers: Array<{ cb: IntersectionObserverCallback }> = []
    // @ts-ignore - test environment mock
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
    // @ts-ignore
    delete global.IntersectionObserver
  })
})