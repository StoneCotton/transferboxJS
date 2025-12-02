/**
 * File Transfer Edge Cases Tests
 * Tests for various edge cases in file transfers
 */

import { FileTransferEngine } from '../../src/main/fileTransfer'
import { TransferErrorType } from '../../src/shared/types'
import { TransferError } from '../../src/main/errors/TransferError'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('FileTransfer Edge Cases', () => {
  let engine: FileTransferEngine
  let testDir: string

  beforeEach(async () => {
    engine = new FileTransferEngine()
    testDir = path.join(__dirname, '../temp/edge-cases-test')
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Permission Errors', () => {
    it('should detect permission denied on source', async () => {
      const sourceFile = path.join(testDir, 'readonly.txt')
      const destFile = path.join(testDir, 'dest.txt')

      await fs.writeFile(sourceFile, 'content')
      await fs.chmod(sourceFile, 0o000) // Remove all permissions

      try {
        await engine.transferFile(sourceFile, destFile)
        fail('Should have thrown error')
      } catch (error) {
        expect((error as any).errorType).toBeDefined()
        // Permission errors should be categorized
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(sourceFile, 0o644).catch(() => {})
      }
    })
  })

  describe('Retry Logic', () => {
    it('should verify retryable error types are correctly marked', () => {
      // Test that drive disconnection errors are retryable
      const driveError = TransferError.fromNodeError({
        code: 'ENOENT',
        message: 'No such file or directory'
      } as NodeJS.ErrnoException)

      expect(driveError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(driveError.isRetryable).toBe(true)

      // Test that checksum mismatch errors are retryable
      const checksumError = TransferError.fromChecksumMismatch('abc123', 'def456')

      expect(checksumError.errorType).toBe(TransferErrorType.CHECKSUM_MISMATCH)
      expect(checksumError.isRetryable).toBe(true)
    })

    it('should verify non-retryable error types are correctly marked', () => {
      // Test that permission errors are not retryable
      const permissionError = TransferError.fromNodeError({
        code: 'EACCES',
        message: 'Permission denied'
      } as NodeJS.ErrnoException)

      expect(permissionError.errorType).toBe(TransferErrorType.PERMISSION_DENIED)
      expect(permissionError.isRetryable).toBe(false)

      // Test that space errors are not retryable
      const spaceError = TransferError.fromNodeError({
        code: 'ENOSPC',
        message: 'No space left on device'
      } as NodeJS.ErrnoException)

      expect(spaceError.errorType).toBe(TransferErrorType.INSUFFICIENT_SPACE)
      expect(spaceError.isRetryable).toBe(false)
    })

    it('should successfully transfer files with retry configuration', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destFile = path.join(testDir, 'dest.txt')

      await fs.writeFile(sourceFile, 'test content')

      // Test that retry configuration is accepted
      const result = await engine.transferFile(sourceFile, destFile, {
        maxRetries: 3,
        retryDelay: 100,
        verifyChecksum: true
      })

      expect(result.success).toBe(true)
      expect(result.checksumVerified).toBe(true)
    })
  })

  describe('Source Not Found', () => {
    it('should detect missing source files', async () => {
      const sourceFile = path.join(testDir, 'missing.txt')
      const destFile = path.join(testDir, 'dest.txt')

      try {
        await engine.transferFile(sourceFile, destFile)
        fail('Should have thrown error')
      } catch (error) {
        expect((error as any).errorType).toBeDefined()
        // Missing files should be categorized
      }
    })
  })

  describe('Checksum Verification', () => {
    it('should successfully transfer files with checksum verification', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destFile = path.join(testDir, 'dest.txt')

      await fs.writeFile(sourceFile, 'test content')

      const result = await engine.transferFile(sourceFile, destFile, {
        verifyChecksum: true
      })

      expect(result.success).toBe(true)
      expect(result.checksumVerified).toBe(true)
      expect(result.sourceChecksum).toBeDefined()
      expect(result.destChecksum).toBeDefined()
    })
  })

  describe('Error Propagation', () => {
    it('should propagate error type through batch transfers', async () => {
      const file1 = path.join(testDir, 'file1.txt')
      const file2 = path.join(testDir, 'file2.txt')

      await fs.writeFile(file1, 'content1')
      await fs.writeFile(file2, 'content2')

      // Remove read permission from file2
      await fs.chmod(file2, 0o000)

      const results = await engine.transferFiles(
        [
          { source: file1, dest: path.join(testDir, 'dest1.txt') },
          { source: file2, dest: path.join(testDir, 'dest2.txt') }
        ],
        { continueOnError: true }
      )

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].errorType).toBeDefined() // Error type should be set

      // Restore permissions for cleanup
      await fs.chmod(file2, 0o644).catch(() => {})
    })
  })

  // Note: Progress throttling tests moved to tests/main/utils/progressTracker.test.ts
  // The throttle calculation is now handled by the ProgressTracker class
})
