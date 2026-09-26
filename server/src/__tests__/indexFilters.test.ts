import { describe, it, expect } from 'vitest'
import { createQueryIndex } from '../storage/index.js'
import type { LogEntry } from '../types/index.js'

const make = (id: string, level = 'info', subject = 's', message = 'm', ts = new Date().toISOString()): LogEntry => ({
  eventId: id,
  timestamp: ts,
  level: level as any,
  subject,
  message,
  data: undefined,
  source: { function: 'f', file: 'f.ts', process: 'p', runtime: 'node', serviceName: 'svc' },
  correlation: { requestId: id.startsWith('r') ? 'req-1' : undefined }
})

describe('QueryIndex filters', () => {
  it('filters by time range, subject, text, requestId, and pagination', async () => {
    const idx = createQueryIndex(100)
    const t1 = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    const t2 = new Date().toISOString()

    const logs = [
      make('a', 'info', 'auth', 'user login', t1),
      make('r1', 'error', 'db', 'db error', t2),
      make('b', 'warn', 'auth', 'slow response', t2),
    ]

    await idx.buildIndex(logs)

    const timeRes = await idx.query({ timeFrom: t2, limit: 10 })
    expect(timeRes.logs.length).toBeGreaterThanOrEqual(2)

    const subj = await idx.query({ subject: 'auth', limit: 10 })
    expect(subj.logs.every(l => l.subject.includes('auth'))).toBe(true)

    const text = await idx.query({ text: 'db error', limit: 10 })
    expect(text.logs.length).toBe(1)

    const req = await idx.query({ requestId: 'req-1', limit: 10 })
    expect(req.logs.length).toBe(1)

    const pag = await idx.query({ offset: 1, limit: 1 })
    expect(pag.logs.length).toBe(1)
  })

  it('matches correlation user ids in text search and returns surrounding logs', async () => {
    const idx = createQueryIndex(100)
    const logs = [
      make('early', 'info', 'a', 'one', '2026-01-01T00:00:00Z'),
      make('mid', 'warn', 'b', 'two', '2026-01-01T00:00:02Z'),
      make('late', 'error', 'c', 'three', '2026-01-01T00:00:09Z'),
    ]
    logs[1].correlation = { userId: 'ada' }
    await idx.buildIndex(logs)

    const byUser = await idx.query({ text: 'ada', limit: 10 })
    expect(byUser.logs.map((log) => log.eventId)).toEqual(['mid'])

    const around = idx.around('late', 1)
    expect(around?.focusIndex).toBe(1)
    expect(around?.logs.map((log) => log.eventId)).toEqual(['mid', 'late'])
  })

  it('filters by HTTP path and status', async () => {
    const idx = createQueryIndex(100)
    const status = make('status', 'info', 'GET /api/auth/status 200', 'ok')
    status.source = { ...status.source, path: '/api/auth/status', status: 200, method: 'GET' }
    const failed = make('failed', 'error', 'POST /api/chat-stream 500', 'boom')
    failed.source = { ...failed.source, path: '/api/chat-stream', status: 500, method: 'POST' }
    await idx.buildIndex([status, failed])

    const byPath = await idx.query({ path: '/status', limit: 10 })
    expect(byPath.logs.map((log) => log.eventId)).toEqual(['status'])

    const byStatus = await idx.query({ status: '500', limit: 10 })
    expect(byStatus.logs.map((log) => log.eventId)).toEqual(['failed'])
  })
})