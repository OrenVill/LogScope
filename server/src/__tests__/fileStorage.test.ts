import { describe, it, expect } from 'vitest'
import { createFileStorage } from '../storage/fileStorage'
import os from 'os'
import path from 'path'
import fs from 'fs'

describe('FileStorage', () => {
  it('writes and reads logs and can find by ID', async () => {
    const tmp = path.join(os.tmpdir(), `fs-test-${Date.now()}`)
    await fs.promises.mkdir(tmp, { recursive: true })

    const storage = createFileStorage(tmp)
    await storage.initialize()

    const log = {
      eventId: 'f-1',
      timestamp: new Date().toISOString(),
      level: 'info',
      subject: 'fs-test',
      message: 'hi',
      data: { foo: 'bar' },
      source: { function: 'fn', file: 'f.ts', process: 'p', runtime: 'node', serviceName: 'svc' },
      correlation: {}
    }

    await storage.appendLog(log as any)

    const backend = await storage.readLogs('node')
    expect(backend.length).toBeGreaterThanOrEqual(1)

    const found = await storage.getLogById('f-1')
    expect(found).not.toBeNull()
    expect(found!.eventId).toBe('f-1')
  })
})