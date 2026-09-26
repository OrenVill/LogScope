import { describe, expect, it } from 'vitest'
import {
  acceptLiveLog,
  editorLink,
  flushPending,
  groupConsecutive,
  isTypingTarget,
  newestWithLevel,
} from './inspection'

describe('groupConsecutive', () => {
  it('collapses adjacent logs that share level, subject, and message', () => {
    const logs = [
      { eventId: 'a', level: 'info', subject: 'auth', message: 'ok' },
      { eventId: 'b', level: 'info', subject: 'auth', message: 'ok' },
      { eventId: 'c', level: 'error', subject: 'auth', message: 'ok' },
      { eventId: 'd', level: 'info', subject: 'auth', message: 'ok' },
    ]

    const groups = groupConsecutive(logs)

    expect(groups).toHaveLength(3)
    expect(groups[0]).toMatchObject({ count: 2, eventIds: ['a', 'b'] })
    expect(groups[0].log.eventId).toBe('a')
    expect(groups[1].count).toBe(1)
    expect(groups[2].log.eventId).toBe('d')
  })
})

describe('editorLink', () => {
  it('builds a vscode url for absolute paths', () => {
    expect(editorLink('/workspace/web/src/App.tsx')).toBe('vscode://file/workspace/web/src/App.tsx')
    expect(editorLink('C:\\repo\\web\\src\\App.tsx')).toBe('vscode://file/C:/repo/web/src/App.tsx')
  })

  it('leaves relative paths without a link', () => {
    expect(editorLink('src/App.tsx')).toBeNull()
    expect(editorLink('')).toBeNull()
  })
})

describe('live tail buffer', () => {
  const incoming = { eventId: 'n', message: 'new' }

  it('appends while the tail is following', () => {
    const result = acceptLiveLog(false, [{ eventId: 'a', message: 'old' }], [], incoming)
    expect(result.logs.map((log) => log.eventId)).toEqual(['a', 'n'])
    expect(result.pending).toEqual([])
  })

  it('holds new events while paused and replaces an older copy', () => {
    const result = acceptLiveLog(
      true,
      [{ eventId: 'n', message: 'old' }],
      [{ eventId: 'p', message: 'held' }],
      incoming,
    )
    expect(result.logs).toEqual([])
    expect(result.pending.map((log) => log.message)).toEqual(['held', 'new'])
  })

  it('flushes held events onto the visible list', () => {
    const flushed = flushPending(
      [{ eventId: 'a', message: 'old' }],
      [{ eventId: 'a', message: 'fresh' }, { eventId: 'b', message: 'new' }],
    )
    expect(flushed.map((log) => log.message)).toEqual(['fresh', 'new'])
  })
})

describe('newestWithLevel', () => {
  it('returns the latest log of a level', () => {
    const latest = newestWithLevel(
      [
        { eventId: 'old', level: 'critical', timestamp: '2026-01-01T00:00:00Z' },
        { eventId: 'new', level: 'critical', timestamp: '2026-01-02T00:00:00Z' },
        { eventId: 'info', level: 'info', timestamp: '2026-01-03T00:00:00Z' },
      ],
      'critical',
    )
    expect(latest?.eventId).toBe('new')
  })
})

describe('isTypingTarget', () => {
  it('detects form fields', () => {
    const input = document.createElement('input')
    const div = document.createElement('div')
    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(div)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
