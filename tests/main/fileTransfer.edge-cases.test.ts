/**
 * File Transfer Edge Cases Tests
 * Tests for various edge cases in file transfers
 */

import { FileTransferEngine } from '../../src/main/fileTransfer'
import { TransferErrorType } from '../../src/shared/types'
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

  describe('Large File Throttling', () => {
    it('should calculate appropriate throttling for different file sizes', () => {
      const engineAny = engine as any

      const smallFile = 50 * 1024 * 1024 // 50MB
      const mediumFile = 500 * 1024 * 1024 // 500MB
      const largeFile = 5 * 1024 * 1024 * 1024 // 5GB
      const hugeFile = 15 * 1024 * 1024 * 1024 // 15GB

      const smallThrottle = engineAny.calculateProgressThrottle(smallFile)
      expect(smallThrottle.interval).toBe(200)
      expect(smallThrottle.minBytes).toBe(2 * 1024 * 1024)

      const mediumThrottle = engineAny.calculateProgressThrottle(mediumFile)
      expect(mediumThrottle.interval).toBe(500)
      expect(mediumThrottle.minBytes).toBe(10 * 1024 * 1024)

      const largeThrottle = engineAny.calculateProgressThrottle(largeFile)
      expect(largeThrottle.interval).toBe(1000)
      expect(largeThrottle.minBytes).toBe(50 * 1024 * 1024)

      const hugeThrottle = engineAny.calculateProgressThrottle(hugeFile)
      expect(hugeThrottle.interval).toBe(2000)
      expect(hugeThrottle.minBytes).toBe(100 * 1024 * 1024)
    })
  })
})
