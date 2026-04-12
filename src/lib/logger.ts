type Level = 'info' | 'warn' | 'error'

function log(level: Level, route: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    route,
    message,
    ...(data ? { data } : {}),
  }
  if (level === 'error') console.error(JSON.stringify(entry))
  else if (level === 'warn') console.warn(JSON.stringify(entry))
  else console.log(JSON.stringify(entry))
}

export function parseError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack?.split('\n').slice(0, 5).join(' | ') }
  }
  return { message: String(err) }
}

export const logger = {
  info: (route: string, message: string, data?: Record<string, unknown>) =>
    log('info', route, message, data),
  warn: (route: string, message: string, data?: Record<string, unknown>) =>
    log('warn', route, message, data),
  error: (route: string, message: string, err?: unknown, data?: Record<string, unknown>) =>
    log('error', route, message, {
      ...(err ? parseError(err) : {}),
      ...data,
    }),
}
