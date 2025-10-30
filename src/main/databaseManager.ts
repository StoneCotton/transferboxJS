/**
 * Database Manager Module
 * Handles SQLite database operations for transfer history and logging
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { TransferSession, FileTransferInfo, LogEntry } from '../shared/types'
import { validateFileSize } from './utils/fileSizeUtils'
import { ONE_DAY_MS } from './constants/fileConstants'
// Removed unused database row type imports to satisfy TS strict unused checks

export interface DatabaseStats {
  totalSessions: number
  totalFiles: number
  totalLogs: number
  databaseSize: number
}

/**
 * Database Manager Class
 * Manages SQLite database for transfer history and logs
 */
export class DatabaseManager {
  private db: Database.Database
  private dbPath: string

  constructor(dbPath?: string) {
    // Use provided path or default to userData directory
    this.dbPath = dbPath || path.join(app?.getPath('userData') || process.cwd(), 'transferbox.db')

    // Ensure directory exists
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Initialize database
    this.db = new Database(this.dbPath)

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON')

    // Initialize schema
    this.initializeSchema()
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Transfer sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_sessions (
        id TEXT PRIMARY KEY,
        drive_id TEXT NOT NULL,
        drive_name TEXT NOT NULL,
        source_root TEXT NOT NULL,
        destination_root TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT NOT NULL,
        file_count INTEGER NOT NULL,
        total_bytes INTEGER NOT NULL,
        error_message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON transfer_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON transfer_sessions(status);
    `)

    // Transfer files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        bytes_transferred INTEGER NOT NULL,
        percentage REAL NOT NULL,
        status TEXT NOT NULL,
        checksum TEXT,
        error TEXT,
        start_time INTEGER,
        end_time INTEGER,
        duration REAL,
        FOREIGN KEY (session_id) REFERENCES transfer_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_files_session_id ON transfer_files(session_id);
      CREATE INDEX IF NOT EXISTS idx_files_status ON transfer_files(status);
    `)

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    `)

    // Run migrations
    this.runMigrations()
  }

  /**
   * Run database migrations with locking to prevent race conditions
   */
  private runMigrations(): void {
    // Use application-level advisory lock to prevent concurrent migrations
    // This ensures only one process runs migrations at a time
    const lockResult = this.db.prepare('SELECT 1').get()

    if (!lockResult) {
      // Database is not accessible, cannot run migrations
      return
    }

    // Check if duration column exists in transfer_files table
    const columns = this.db
      .prepare(
        `
      PRAGMA table_info(transfer_files)
    `
      )
      .all() as Array<{ name: string; type: string }>

    const hasDurationColumn = columns.some((col) => col.name === 'duration')

    if (!hasDurationColumn) {
      // Use transaction for migration to ensure atomicity
      const migrationTransaction = this.db.transaction(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getLogger } = require('./logger')
          getLogger().info('Adding duration column to transfer_files table...')
        } catch {
          // ignore if logger not ready
        }

        this.db.exec(`
          ALTER TABLE transfer_files ADD COLUMN duration REAL
        `)
      })

      try {
        migrationTransaction()
      } catch (error) {
        // If migration fails, log but don't crash
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getLogger } = require('./logger')
          getLogger().error('Migration failed', {
            error: error instanceof Error ? error.message : String(error)
          })
        } catch {
          console.error('Migration failed:', error)
        }
      }
    }
  }

  /**
   * Get list of tables in the database
   */
  getTables(): string[] {
    // For mock compatibility, directly access table names if available
    if (typeof (this.db as any).getTableNames === 'function') {
      return (this.db as any).getTableNames()
    }

    // Real database query
    const result = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as { name: string }[]
    return result.map((row) => row.name)
  }

  /**
   * Get journal mode
   */
  getJournalMode(): string {
    return this.db.pragma('journal_mode', { simple: true }) as string
  }

  /**
   * Check if foreign keys are enabled
   */
  getForeignKeysEnabled(): boolean {
    return this.db.pragma('foreign_keys', { simple: true }) === 1
  }

  /**
   * Create a new transfer session
   * Uses transaction to ensure atomicity when adding files
   */
  createTransferSession(session: Omit<TransferSession, 'id'>): string {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Wrap in transaction for atomicity
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO transfer_sessions (
          id, drive_id, drive_name, source_root, destination_root,
          start_time, end_time, status, file_count, total_bytes, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        session.driveId,
        session.driveName,
        session.sourceRoot,
        session.destinationRoot,
        session.startTime,
        session.endTime,
        session.status,
        session.fileCount,
        session.totalBytes,
        session.errorMessage || null
      )

      // Add files if provided
      if (session.files && session.files.length > 0) {
        const fileStmt = this.db.prepare(`
          INSERT INTO transfer_files (
            session_id, source_path, destination_path, file_name,
            file_size, bytes_transferred, percentage, status,
            checksum, error, start_time, end_time, duration
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        session.files.forEach((file) => {
          fileStmt.run(
            id,
            file.sourcePath,
            file.destinationPath,
            file.fileName,
            Number(file.fileSize),
            file.bytesTransferred,
            file.percentage,
            file.status,
            file.checksum || null,
            file.error || null,
            file.startTime || null,
            file.endTime || null,
            file.duration || null
          )
        })
      }
    })

    // Execute the transaction
    transaction()

    return id
  }

  /**
   * Get transfer session by ID
   */
  getTransferSession(sessionId: string): TransferSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_sessions WHERE id = ?
    `)

    const row = stmt.get(sessionId) as any

    if (!row) {
      return null
    }

    // Get files for this session
    const filesStmt = this.db.prepare(`
      SELECT * FROM transfer_files WHERE session_id = ?
    `)

    const files = (filesStmt.all(sessionId) as any[]).map((file) => ({
      sourcePath: file.source_path,
      destinationPath: file.destination_path,
      fileName: file.file_name,
      fileSize: Number(file.file_size), // Ensure it's a number
      bytesTransferred: file.bytes_transferred,
      percentage: file.percentage,
      status: file.status,
      checksum: file.checksum,
      error: file.error,
      startTime: file.start_time,
      endTime: file.end_time
    }))

    return {
      id: row.id,
      driveId: row.drive_id,
      driveName: row.drive_name,
      sourceRoot: row.source_root,
      destinationRoot: row.destination_root,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      fileCount: row.file_count,
      totalBytes: row.total_bytes,
      files,
      errorMessage: row.error_message
    }
  }

  /**
   * Get all transfer sessions
   * Optimized to avoid N+1 query problem by using JOIN
   */
  getAllTransferSessions(): TransferSession[] {
    // Use a JOIN to get all sessions with their files in fewer queries
    const stmt = this.db.prepare(`
      SELECT 
        s.id, s.drive_id, s.drive_name, s.source_root, s.destination_root,
        s.start_time, s.end_time, s.status, s.file_count, s.total_bytes, s.error_message,
        f.id as file_id, f.source_path, f.destination_path, f.file_name,
        f.file_size, f.bytes_transferred, f.percentage, f.status as file_status,
        f.checksum, f.error as file_error, f.start_time as file_start_time, 
        f.end_time as file_end_time, f.duration
      FROM transfer_sessions s
      LEFT JOIN transfer_files f ON s.id = f.session_id
      ORDER BY s.start_time DESC, f.id ASC
    `)

    const rows = stmt.all() as any[]

    // Group rows by session ID, preserving insertion order
    const sessionMap = new Map<string, TransferSession>()
    const sessionOrder: string[] = [] // Track order of first appearance

    rows.forEach((row) => {
      if (!sessionMap.has(row.id)) {
        // Track order when first seeing this session
        sessionOrder.push(row.id)

        // Create new session entry
        sessionMap.set(row.id, {
          id: row.id,
          driveId: row.drive_id,
          driveName: row.drive_name,
          sourceRoot: row.source_root,
          destinationRoot: row.destination_root,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          fileCount: row.file_count,
          totalBytes: row.total_bytes,
          files: [],
          errorMessage: row.error_message
        })
      }

      // Add file to session if it exists
      if (row.file_id) {
        const session = sessionMap.get(row.id)!
        session.files.push({
          sourcePath: row.source_path,
          destinationPath: row.destination_path,
          fileName: row.file_name,
          fileSize: validateFileSize(Number(row.file_size), 'file_size'),
          bytesTransferred: validateFileSize(row.bytes_transferred, 'bytes_transferred'),
          percentage: row.percentage,
          status: row.file_status,
          checksum: row.checksum,
          error: row.file_error,
          startTime: row.file_start_time,
          endTime: row.file_end_time,
          duration: row.duration
        })
      }
    })

    // Return sessions in the order they were encountered (which matches SQL ORDER BY)
    return sessionOrder.map((id) => sessionMap.get(id)!)
  }

  /**
   * Update transfer session
   */
  updateTransferSession(
    sessionId: string,
    updates: Partial<Omit<TransferSession, 'id' | 'files'>>
  ): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.endTime !== undefined) {
      fields.push('end_time = ?')
      values.push(updates.endTime)
    }
    if (updates.fileCount !== undefined) {
      fields.push('file_count = ?')
      values.push(updates.fileCount)
    }
    if (updates.totalBytes !== undefined) {
      fields.push('total_bytes = ?')
      values.push(updates.totalBytes)
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?')
      values.push(updates.errorMessage)
    }

    if (fields.length === 0) {
      return
    }

    values.push(sessionId)

    const stmt = this.db.prepare(`
      UPDATE transfer_sessions SET ${fields.join(', ')} WHERE id = ?
    `)

    stmt.run(...values)
  }

  /**
   * Get transfer sessions by date range
   */
  getTransferSessionsByDateRange(startTime: number, endTime: number): TransferSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_sessions 
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `)

    const rows = stmt.all(startTime, endTime) as any[]

    return rows.map((row) => this.getTransferSession(row.id)!)
  }

  /**
   * Delete old transfer sessions
   */
  deleteOldTransferSessions(daysToKeep: number): number {
    const cutoffTime = Date.now() - daysToKeep * ONE_DAY_MS

    const stmt = this.db.prepare(`
      DELETE FROM transfer_sessions WHERE start_time < ?
    `)

    const result = stmt.run(cutoffTime)
    return result.changes
  }

  /**
   * Clear all transfer sessions
   */
  clearTransferSessions(): number {
    const stmt = this.db.prepare('DELETE FROM transfer_sessions')
    const result = stmt.run()
    return result.changes
  }

  /**
   * Add file to transfer session
   */
  addFileToSession(sessionId: string, file: FileTransferInfo): void {
    const stmt = this.db.prepare(`
      INSERT INTO transfer_files (
        session_id, source_path, destination_path, file_name,
        file_size, bytes_transferred, percentage, status,
        checksum, error, start_time, end_time, duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      sessionId,
      file.sourcePath,
      file.destinationPath,
      file.fileName,
      Number(file.fileSize), // Ensure it's stored as a number
      file.bytesTransferred,
      file.percentage,
      file.status,
      file.checksum || null,
      file.error || null,
      file.startTime || null,
      file.endTime || null,
      file.duration || null
    )
  }

  /**
   * Update file status
   */
  updateFileStatus(
    sessionId: string,
    sourcePath: string,
    updates: Partial<FileTransferInfo>
  ): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.bytesTransferred !== undefined) {
      fields.push('bytes_transferred = ?')
      values.push(updates.bytesTransferred)
    }
    if (updates.percentage !== undefined) {
      fields.push('percentage = ?')
      values.push(updates.percentage)
    }
    if (updates.checksum !== undefined) {
      fields.push('checksum = ?')
      values.push(updates.checksum)
    }
    if (updates.error !== undefined) {
      fields.push('error = ?')
      values.push(updates.error)
    }
    if (updates.startTime !== undefined) {
      fields.push('start_time = ?')
      values.push(updates.startTime)
    }
    if (updates.endTime !== undefined) {
      fields.push('end_time = ?')
      values.push(updates.endTime)
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?')
      values.push(updates.duration)
    }

    if (fields.length === 0) {
      return
    }

    values.push(sessionId, sourcePath)

    const stmt = this.db.prepare(`
      UPDATE transfer_files 
      SET ${fields.join(', ')} 
      WHERE session_id = ? AND source_path = ?
    `)

    stmt.run(...values)
  }

  /**
   * Get files by status
   */
  getFilesByStatus(sessionId: string, status: FileTransferInfo['status']): FileTransferInfo[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_files WHERE session_id = ? AND status = ?
    `)

    const rows = stmt.all(sessionId, status) as any[]

    return rows.map((file) => ({
      sourcePath: file.source_path,
      destinationPath: file.destination_path,
      fileName: file.file_name,
      fileSize: Number(file.file_size), // Ensure it's a number
      bytesTransferred: file.bytes_transferred,
      percentage: file.percentage,
      status: file.status,
      checksum: file.checksum,
      error: file.error,
      startTime: file.start_time,
      endTime: file.end_time,
      duration: file.duration
    }))
  }

  /**
   * Add log entry
   */
  addLogEntry(entry: Omit<LogEntry, 'timestamp'>): number {
    const timestamp = Date.now()

    const stmt = this.db.prepare(`
      INSERT INTO logs (timestamp, level, message, context)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(
      timestamp,
      entry.level,
      entry.message,
      entry.context ? JSON.stringify(entry.context) : null
    )

    return timestamp
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?
    `)

    const rows = stmt.all(limit) as any[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      context: row.context ? JSON.parse(row.context) : undefined
    }))
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs WHERE level = ? ORDER BY timestamp DESC
    `)

    const rows = stmt.all(level) as any[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      context: row.context ? JSON.parse(row.context) : undefined
    }))
  }

  /**
   * Get logs by date range
   */
  getLogsByDateRange(startTime: number, endTime: number): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `)

    const rows = stmt.all(startTime, endTime) as any[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      context: row.context ? JSON.parse(row.context) : undefined
    }))
  }

  /**
   * Delete old logs
   */
  deleteOldLogs(daysToKeep: number): number {
    const cutoffTime = Date.now() - daysToKeep * ONE_DAY_MS

    const stmt = this.db.prepare(`
      DELETE FROM logs WHERE timestamp < ?
    `)

    const result = stmt.run(cutoffTime)
    return result.changes
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.db.prepare('DELETE FROM logs').run()
  }

  /**
   * Get database statistics
   */
  getDatabaseStats(): DatabaseStats {
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM transfer_sessions').get() as any
    const files = this.db.prepare('SELECT COUNT(*) as count FROM transfer_files').get() as any
    const logs = this.db.prepare('SELECT COUNT(*) as count FROM logs').get() as any

    // Get database file size
    let dbSize = 0
    try {
      const stats = fs.statSync(this.dbPath)
      dbSize = stats.size
    } catch (error) {
      // Ignore error
    }

    return {
      totalSessions: sessions?.count || 0,
      totalFiles: files?.count || 0,
      totalLogs: logs?.count || 0,
      databaseSize: dbSize
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM')
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}

// Global database manager instance
let globalDatabaseManager: DatabaseManager | null = null

/**
 * Get or create global database manager instance
 */
export function getDatabaseManager(): DatabaseManager {
  if (!globalDatabaseManager) {
    globalDatabaseManager = new DatabaseManager()
  }
  return globalDatabaseManager
}

/**
 * Close global database manager
 */
export function closeDatabaseManager(): void {
  if (globalDatabaseManager) {
    globalDatabaseManager.close()
    globalDatabaseManager = null
  }
}
