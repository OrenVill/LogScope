import { describe, it, expect } from 'vitest'
import { createQueryIndex } from '../storage/index'
import type { LogEntry } from '../../types'

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
})