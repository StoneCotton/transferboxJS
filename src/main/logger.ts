/**
 * Logger Module
 * Provides application logging with SQLite persistence
 */

import { LogEntry } from '../shared/types'
import { EventEmitter } from 'events'
import { DatabaseManager } from './databaseManager'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Logger Class
 * Handles application logging with database persistence
 */
export class Logger {
  private db: DatabaseManager
  private minLevel: LogLevel = 'info'
  private emitter: EventEmitter = new EventEmitter()

  constructor(dbPath?: string) {
    this.db = new DatabaseManager(dbPath)
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.minLevel
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Check if log level meets minimum
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return
    }

    // Handle circular references in context
    let safeContext = context
    if (context) {
      try {
        // Test if context can be stringified
        JSON.stringify(context)
      } catch (error) {
        // Handle circular references or other JSON errors
        safeContext = { error: 'Context contains circular references or non-serializable data' }
      }
    }

    const entry: Omit<LogEntry, 'timestamp'> = {
      level,
      message,
      context: safeContext
    }

    const timestamp = this.db.addLogEntry(entry)
    // Emit to subscribers (e.g., forward to renderer)
    this.emitter.emit('entry', { timestamp, ...entry })
  }

  /**
   * Get recent log entries
   */
  getRecent(limit: number = 100): LogEntry[] {
    return this.db.getRecentLogs(limit)
  }

  /**
   * Get logs by level
   */
  getByLevel(level: LogLevel): LogEntry[] {
    return this.db.getLogsByLevel(level)
  }

  /**
   * Get logs by date range
   */
  getByDateRange(startTime: number, endTime: number): LogEntry[] {
    return this.db.getLogsByDateRange(startTime, endTime)
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.db.clearLogs()
  }

  /**
   * Delete old logs
   */
  deleteOldLogs(daysToKeep: number): number {
    return this.db.deleteOldLogs(daysToKeep)
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }

  // Convenience methods for common logging scenarios

  /**
   * Log transfer start
   */
  logTransferStart(
    sessionId: string,
    driveId: string,
    sourceRoot: string,
    destinationRoot: string
  ): void {
    this.info('Transfer started', {
      sessionId,
      driveId,
      sourceRoot,
      destinationRoot
    })
  }

  /**
   * Log transfer complete
   */
  logTransferComplete(sessionId: string, fileCount: number, totalBytes: number): void {
    this.info('Transfer completed successfully', {
      sessionId,
      fileCount,
      totalBytes
    })
  }

  /**
   * Log transfer error
   */
  logTransferError(sessionId: string, error: string): void {
    this.error('Transfer error occurred', {
      sessionId,
      error
    })
  }

  /**
   * Log file transfer
   */
  logFileTransfer(sourcePath: string, destPath: string, status: string): void {
    this.info('File transfer', {
      sourcePath,
      destPath,
      status
    })
  }

  /**
   * Log drive detected
   */
  logDriveDetected(device: string, name: string): void {
    this.info('Drive detected', {
      device,
      name
    })
  }

  /**
   * Log drive removed
   */
  logDriveRemoved(device: string): void {
    this.info('Drive removed', {
      device
    })
  }

  /**
   * Log media scan
   */
  logMediaScan(path: string, fileCount: number, totalSize: number): void {
    this.info('Media scan completed', {
      path,
      fileCount,
      totalSize
    })
  }
}

// Global logger instance
let globalLogger: Logger | null = null

/**
 * Get or create global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger()
  }
  return globalLogger
}

/**
 * Close global logger
 */
export function closeLogger(): void {
  if (globalLogger) {
    globalLogger.close()
    globalLogger = null
  }
}

/**
 * Subscribe to log entries from the global logger. Returns an unsubscribe function.
 */
export function onLogEntry(callback: (entry: LogEntry) => void): () => void {
  const logger = getLogger()
  // Access the emitter via a lightweight wrapper using debug level to ensure instance creation
  // We expose subscription through this function to avoid importing EventEmitter elsewhere
  const anyLogger = logger as unknown as { emitter: EventEmitter }
  anyLogger.emitter.on('entry', callback)
  return () => anyLogger.emitter.off('entry', callback)
}
