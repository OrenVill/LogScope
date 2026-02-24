import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logsApi } from './logsService'

describe('LogsApiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes lightweight=true when calling searchLogs with default', async () => {
    ;(global.fetch as unknown as { mockResolvedValueOnce: (v: unknown) => void; mock?: { calls?: unknown[][] } }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })

    await logsApi.searchLogs({}, undefined)

    expect(global.fetch).toHaveBeenCalled()
    const calledUrl = ((global.fetch as unknown as { mock?: { calls?: unknown[][] } }).mock!.calls![0][0] as string)
    expect(calledUrl).toContain('lightweight=true')
  })

  it('getLogById returns error response when 404', async () => {
    ;(global.fetch as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ success: false, error: 'Not found', errorCode: 'NOT_FOUND' }) })

    const res = await logsApi.getLogById('missing')
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('NOT_FOUND')
  })
})