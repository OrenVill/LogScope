import express from 'express'
import request from 'supertest'
import { validateLogEntry, validateSearchParams } from '../api/middleware/validation'
import { describe, it, expect } from 'vitest'

describe('validation middleware', () => {
  it('validateLogEntry rejects missing timestamp', async () => {
    const app = express()
    app.use(express.json())
    app.post('/collect', validateLogEntry, (req, res) => res.json({ ok: true }))

    const res = await request(app).post('/collect').send({ level: 'info', subject: 's', message: 'm', source: { runtime: 'node' } })
    expect(res.status).toBe(400)
    expect(res.body.errorCode).toBe('INVALID_TIMESTAMP')
  })

  it('validateLogEntry rejects invalid runtime', async () => {
    const app = express()
    app.use(express.json())
    app.post('/collect', validateLogEntry, (req, res) => res.json({ ok: true }))

    const payload = { timestamp: new Date().toISOString(), level: 'info', subject: 's', message: 'm', source: { runtime: 'invalid' } }
    const res = await request(app).post('/collect').send(payload)
    expect(res.status).toBe(400)
    expect(res.body.errorCode).toBe('INVALID_RUNTIME')
  })

  it('validateSearchParams rejects bad timeFrom and invalid limit/offset', async () => {
    const app = express()
    app.get('/search', validateSearchParams, (req, res) => res.json({ ok: true }))

    const badTime = await request(app).get('/search?timeFrom=not-a-date')
    expect(badTime.status).toBe(400)
    expect(badTime.body.errorCode).toBe('INVALID_TIME_RANGE')

    const badLimit = await request(app).get('/search?limit=0')
    expect(badLimit.status).toBe(400)
    expect(badLimit.body.errorCode).toBe('INVALID_LIMIT')

    const badOffset = await request(app).get('/search?offset=-1')
    expect(badOffset.status).toBe(400)
    expect(badOffset.body.errorCode).toBe('INVALID_OFFSET')
  })
})