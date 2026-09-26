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

export function groupConsecutive<T extends GroupableLog>(logs: T[]): LogGroup<T>[] {
  const groups: LogGroup<T>[] = []
  for (const log of logs) {
    const previous = groups[groups.length - 1]
    const same =
      previous &&
      previous.log.level === log.level &&
      previous.log.subject === log.subject &&
      previous.log.message === log.message
    if (previous && same) {
      previous.count += 1
      previous.eventIds.push(log.eventId)
    } else {
      groups.push({ log, count: 1, eventIds: [log.eventId] })
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

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.isContentEditable)
}
