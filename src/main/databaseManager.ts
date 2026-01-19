/**
 * Database Manager Module
 * Handles SQLite database operations for transfer history and logging
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import {
  TransferSession,
  FileTransferInfo,
  LogEntry,
  BenchmarkResult,
  BenchmarkHistoryEntry,
  SpeedSample,
  BenchmarkRunRow,
  BenchmarkSampleRow,
  BENCHMARK_DEFAULT_RETENTION
} from '../shared/types'
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
 * Database row types for type-safe queries
 */
interface SessionRow {
  id: string
  drive_id: string
  drive_name: string
  source_root: string
  destination_root: string
  start_time: number
  end_time: number | null
  status: string
  file_count: number
  total_bytes: number
  error_message: string | null
}

interface FileRow {
  id: number
  session_id: string
  source_path: string
  destination_path: string
  file_name: string
  file_size: number | string
  bytes_transferred: number
  percentage: number
  status: string
  checksum: string | null
  error: string | null
  start_time: number | null
  end_time: number | null
  duration: number | null
}

interface LogRow {
  timestamp: number
  level: string
  message: string
  context: string | null
}

interface CountRow {
  count: number
}

interface JoinedSessionFileRow extends SessionRow {
  file_id: number | null
  // Note: source_path from SessionRow is overridden here for the joined file
  source_path: string | null
  destination_path: string | null
  file_name: string | null
  file_size: number | string | null
  bytes_transferred: number | null
  percentage: number | null
  file_status: string | null
  checksum: string | null
  file_error: string | null
  file_start_time: number | null
  file_end_time: number | null
  duration: number | null
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

    // Set busy timeout to handle lock contention (5 seconds)
    this.db.pragma('busy_timeout = 5000')

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

    // Benchmark runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS benchmark_runs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        app_version TEXT NOT NULL,
        source_drive_name TEXT NOT NULL,
        source_drive_type TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        destination_drive_type TEXT NOT NULL,
        total_bytes INTEGER NOT NULL,
        total_files INTEGER NOT NULL,
        total_duration_ms INTEGER NOT NULL,
        avg_speed_mbps REAL NOT NULL,
        peak_speed_mbps REAL NOT NULL,
        read_speed_mbps REAL NOT NULL,
        write_speed_mbps REAL NOT NULL,
        checksum_speed_mbps REAL NOT NULL,
        os TEXT NOT NULL,
        platform TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_runs_timestamp ON benchmark_runs(timestamp);
    `)

    // Benchmark samples table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS benchmark_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        speed_mbps REAL NOT NULL,
        phase TEXT NOT NULL,
        current_file TEXT,
        FOREIGN KEY (run_id) REFERENCES benchmark_runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_benchmark_samples_run_id ON benchmark_samples(run_id);
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
    const dbWithMock = this.db as Database.Database & { getTableNames?: () => string[] }
    if (typeof dbWithMock.getTableNames === 'function') {
      return dbWithMock.getTableNames()
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
   * Uses IMMEDIATE transaction to acquire write lock and prevent concurrent write conflicts
   */
  createTransferSession(session: Omit<TransferSession, 'id'>): string {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Use manual IMMEDIATE transaction for explicit write locking
    // WAL mode + IMMEDIATE transactions + busy_timeout ensures safe concurrent access
    this.db.exec('BEGIN IMMEDIATE')

    try {
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

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
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

    const row = stmt.get(sessionId) as SessionRow | undefined

    if (!row) {
      return null
    }

    // Get files for this session
    const filesStmt = this.db.prepare(`
      SELECT * FROM transfer_files WHERE session_id = ?
    `)

    const files = (filesStmt.all(sessionId) as FileRow[]).map((file) => ({
      sourcePath: file.source_path,
      destinationPath: file.destination_path,
      fileName: file.file_name,
      fileSize: Number(file.file_size), // Ensure it's a number
      bytesTransferred: file.bytes_transferred,
      percentage: file.percentage,
      status: file.status as FileTransferInfo['status'],
      checksum: file.checksum ?? undefined,
      error: file.error ?? undefined,
      startTime: file.start_time ?? undefined,
      endTime: file.end_time ?? undefined
    }))

    return {
      id: row.id,
      driveId: row.drive_id,
      driveName: row.drive_name,
      sourceRoot: row.source_root,
      destinationRoot: row.destination_root,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as TransferSession['status'],
      fileCount: row.file_count,
      totalBytes: row.total_bytes,
      files,
      errorMessage: row.error_message ?? undefined
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

    const rows = stmt.all() as JoinedSessionFileRow[]

    // Group rows by session ID, preserving insertion order
    const sessionMap = new Map<string, TransferSession>()
    const sessionOrder: string[] = [] // Track order of first appearance

    rows.forEach((row: JoinedSessionFileRow) => {
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
          status: row.status as TransferSession['status'],
          fileCount: row.file_count,
          totalBytes: row.total_bytes,
          files: [],
          errorMessage: row.error_message ?? undefined
        })
      }

      // Add file to session if it exists
      if (row.file_id) {
        const session = sessionMap.get(row.id)!
        session.files.push({
          sourcePath: row.source_path!,
          destinationPath: row.destination_path!,
          fileName: row.file_name!,
          fileSize: validateFileSize(Number(row.file_size), 'file_size'),
          bytesTransferred: validateFileSize(row.bytes_transferred ?? 0, 'bytes_transferred'),
          percentage: row.percentage ?? 0,
          status: row.file_status as FileTransferInfo['status'],
          checksum: row.checksum ?? undefined,
          error: row.file_error ?? undefined,
          startTime: row.file_start_time ?? undefined,
          endTime: row.file_end_time ?? undefined,
          duration: row.duration ?? undefined
        })
      }
    })

    // Return sessions in the order they were encountered (which matches SQL ORDER BY)
    return sessionOrder.map((id) => sessionMap.get(id)!)
  }

  /**
   * Update transfer session
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  updateTransferSession(
    sessionId: string,
    updates: Partial<Omit<TransferSession, 'id' | 'files'>>
  ): void {
    const fields: string[] = []
    const values: (string | number | null)[] = []

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

    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const stmt = this.db.prepare(`
          UPDATE transfer_sessions SET ${fields.join(', ')} WHERE id = ?
        `)

      stmt.run(...values)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
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

    const rows = stmt.all(startTime, endTime) as SessionRow[]

    return rows.map((row) => this.getTransferSession(row.id)!)
  }

  /**
   * Delete old transfer sessions
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  deleteOldTransferSessions(daysToKeep: number): number {
    const cutoffTime = Date.now() - daysToKeep * ONE_DAY_MS

    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const stmt = this.db.prepare(`
          DELETE FROM transfer_sessions WHERE start_time < ?
        `)

      const result = stmt.run(cutoffTime)
      this.db.exec('COMMIT')
      return result.changes
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Clear all transfer sessions
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  clearTransferSessions(): number {
    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const stmt = this.db.prepare('DELETE FROM transfer_sessions')
      const result = stmt.run()
      this.db.exec('COMMIT')
      return result.changes
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Add file to transfer session
   * Uses autocommit - WAL mode with busy_timeout ensures safe concurrent access
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
   * Uses simple UPDATE statement - better-sqlite3 handles atomicity automatically
   */
  updateFileStatus(
    sessionId: string,
    sourcePath: string,
    updates: Partial<FileTransferInfo>
  ): void {
    const fields: string[] = []
    const values: (string | number | null)[] = []

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

    // Simple UPDATE - in WAL mode with busy_timeout, this is safe for concurrent access
    // better-sqlite3 handles statement-level atomicity automatically
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

    const rows = stmt.all(sessionId, status) as FileRow[]

    return rows.map((file) => ({
      sourcePath: file.source_path,
      destinationPath: file.destination_path,
      fileName: file.file_name,
      fileSize: Number(file.file_size), // Ensure it's a number
      bytesTransferred: file.bytes_transferred,
      percentage: file.percentage,
      status: file.status as FileTransferInfo['status'],
      checksum: file.checksum ?? undefined,
      error: file.error ?? undefined,
      startTime: file.start_time ?? undefined,
      endTime: file.end_time ?? undefined,
      duration: file.duration ?? undefined
    }))
  }

  /**
   * Add log entry
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  addLogEntry(entry: Omit<LogEntry, 'timestamp'>): number {
    const timestamp = Date.now()

    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
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

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return timestamp
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?
    `)

    const rows = stmt.all(limit) as LogRow[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level as LogEntry['level'],
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

    const rows = stmt.all(level) as LogRow[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level as LogEntry['level'],
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

    const rows = stmt.all(startTime, endTime) as LogRow[]

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level as LogEntry['level'],
      message: row.message,
      context: row.context ? JSON.parse(row.context) : undefined
    }))
  }

  /**
   * Delete old logs
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  deleteOldLogs(daysToKeep: number): number {
    const cutoffTime = Date.now() - daysToKeep * ONE_DAY_MS

    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
      const stmt = this.db.prepare(`
          DELETE FROM logs WHERE timestamp < ?
        `)

      const result = stmt.run(cutoffTime)
      this.db.exec('COMMIT')
      return result.changes
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Clear all logs
   * Uses IMMEDIATE transaction to prevent concurrent write conflicts
   */
  clearLogs(): void {
    // Use manual IMMEDIATE transaction for explicit write locking
    this.db.exec('BEGIN IMMEDIATE')

    try {
      this.db.prepare('DELETE FROM logs').run()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Get database statistics
   */
  getDatabaseStats(): DatabaseStats {
    const sessions = this.db
      .prepare('SELECT COUNT(*) as count FROM transfer_sessions')
      .get() as CountRow
    const files = this.db.prepare('SELECT COUNT(*) as count FROM transfer_files').get() as CountRow
    const logs = this.db.prepare('SELECT COUNT(*) as count FROM logs').get() as CountRow

    // Get database file size
    let dbSize = 0
    try {
      const stats = fs.statSync(this.dbPath)
      dbSize = stats.size
    } catch {
      // Ignore error - file may not exist yet
    }

    return {
      totalSessions: sessions?.count || 0,
      totalFiles: files?.count || 0,
      totalLogs: logs?.count || 0,
      databaseSize: dbSize
    }
  }

  // ==========================================
  // Benchmark Methods
  // ==========================================

  /**
   * Save a benchmark run with its samples
   * Uses IMMEDIATE transaction for write safety
   */
  saveBenchmarkRun(result: BenchmarkResult): void {
    this.db.exec('BEGIN IMMEDIATE')

    try {
      // Insert the benchmark run
      const runStmt = this.db.prepare(`
        INSERT INTO benchmark_runs (
          id, timestamp, app_version, source_drive_name, source_drive_type,
          destination_path, destination_drive_type, total_bytes, total_files,
          total_duration_ms, avg_speed_mbps, peak_speed_mbps, read_speed_mbps,
          write_speed_mbps, checksum_speed_mbps, os, platform
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      runStmt.run(
        result.id,
        result.timestamp.getTime(),
        result.appVersion,
        result.sourceDrive.name,
        result.sourceDrive.type,
        result.destination.path,
        result.destination.driveType,
        result.metrics.totalBytes,
        result.metrics.totalFiles,
        result.metrics.totalDurationMs,
        result.metrics.avgSpeedMbps,
        result.metrics.peakSpeedMbps,
        result.metrics.readSpeedMbps,
        result.metrics.writeSpeedMbps,
        result.metrics.checksumSpeedMbps,
        result.os,
        result.platform
      )

      // Insert samples
      if (result.samples && result.samples.length > 0) {
        const sampleStmt = this.db.prepare(`
          INSERT INTO benchmark_samples (run_id, timestamp_ms, speed_mbps, phase, current_file)
          VALUES (?, ?, ?, ?, ?)
        `)

        for (const sample of result.samples) {
          sampleStmt.run(
            result.id,
            sample.timestampMs,
            sample.speedMbps,
            sample.phase,
            sample.currentFile || null
          )
        }
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Get benchmark history (summary list)
   */
  getBenchmarkHistory(limit: number = BENCHMARK_DEFAULT_RETENTION): BenchmarkHistoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, app_version, source_drive_name, source_drive_type,
             destination_path, avg_speed_mbps, total_bytes, total_duration_ms
      FROM benchmark_runs
      ORDER BY timestamp DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as Array<{
      id: string
      timestamp: number
      app_version: string
      source_drive_name: string
      source_drive_type: string
      destination_path: string
      avg_speed_mbps: number
      total_bytes: number
      total_duration_ms: number
    }>

    return rows.map((row) => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      appVersion: row.app_version,
      sourceDriveName: row.source_drive_name,
      sourceDriveType: row.source_drive_type,
      destinationPath: row.destination_path,
      avgSpeedMbps: row.avg_speed_mbps,
      totalBytes: row.total_bytes,
      totalDurationMs: row.total_duration_ms
    }))
  }

  /**
   * Get a full benchmark result by ID
   */
  getBenchmarkResult(id: string): BenchmarkResult | null {
    const runStmt = this.db.prepare(`
      SELECT * FROM benchmark_runs WHERE id = ?
    `)

    const row = runStmt.get(id) as BenchmarkRunRow | undefined

    if (!row) {
      return null
    }

    // Get samples
    const samplesStmt = this.db.prepare(`
      SELECT timestamp_ms, speed_mbps, phase, current_file
      FROM benchmark_samples
      WHERE run_id = ?
      ORDER BY timestamp_ms ASC
    `)

    const sampleRows = samplesStmt.all(id) as BenchmarkSampleRow[]

    const samples: SpeedSample[] = sampleRows.map((s) => ({
      timestampMs: s.timestamp_ms,
      speedMbps: s.speed_mbps,
      phase: s.phase as 'transfer' | 'verify',
      currentFile: s.current_file || undefined
    }))

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      appVersion: row.app_version,
      sourceDrive: {
        name: row.source_drive_name,
        type: row.source_drive_type
      },
      destination: {
        path: row.destination_path,
        driveType: row.destination_drive_type
      },
      metrics: {
        totalBytes: row.total_bytes,
        totalFiles: row.total_files,
        totalDurationMs: row.total_duration_ms,
        avgSpeedMbps: row.avg_speed_mbps,
        peakSpeedMbps: row.peak_speed_mbps,
        readSpeedMbps: row.read_speed_mbps,
        writeSpeedMbps: row.write_speed_mbps,
        checksumSpeedMbps: row.checksum_speed_mbps
      },
      samples,
      os: row.os,
      platform: row.platform
    }
  }

  /**
   * Delete a benchmark run and its samples
   */
  deleteBenchmarkRun(id: string): void {
    this.db.exec('BEGIN IMMEDIATE')

    try {
      // CASCADE will delete samples automatically
      const stmt = this.db.prepare('DELETE FROM benchmark_runs WHERE id = ?')
      stmt.run(id)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Prune old benchmark runs, keeping only the most recent N
   */
  pruneBenchmarkHistory(keepCount: number = BENCHMARK_DEFAULT_RETENTION): number {
    this.db.exec('BEGIN IMMEDIATE')

    try {
      // Get IDs to delete (all except the most recent keepCount)
      const idsToDelete = this.db
        .prepare(
          `
        SELECT id FROM benchmark_runs
        ORDER BY timestamp DESC
        LIMIT -1 OFFSET ?
      `
        )
        .all(keepCount) as Array<{ id: string }>

      if (idsToDelete.length === 0) {
        this.db.exec('COMMIT')
        return 0
      }

      // Delete old runs (CASCADE will handle samples)
      const placeholders = idsToDelete.map(() => '?').join(',')
      const deleteStmt = this.db.prepare(
        `DELETE FROM benchmark_runs WHERE id IN (${placeholders})`
      )
      const result = deleteStmt.run(...idsToDelete.map((r) => r.id))

      this.db.exec('COMMIT')
      return result.changes
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * Get benchmark run count
   */
  getBenchmarkRunCount(): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM benchmark_runs')
      .get() as CountRow
    return result?.count || 0
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
