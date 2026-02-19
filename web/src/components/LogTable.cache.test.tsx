import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { LogTable } from './LogTable'
import { logsApi } from '../api/logsService'
import type { LogSummary, LogEntry } from '../types/log'

vi.mock('../api/logsService', () => ({ logsApi: { getLogById: vi.fn() } }))
const mocked = logsApi as unknown as { getLogById: vi.Mock }

describe('LogTable caching', () => {
  const summary: LogSummary = {
    eventId: 'cache-1',
    timestamp: new Date().toISOString(),
    level: 'info',
    subject: 's',
    message: 'm',
    source: { runtime: 'browser', serviceName: 'svc' },
  }

  const full: LogEntry = {
    ...summary,
    source: { function: 'f', file: 'f.ts', process: 'p', runtime: 'browser', serviceName: 'svc' },
    data: { x: 1 },
    correlation: {}
  }

  it('does not refetch details if already cached', async () => {
    mocked.getLogById.mockResolvedValue({ success: true, data: full })

    render(<LogTable logs={[summary]} loading={false} sortBy="timestamp" onSort={() => {}} />)

    const arrow = screen.getByText('▶')
    fireEvent.click(arrow)

    await waitFor(() => expect(screen.getByText(/Function:/i)).toBeInTheDocument())

    // Collapse
    fireEvent.click(screen.getByText('▼'))

    // Expand again
    fireEvent.click(screen.getByText('▶'))

    await waitFor(() => expect(screen.getByText(/Function:/i)).toBeInTheDocument())

    // getLogById should have been called exactly once
    expect(mocked.getLogById).toHaveBeenCalledTimes(1)
  })
})