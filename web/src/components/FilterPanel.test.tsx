import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPanel } from './FilterPanel'

describe('FilterPanel', () => {
  it('calls onSearch with filled filters on submit', () => {
    const onSearch = vi.fn()
    render(<FilterPanel onSearch={onSearch} isRealTime={false} />)

    fireEvent.change(screen.getByPlaceholderText(/e.g., auth, database/i), { target: { value: 'auth' } })
    fireEvent.change(screen.getByPlaceholderText(/Search in content/i), { target: { value: 'error' } })
    fireEvent.change(screen.getByLabelText(/Log Level/i), { target: { value: 'error' } })

    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalled()
    const calledWith = onSearch.mock.calls[0][0]
    expect(calledWith.subject).toBe('auth')
    expect(calledWith.text).toBe('error')
    expect(calledWith.level).toBe('error')
  })

  it('clear button resets filters and calls onSearch with empty object', () => {
    const onSearch = vi.fn()
    render(<FilterPanel onSearch={onSearch} isRealTime={false} />)

    fireEvent.change(screen.getByPlaceholderText(/e.g., auth, database/i), { target: { value: 'db' } })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(onSearch).toHaveBeenCalledWith({})
    expect((screen.getByPlaceholderText(/e.g., auth, database/i) as HTMLInputElement).value).toBe('')
  })

  it('auto-apply triggers onSearch after debounce when enabled', async () => {
    const onSearch = vi.fn()
    vi.useFakeTimers()
    render(<FilterPanel onSearch={onSearch} isRealTime={false} />)

    fireEvent.change(screen.getByPlaceholderText(/e.g., auth, database/i), { target: { value: 'auth' } })

    // not called immediately
    expect(onSearch).not.toHaveBeenCalled()

    // advance past debounce
    vi.advanceTimersByTime(500)

    expect(onSearch).toHaveBeenCalled()

    vi.useRealTimers()
  })
})