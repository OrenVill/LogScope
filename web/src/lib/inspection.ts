export interface GroupableLog {
  eventId: string
  level: string
  subject: string
  message: string
}

export interface LogGroup<T extends GroupableLog> {
  log: T
  count: number
  eventIds: string[]
}

function normalizeField(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function logSignature(log: GroupableLog): string {
  return `${normalizeField(log.level)}\0${normalizeField(log.subject)}\0${normalizeField(log.message)}`
}

export function groupConsecutive<T extends GroupableLog>(logs: T[]): LogGroup<T>[] {
  const groups: LogGroup<T>[] = []
  for (const log of logs) {
    const previous = groups[groups.length - 1]
    if (previous && logSignature(previous.log) === logSignature(log)) {
      previous.count += 1
      previous.eventIds.push(log.eventId)
    } else {
      groups.push({ log, count: 1, eventIds: [log.eventId] })
    }
  }
  return groups
}

/** Collapse every copy of a signature in the loaded list. The first row stays put. */
export function groupInView<T extends GroupableLog>(logs: T[]): LogGroup<T>[] {
  const groups: LogGroup<T>[] = []
  const indexBySignature = new Map<string, number>()
  for (const log of logs) {
    const key = logSignature(log)
    const existing = indexBySignature.get(key)
    if (existing === undefined) {
      indexBySignature.set(key, groups.length)
      groups.push({ log, count: 1, eventIds: [log.eventId] })
    } else {
      const group = groups[existing]
      group.count += 1
      group.eventIds.push(log.eventId)
    }
  }
  return groups
}

export function editorLink(file: string | undefined | null): string | null {
  if (!file || !file.trim()) return null
  const trimmed = file.trim()
  const drive = trimmed.match(/^([A-Za-z]):[\\/]/)
  if (drive) {
    const normalized = trimmed.replace(/\\/g, '/')
    return `vscode://file/${normalized}`
  }
  if (trimmed.startsWith('/')) {
    return `vscode://file${trimmed}`
  }
  return null
}

export function acceptLiveLog<T extends { eventId: string }>(
  paused: boolean,
  logs: T[],
  pending: T[],
  incoming: T,
): { logs: T[]; pending: T[] } {
  const logsNext = logs.filter((item) => item.eventId !== incoming.eventId)
  const pendingNext = pending.filter((item) => item.eventId !== incoming.eventId)
  if (paused) {
    return { logs: logsNext, pending: [...pendingNext, incoming] }
  }
  return { logs: [...logsNext, incoming], pending: pendingNext }
}

export function flushPending<T extends { eventId: string }>(logs: T[], pending: T[]): T[] {
  let next = logs
  for (const item of pending) {
    next = [...next.filter((log) => log.eventId !== item.eventId), item]
  }
  return next
}

export function newestWithLevel<T extends { level: string; timestamp: string }>(
  logs: T[],
  level: string,
): T | undefined {
  return logs
    .filter((log) => log.level === level)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
}

export function signatureCounts<T extends GroupableLog>(logs: T[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const log of logs) {
    const key = logSignature(log)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function formatDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '+'
  const abs = Math.abs(ms)
  if (abs < 1000) return `${sign}${Math.round(abs)}ms`
  if (abs < 10_000) return `${sign}${(abs / 1000).toFixed(1)}s`
  if (abs < 60_000) return `${sign}${Math.round(abs / 1000)}s`
  if (abs < 86_400_000) {
    const minutes = Math.floor(abs / 60_000)
    const seconds = Math.round((abs % 60_000) / 1000)
    return seconds ? `${sign}${minutes}m ${seconds}s` : `${sign}${minutes}m`
  }
  return `${sign}${Math.round(abs / 86_400_000)}d`
}

export function slowestStepIndex(timestamps: string[]): number {
  let best = -1
  let max = 0
  for (let index = 1; index < timestamps.length; index += 1) {
    const gap = new Date(timestamps[index]).getTime() - new Date(timestamps[index - 1]).getTime()
    if (gap > max) {
      max = gap
      best = index
    }
  }
  return best
}

export function relativeTime(timestamp: string, now = Date.now()): string {
  const delta = new Date(timestamp).getTime() - now
  const future = delta > 0
  const abs = Math.abs(delta)
  const seconds = Math.round(abs / 1000)
  if (seconds < 5) return future ? 'in a moment' : 'just now'
  const phrase = (amount: number, unit: string) => (future ? `in ${amount}${unit}` : `${amount}${unit} ago`)
  if (seconds < 60) return phrase(seconds, 's')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return phrase(minutes, 'm')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return phrase(hours, 'h')
  return phrase(Math.round(hours / 24), 'd')
}

export function primitiveFields(data: unknown): { key: string; value: string }[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data as Record<string, unknown>)
    .filter(([, value]) => value !== null && ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ key, value: String(value) }))
}

const HTTP_ROUTE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+?)(?:\s+-\s+|\s+)(\d{3})$/i

/** `GET /status 200` from compacted hours, or `GET /status - 200` from raw lines. */
export function parseHttpRoute(value: string | undefined | null): { method: string; path: string; status: number } | null {
  if (!value) return null
  const match = HTTP_ROUTE.exec(value.trim())
  if (!match) return null
  return { method: match[1].toUpperCase(), path: match[2], status: Number(match[3]) }
}

export interface PresentedSource {
  origin: 'live' | 'archive'
  env?: string
  service: string
  pod?: string
  method?: string
  path?: string
  status?: number
}

function locationFromFile(file: string | undefined): { env?: string; service?: string; origin?: 'live' | 'archive' } {
  if (!file) return {}
  const landing = /^landing\/([^/]+)\/([^/]+)/.exec(file)
  if (landing) return { env: landing[1], service: landing[2], origin: 'live' }
  const archive = /^s3:\/\/([^/]+)\/([^/]+)/.exec(file)
  if (archive) return { env: archive[1], service: archive[2], origin: 'archive' }
  return {}
}

/**
 * Bucket rows are stored with function archive and file s3://env/service.
 * Raw lines use `METHOD /path - status` and belong to the open hour.
 */
export function presentedSource(log: {
  subject?: string
  message?: string
  source?: {
    function?: string
    file?: string
    process?: string
    serviceName?: string
    env?: string
    pod?: string
    method?: string
    path?: string
    status?: number
    origin?: 'live' | 'archive'
  }
}): PresentedSource | null {
  const source = log.source
  if (!source) return null
  const located = locationFromFile(source.file)
  const bucketRow = Boolean(
    source.origin ||
    source.function === 'archive' ||
    source.function === 'landing' ||
    located.origin ||
    source.method ||
    source.path
  )
  if (!bucketRow) return null

  const fromMessage = parseHttpRoute(log.message)
  const fromSubject = parseHttpRoute(log.subject)
  const route = fromMessage ?? fromSubject
  const dashed = [log.message, log.subject].some((value) => Boolean(value && /\s-\s+\d{3}$/.test(value.trim())))
  const pod = source.pod || (source.process && source.process !== 'unknown' ? source.process : undefined)
  const origin =
    source.origin ??
    (dashed || source.function === 'landing' || located.origin === 'live' ? 'live' : 'archive')

  return {
    origin,
    env: source.env ?? located.env,
    service: source.serviceName || located.service || '',
    ...(pod ? { pod } : {}),
    method: source.method ?? route?.method,
    path: source.path ?? route?.path,
    status: source.status ?? route?.status,
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.isContentEditable)
}
