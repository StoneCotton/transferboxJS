/**
 * Database Manager Module
 * Handles SQLite database operations for transfer history and logging
 */

import Database = require('better-sqlite3')
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { TransferSession, FileTransferInfo, LogEntry } from '../shared/types'

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
   */
  createTransferSession(session: Omit<TransferSession, 'id'>): string {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
      session.files.forEach((file) => this.addFileToSession(id, file))
    }

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
      fileSize: file.file_size,
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
   */
  getAllTransferSessions(): TransferSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_sessions ORDER BY start_time DESC
    `)

    const rows = stmt.all() as any[]

    return rows.map((row) => {
      const session = this.getTransferSession(row.id)
      return session!
    })
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
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    const stmt = this.db.prepare(`
      DELETE FROM transfer_sessions WHERE start_time < ?
    `)

    const result = stmt.run(cutoffTime)
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
        checksum, error, start_time, end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      sessionId,
      file.sourcePath,
      file.destinationPath,
      file.fileName,
      file.fileSize,
      file.bytesTransferred,
      file.percentage,
      file.status,
      file.checksum || null,
      file.error || null,
      file.startTime || null,
      file.endTime || null
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
      fileSize: file.file_size,
      bytesTransferred: file.bytes_transferred,
      percentage: file.percentage,
      status: file.status,
      checksum: file.checksum,
      error: file.error,
      startTime: file.start_time,
      endTime: file.end_time
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
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

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
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM transfer_sessions').get() as {
      count: number
    }
    const files = this.db.prepare('SELECT COUNT(*) as count FROM transfer_files').get() as {
      count: number
    }
    const logs = this.db.prepare('SELECT COUNT(*) as count FROM logs').get() as { count: number }

    // Get database file size
    let dbSize = 0
    try {
      const stats = fs.statSync(this.dbPath)
      dbSize = stats.size
    } catch (error) {
      // Ignore error
    }

    return {
      totalSessions: sessions.count,
      totalFiles: files.count,
      totalLogs: logs.count,
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
