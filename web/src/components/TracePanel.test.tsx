import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { TracePanel } from './TracePanel'
import { logsApi } from '../api/logsService'

vi.mock('../api/logsService', () => ({
  logsApi: {
    getCorrelatedByRequestId: vi.fn(),
    getCorrelatedBySessionId: vi.fn(),
  },
}))

const mocked = logsApi as unknown as { getCorrelatedByRequestId: ReturnType<typeof vi.fn> }

describe('TracePanel', () => {
  it('shows the request timeline in chronological order', async () => {
    mocked.getCorrelatedByRequestId.mockResolvedValue({
      success: true,
      data: [
        {
          eventId: 'late',
          timestamp: '2026-01-02T00:00:00Z',
          level: 'error',
          subject: 'db',
          message: 'query failed',
          source: { function: 'q', file: '/tmp/q.ts', process: 'api', runtime: 'node', serviceName: 'api' },
          correlation: { requestId: 'req-1' },
        },
        {
          eventId: 'early',
          timestamp: '2026-01-01T00:00:00Z',
          level: 'info',
          subject: 'auth',
          message: 'started',
          source: { function: 'a', file: '/tmp/a.ts', process: 'api', runtime: 'node', serviceName: 'api' },
          correlation: { requestId: 'req-1' },
        },
      ],
    })

    render(<TracePanel kind="request" id="req-1" onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('started')).toBeInTheDocument())
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('started')
    expect(items[1]).toHaveTextContent('query failed')
  })
})
