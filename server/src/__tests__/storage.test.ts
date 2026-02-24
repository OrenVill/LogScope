import { describe, it, expect } from 'vitest'
import { createQueryIndex } from '../storage/index.js'
import type { LogEntry } from '../types/index.js'

const makeLog = (id: string): LogEntry => ({
  eventId: id,
  timestamp: new Date().toISOString(),
  level: 'info',
  subject: 'test',
  message: 'hello',
  data: { x: 1 },
  source: {
    function: 'fn',
    file: 'f.ts',
    process: 'p',
    runtime: 'node',
    serviceName: 'svc',
  },
  correlation: {},
})

describe('query index lightweight summaries', () => {
  it('returns summaries when lightweight=true and full entries otherwise', async () => {
    const idx = createQueryIndex(100)
    const logs = [makeLog('a'), makeLog('b')]
    await idx.buildIndex(logs)

    const resLight = await idx.query({ limit: 10, offset: 0, lightweight: true })
    expect(resLight.logs.length).toBe(2)
    // summaries should not include source.function property (narrowed type)
    expect((resLight.logs[0] as any).source.function).toBeUndefined()

    const resFull = await idx.query({ limit: 10, offset: 0, lightweight: false })
    expect((resFull.logs[0] as any).source.function).toBe('fn')
  })
})