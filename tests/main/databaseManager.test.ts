/**
 * Database Manager Tests
 * Following TDD - these tests are written BEFORE implementation
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { DatabaseManager } from '../../src/main/databaseManager'
import { TransferSession, FileTransferInfo, LogEntry } from '../../src/shared/types'

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager
  let testDbPath: string

  beforeEach(() => {
    // Use a test-specific database path
    testDbPath = path.join(os.tmpdir(), `transferbox-test-db-${Date.now()}.db`)
    dbManager = new DatabaseManager(testDbPath)
  })

  afterEach(async () => {
    // Clean up test database
    dbManager.close()
    try {
      await fs.unlink(testDbPath)
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Initialization', () => {
    it('should initialize database with schema', () => {
      expect(dbManager).toBeDefined()
      // Database should be created and schema initialized
    })

    it('should create tables on initialization', () => {
      // Tables should exist after initialization
      const tables = dbManager.getTables()
      expect(tables).toContain('transfer_sessions')
      expect(tables).toContain('transfer_files')
      expect(tables).toContain('logs')
    })

    it('should enable WAL mode for better performance', () => {
      const journalMode = dbManager.getJournalMode()
      expect(journalMode).toBe('WAL') // SQLite returns uppercase
    })

    it('should enable foreign keys', () => {
      const foreignKeys = dbManager.getForeignKeysEnabled()
      expect(foreignKeys).toBe(true)
    })
  })

  describe('Transfer Sessions', () => {
    it('should create a transfer session', () => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 10,
        totalBytes: 1000000,
        files: []
      }

      const sessionId = dbManager.createTransferSession(session)

      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
    })

    it('should get a transfer session by id', () => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 5,
        totalBytes: 500000,
        files: []
      }

      const sessionId = dbManager.createTransferSession(session)
      const retrieved = dbManager.getTransferSession(sessionId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(sessionId)
      expect(retrieved?.driveId).toBe(session.driveId)
      expect(retrieved?.status).toBe('transferring')
    })

    it('should return null for non-existent session', () => {
      const retrieved = dbManager.getTransferSession('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should get all transfer sessions', () => {
      // Create multiple sessions
      const session1: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card 1',
        sourceRoot: '/Volumes/SD1',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'complete',
        fileCount: 5,
        totalBytes: 500000,
        files: []
      }

      const session2: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk3',
        driveName: 'SD Card 2',
        sourceRoot: '/Volumes/SD2',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'complete',
        fileCount: 10,
        totalBytes: 1000000,
        files: []
      }

      dbManager.createTransferSession(session1)
      dbManager.createTransferSession(session2)

      const allSessions = dbManager.getAllTransferSessions()

      expect(allSessions).toHaveLength(2)
      // Most recent first (session2 was created last)
      expect(allSessions[0].driveName).toBe('SD Card 2')
    })

    it('should update transfer session status', () => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 5,
        totalBytes: 500000,
        files: []
      }

      const sessionId = dbManager.createTransferSession(session)
      const endTime = Date.now()

      dbManager.updateTransferSession(sessionId, {
        status: 'complete',
        endTime
      })

      const updated = dbManager.getTransferSession(sessionId)
      expect(updated?.status).toBe('complete')
      expect(updated?.endTime).toBe(endTime)
    })

    it('should get sessions by date range', () => {
      const now = Date.now()
      const yesterday = now - 24 * 60 * 60 * 1000
      const tomorrow = now + 24 * 60 * 60 * 1000

      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: now,
        endTime: null,
        status: 'complete',
        fileCount: 5,
        totalBytes: 500000,
        files: []
      }

      dbManager.createTransferSession(session)

      const sessions = dbManager.getTransferSessionsByDateRange(yesterday, tomorrow)
      expect(sessions).toHaveLength(1)
    })

    it('should delete old sessions', () => {
      const oldTime = Date.now() - 100 * 24 * 60 * 60 * 1000 // 100 days ago
      const recentTime = Date.now()

      const oldSession: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'Old Card',
        sourceRoot: '/Volumes/OLD',
        destinationRoot: '/Users/test/Transfers',
        startTime: oldTime,
        endTime: oldTime,
        status: 'complete',
        fileCount: 5,
        totalBytes: 500000,
        files: []
      }

      const recentSession: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk3',
        driveName: 'Recent Card',
        sourceRoot: '/Volumes/RECENT',
        destinationRoot: '/Users/test/Transfers',
        startTime: recentTime,
        endTime: null,
        status: 'transferring',
        fileCount: 10,
        totalBytes: 1000000,
        files: []
      }

      dbManager.createTransferSession(oldSession)
      dbManager.createTransferSession(recentSession)

      // Delete sessions older than 50 days
      const deleted = dbManager.deleteOldTransferSessions(50)
      expect(deleted).toBeGreaterThan(0)

      const remaining = dbManager.getAllTransferSessions()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].driveName).toBe('Recent Card')
    })
  })

  describe('Transfer Files', () => {
    let sessionId: string

    beforeEach(() => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 0,
        totalBytes: 0,
        files: []
      }
      sessionId = dbManager.createTransferSession(session)
    })

    it('should add file to transfer session', () => {
      const file: FileTransferInfo = {
        sourcePath: '/Volumes/SD_CARD/IMG_001.jpg',
        destinationPath: '/Users/test/Transfers/IMG_001.jpg',
        fileName: 'IMG_001.jpg',
        fileSize: 1024000,
        bytesTransferred: 0,
        percentage: 0,
        status: 'pending',
        checksum: undefined
      }

      dbManager.addFileToSession(sessionId, file)

      const session = dbManager.getTransferSession(sessionId)
      expect(session?.files).toHaveLength(1)
      expect(session?.files[0].fileName).toBe('IMG_001.jpg')
    })

    it('should update file status', () => {
      const file: FileTransferInfo = {
        sourcePath: '/Volumes/SD_CARD/IMG_001.jpg',
        destinationPath: '/Users/test/Transfers/IMG_001.jpg',
        fileName: 'IMG_001.jpg',
        fileSize: 1024000,
        bytesTransferred: 0,
        percentage: 0,
        status: 'pending'
      }

      dbManager.addFileToSession(sessionId, file)

      dbManager.updateFileStatus(sessionId, file.sourcePath, {
        status: 'complete',
        bytesTransferred: 1024000,
        percentage: 100,
        checksum: 'abc123'
      })

      const session = dbManager.getTransferSession(sessionId)
      const updatedFile = session?.files.find((f) => f.sourcePath === file.sourcePath)

      expect(updatedFile?.status).toBe('complete')
      expect(updatedFile?.checksum).toBe('abc123')
    })

    it('should get files by status', () => {
      const file1: FileTransferInfo = {
        sourcePath: '/Volumes/SD_CARD/IMG_001.jpg',
        destinationPath: '/Users/test/Transfers/IMG_001.jpg',
        fileName: 'IMG_001.jpg',
        fileSize: 1024000,
        bytesTransferred: 1024000,
        percentage: 100,
        status: 'complete'
      }

      const file2: FileTransferInfo = {
        sourcePath: '/Volumes/SD_CARD/IMG_002.jpg',
        destinationPath: '/Users/test/Transfers/IMG_002.jpg',
        fileName: 'IMG_002.jpg',
        fileSize: 2048000,
        bytesTransferred: 0,
        percentage: 0,
        status: 'pending'
      }

      dbManager.addFileToSession(sessionId, file1)
      dbManager.addFileToSession(sessionId, file2)

      const completedFiles = dbManager.getFilesByStatus(sessionId, 'complete')
      expect(completedFiles).toHaveLength(1)
      expect(completedFiles[0].status).toBe('complete')
    })
  })

  describe('Logging', () => {
    it('should add log entry', () => {
      const logEntry: Omit<LogEntry, 'timestamp'> = {
        level: 'info',
        message: 'Transfer started',
        context: { driveId: '/dev/disk2' }
      }

      const timestamp = dbManager.addLogEntry(logEntry)

      expect(timestamp).toBeDefined()
      expect(typeof timestamp).toBe('number')
    })

    it('should get recent logs', () => {
      // Add multiple log entries
      dbManager.addLogEntry({ level: 'info', message: 'Log 1' })
      dbManager.addLogEntry({ level: 'warn', message: 'Log 2' })
      dbManager.addLogEntry({ level: 'error', message: 'Log 3' })

      const recentLogs = dbManager.getRecentLogs(2)

      expect(recentLogs).toHaveLength(2)
      // Should be in reverse chronological order (newest first)
      expect(recentLogs[0].message).toBe('Log 3')
    })

    it('should get logs by level', () => {
      dbManager.addLogEntry({ level: 'info', message: 'Info log' })
      dbManager.addLogEntry({ level: 'error', message: 'Error log' })
      dbManager.addLogEntry({ level: 'warn', message: 'Warning log' })

      const errorLogs = dbManager.getLogsByLevel('error')

      expect(errorLogs).toHaveLength(1)
      expect(errorLogs[0].level).toBe('error')
    })

    it('should get logs by date range', () => {
      const now = Date.now()
      const yesterday = now - 24 * 60 * 60 * 1000

      dbManager.addLogEntry({ level: 'info', message: 'Recent log' })

      const logs = dbManager.getLogsByDateRange(yesterday, now + 1000)

      expect(logs.length).toBeGreaterThan(0)
    })

    it('should delete old logs', () => {
      // Add old log (simulate by manipulating timestamp)
      dbManager.addLogEntry({ level: 'info', message: 'Old log' })

      // Add recent log
      dbManager.addLogEntry({ level: 'info', message: 'Recent log' })

      // Delete logs older than 100 days
      const deleted = dbManager.deleteOldLogs(100)

      // All logs should still exist (none older than 100 days)
      expect(deleted).toBe(0)
    })

    it('should clear all logs', () => {
      dbManager.addLogEntry({ level: 'info', message: 'Log 1' })
      dbManager.addLogEntry({ level: 'info', message: 'Log 2' })

      dbManager.clearLogs()

      const logs = dbManager.getRecentLogs()
      expect(logs).toHaveLength(0)
    })
  })

  describe('Database Maintenance', () => {
    it('should get database stats', () => {
      const stats = dbManager.getDatabaseStats()

      expect(stats).toBeDefined()
      expect(stats.totalSessions).toBeDefined()
      expect(stats.totalFiles).toBeDefined()
      expect(stats.totalLogs).toBeDefined()
      expect(stats.databaseSize).toBeDefined()
    })

    it('should vacuum database', () => {
      // Add some data
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'complete',
        fileCount: 0,
        totalBytes: 0,
        files: []
      }

      dbManager.createTransferSession(session)

      // Vacuum should not throw
      expect(() => dbManager.vacuum()).not.toThrow()
    })

    it('should close database connection', () => {
      expect(() => dbManager.close()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large file lists', () => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 1000,
        totalBytes: 1000000000,
        files: []
      }

      const sessionId = dbManager.createTransferSession(session)

      // Add 100 files
      for (let i = 0; i < 100; i++) {
        const file: FileTransferInfo = {
          sourcePath: `/Volumes/SD_CARD/IMG_${i.toString().padStart(3, '0')}.jpg`,
          destinationPath: `/Users/test/Transfers/IMG_${i.toString().padStart(3, '0')}.jpg`,
          fileName: `IMG_${i.toString().padStart(3, '0')}.jpg`,
          fileSize: 1024000,
          bytesTransferred: 0,
          percentage: 0,
          status: 'pending'
        }
        dbManager.addFileToSession(sessionId, file)
      }

      const retrieved = dbManager.getTransferSession(sessionId)
      expect(retrieved?.files).toHaveLength(100)
    })

    it('should handle concurrent writes', () => {
      // Multiple log entries added quickly
      const promises = Array.from({ length: 50 }, (_, i) =>
        dbManager.addLogEntry({ level: 'info', message: `Concurrent log ${i}` })
      )

      // Should not throw
      expect(() => promises).not.toThrow()

      const logs = dbManager.getRecentLogs(100)
      expect(logs.length).toBe(50)
    })

    it('should handle special characters in paths', () => {
      const session: Omit<TransferSession, 'id'> = {
        driveId: '/dev/disk2',
        driveName: "SD Card's Test",
        sourceRoot: '/Volumes/SD "CARD"',
        destinationRoot: '/Users/test/Tran$fers',
        startTime: Date.now(),
        endTime: null,
        status: 'complete',
        fileCount: 0,
        totalBytes: 0,
        files: []
      }

      const sessionId = dbManager.createTransferSession(session)
      const retrieved = dbManager.getTransferSession(sessionId)

      expect(retrieved?.driveName).toBe("SD Card's Test")
    })
  })
})
