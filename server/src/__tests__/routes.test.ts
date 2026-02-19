import express from 'express'
import request from 'supertest'
import { createFileStorage } from '../storage/fileStorage.js'
import { createQueryIndex } from '../storage/index.js'
import { createLogsRouter } from '../api/routes/logsRouter.js'
import { describe, it, expect, beforeEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmpDir = path.join(os.tmpdir(), `logscope-test-${Date.now()}`)

beforeEach(async () => {
  await fs.promises.mkdir(tmpDir, { recursive: true })
})

describe('logsRouter (integration)', () => {
  it('search returns summaries by default and full entry by id', async () => {
    const storage = createFileStorage(tmpDir)
    await storage.initialize()

    const queryIndex = createQueryIndex(100)

    // create a log and persist
    const log = {
      eventId: 't-1',
      timestamp: new Date().toISOString(),
      level: 'error',
      subject: 'it-test',
      message: 'boom',
      data: { a: 1 },
      source: { function: 'fn', file: 'f.ts', process: 'p', runtime: 'node', serviceName: 'svc' },
      correlation: {},
    }

    await storage.appendLog(log as any)
    await queryIndex.buildIndex([log as any])

    const app = express()
    app.use(express.json())
    app.use('/api/logs', createLogsRouter(storage, queryIndex))

    // search (should return summary)
    const res = await request(app).get('/api/logs/search?limit=10')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data[0].eventId).toBe('t-1')
    // summary should not include source.function
    expect((res.body.data[0].source as any).function).toBeUndefined()

    // fetch by id (full entry)
    const single = await request(app).get('/api/logs/t-1')
    expect(single.status).toBe(200)
    expect(single.body.success).toBe(true)
    expect(single.body.data.source.function).toBe('fn')
  })
})