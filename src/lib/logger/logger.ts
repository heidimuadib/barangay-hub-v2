/*
 * This module is the single permitted writer to stdout (Phase 6 §17.6).
 * The `no-console` exemption is granted by path in eslint.config.mjs rather than
 * by an inline directive, so it cannot be copied into another file by accident.
 */
import { getRequestContext } from './correlation'
import { redact } from './redact'

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export type LogFields = Record<string, unknown>

export interface Logger {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  /** Returns a logger with permanently bound fields (e.g. a job name). */
  child(bindings: LogFields): Logger
}

/**
 * Resolved without importing env.server, so the logger is usable from the Edge
 * middleware and from scripts where the full server schema is not loaded.
 */
function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL
  return (LOG_LEVELS as readonly string[]).includes(raw ?? '') ? (raw as LogLevel) : 'info'
}

function write(level: LogLevel, message: string, fields: LogFields, bindings: LogFields): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[configuredLevel()]) return

  const context = getRequestContext()
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: context?.correlationId,
    route: context?.route,
    actorId: context?.actorId,
    tenantCode: context?.tenantCode,
    ...(redact({ ...bindings, ...fields }) as LogFields),
  }

  const line = JSON.stringify(record)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function build(bindings: LogFields): Logger {
  return {
    debug: (message, fields = {}) => write('debug', message, fields, bindings),
    info: (message, fields = {}) => write('info', message, fields, bindings),
    warn: (message, fields = {}) => write('warn', message, fields, bindings),
    error: (message, fields = {}) => write('error', message, fields, bindings),
    child: (extra) => build({ ...bindings, ...extra }),
  }
}

export const logger: Logger = build({})
