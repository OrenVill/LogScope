import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsPanel } from './StatsPanel'
import type { LogEntry } from '../types/api'

describe('StatsPanel', () => {
  const make = (level: string): LogEntry => ({
    eventId: `e-${level}`,
    timestamp: new Date().toISOString(),
    level: level as any,
    subject: 's',
    message: 'm',
    data: undefined,
    source: { function: 'f', file: 'file', process: 'p', runtime: 'browser', serviceName: 'svc' },
    correlation: {}
  })

  it('renders counts and invokes onLevelFilter when a stat is clicked', () => {
    const logs = [make('error'), make('warn'), make('error')]
    const onLevelFilter = vi.fn()

    render(<StatsPanel logs={logs} onLevelFilter={onLevelFilter} currentLevel={'all'} />)

    expect(screen.getByText(/Total:/i)).toBeInTheDocument()
    // target the specific count element to avoid ambiguity with other '3' values
    expect(screen.getByText('3', { selector: '.stats-count' })).toBeInTheDocument()

    const errorButton = screen.getByRole('button', { name: /Error/i })
    fireEvent.click(errorButton)
    expect(onLevelFilter).toHaveBeenCalledWith('error')
  })

  it('toggles collapsed state', () => {
    const logs: LogEntry[] = []
    render(<StatsPanel logs={logs} onLevelFilter={() => {}} currentLevel={'all'} />)

    const toggle = screen.getByTitle(/Collapse stats/i)
    fireEvent.click(toggle)
    // collapse hides the stats grid — ensure the "All" stat button is not visible
    expect(screen.queryByRole('button', { name: /All/i })).not.toBeInTheDocument()
  })
})