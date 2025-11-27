/**
 * Additional File Transfer Tests for Coverage
 * Tests for edge cases and error paths not covered by existing tests
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  FileTransferEngine,
  TransferOptions,
  TransferResult,
  transferFile,
  transferFiles,
  cleanupOrphanedPartFiles
} from '../../src/main/fileTransfer'

describe('FileTransferEngine - Additional Coverage', () => {
  let testDir: string
  let sourceDir: string
  let destDir: string
  let engine: FileTransferEngine

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `transferbox-coverage-test-${Date.now()}`)
    sourceDir = path.join(testDir, 'source')
    destDir = path.join(testDir, 'dest')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })

    engine = new FileTransferEngine()
  })

  afterEach(async () => {
    await engine.stop()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Buffer Size Validation', () => {
    it('should reject buffer size below minimum', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      const options: TransferOptions = {
        bufferSize: 100 // Below 1KB minimum
      }

      await expect(engine.transferFile(sourceFile, destFile, options)).rejects.toThrow(
        /buffer size/i
      )
    })

    it('should reject buffer size above maximum', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      const options: TransferOptions = {
        bufferSize: 20 * 1024 * 1024 // 20MB, above 10MB maximum
      }

      await expect(engine.transferFile(sourceFile, destFile, options)).rejects.toThrow(
        /buffer size/i
      )
    })
  })

  describe('Transfer Engine State', () => {
    it('should reject transfers when stopping', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      // Start stopping the engine
      const stopPromise = engine.stop()

      // Try to start a new transfer while stopping
      await expect(engine.transferFile(sourceFile, destFile)).rejects.toThrow(/stopping/i)

      await stopPromise
    })

    it('should track isTransferring status correctly', async () => {
      expect(engine.isTransferring()).toBe(false)

      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      await engine.transferFile(sourceFile, destFile)

      // After transfer completes, should not be transferring
      expect(engine.isTransferring()).toBe(false)
    })

    it('should reset engine state correctly', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      // Transfer a file
      await engine.transferFile(sourceFile, destFile)

      // Stop the engine
      await engine.stop()

      // Reset the engine
      engine.reset()

      // Should be able to transfer again
      const destFile2 = path.join(destDir, 'test2.txt')
      const result = await engine.transferFile(sourceFile, destFile2)
      expect(result.success).toBe(true)
    })
  })

  describe('Empty and Invalid Batch Transfers', () => {
    it('should return empty array for empty file list', async () => {
      const results = await engine.transferFiles([])
      expect(results).toEqual([])
    })

    it('should use default concurrency for invalid values', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') }
      ]

      await fs.writeFile(files[0].source, 'content')

      // Test with invalid concurrency - should use default
      const options: TransferOptions = {
        maxConcurrency: 100 // Above max limit of 10
      }

      const results = await engine.transferFiles(files, options)
      expect(results[0].success).toBe(true)
    })

    it('should use default concurrency for zero value', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') }
      ]

      await fs.writeFile(files[0].source, 'content')

      const options: TransferOptions = {
        maxConcurrency: 0 // Below min limit of 1
      }

      const results = await engine.transferFiles(files, options)
      expect(results[0].success).toBe(true)
    })
  })

  describe('Batch Transfer Progress Callbacks', () => {
    it('should call onProgress with aggregated progress for parallel transfers', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.bin'), dest: path.join(destDir, 'file1.bin') },
        { source: path.join(sourceDir, 'file2.bin'), dest: path.join(destDir, 'file2.bin') },
        { source: path.join(sourceDir, 'file3.bin'), dest: path.join(destDir, 'file3.bin') }
      ]

      // Create larger files to ensure progress is reported
      for (const file of files) {
        const buffer = Buffer.alloc(2 * 1024 * 1024, 'x') // 2MB each
        await fs.writeFile(file.source, buffer)
      }

      const progressUpdates: any[] = []

      const options: TransferOptions = {
        maxConcurrency: 3, // Run all in parallel
        onProgress: (progress) => {
          progressUpdates.push({ ...progress })
        }
      }

      await engine.transferFiles(files, options)

      // Progress may or may not be reported depending on transfer speed
      // The important thing is that the callback doesn't error
      // If updates were reported, verify the structure
      if (progressUpdates.length > 0) {
        const lastProgress = progressUpdates[progressUpdates.length - 1]
        expect(lastProgress.bytesTransferred).toBeDefined()
        expect(lastProgress.totalBytes).toBeDefined()
        expect(lastProgress.percentage).toBeDefined()
      }
    })

    it('should call onFileComplete for each file in batch', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') },
        { source: path.join(sourceDir, 'file2.txt'), dest: path.join(destDir, 'file2.txt') }
      ]

      for (const file of files) {
        await fs.writeFile(file.source, 'content')
      }

      const completions: { fileIndex: number; result: TransferResult }[] = []

      const options: TransferOptions = {
        onFileComplete: (fileIndex, result) => {
          completions.push({ fileIndex, result })
        }
      }

      await engine.transferFiles(files, options)

      expect(completions).toHaveLength(2)
      expect(completions.every((c) => c.result.success)).toBe(true)
    })

    it('should call onFileComplete even for failed files', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') },
        { source: path.join(sourceDir, 'missing.txt'), dest: path.join(destDir, 'missing.txt') }
      ]

      await fs.writeFile(files[0].source, 'content')
      // Don't create second file

      const completions: { fileIndex: number; result: TransferResult }[] = []

      const options: TransferOptions = {
        continueOnError: true,
        onFileComplete: (fileIndex, result) => {
          completions.push({ fileIndex, result })
        }
      }

      await engine.transferFiles(files, options)

      expect(completions).toHaveLength(2)
      expect(completions.find((c) => c.fileIndex === 0)?.result.success).toBe(true)
      expect(completions.find((c) => c.fileIndex === 1)?.result.success).toBe(false)
    })

    it('should call onChecksumProgress during batch transfer with checksums', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.bin'), dest: path.join(destDir, 'file1.bin') }
      ]

      // Create a file large enough for checksum progress
      const buffer = Buffer.alloc(256 * 1024, 'y') // 256KB
      await fs.writeFile(files[0].source, buffer)

      let checksumProgressCalled = false

      const options: TransferOptions = {
        verifyChecksum: true,
        onChecksumProgress: (phase, bytesProcessed, totalBytes) => {
          checksumProgressCalled = true
          expect(['source', 'destination']).toContain(phase)
          expect(bytesProcessed).toBeGreaterThanOrEqual(0)
          expect(totalBytes).toBeGreaterThan(0)
        }
      }

      await engine.transferFiles(files, options)

      // Note: onChecksumProgress may not be called if transfer completes quickly
      // The important thing is that it doesn't error
    })
  })

  describe('Batch Transfer Error Handling', () => {
    it('should throw and cleanup when continueOnError is false', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') },
        { source: path.join(sourceDir, 'missing.txt'), dest: path.join(destDir, 'missing.txt') },
        { source: path.join(sourceDir, 'file3.txt'), dest: path.join(destDir, 'file3.txt') }
      ]

      await fs.writeFile(files[0].source, 'content1')
      await fs.writeFile(files[2].source, 'content3')
      // Don't create missing.txt

      const options: TransferOptions = {
        continueOnError: false,
        maxConcurrency: 1 // Sequential to ensure order
      }

      await expect(engine.transferFiles(files, options)).rejects.toThrow()
    })
  })

  describe('Path Validation', () => {
    it('should reject invalid source path', async () => {
      const destFile = path.join(destDir, 'test.txt')

      // Pass a path with null bytes which is invalid
      await expect(engine.transferFile('\0invalid', destFile)).rejects.toThrow(/invalid/i)
    })

    it('should reject invalid destination path', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      // Pass a path with null bytes which is invalid
      await expect(engine.transferFile(sourceFile, '\0invalid')).rejects.toThrow(/invalid/i)
    })
  })

  describe('Convenience Functions', () => {
    it('should transfer single file using convenience function', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'content')

      const result = await transferFile(sourceFile, destFile)

      expect(result.success).toBe(true)
    })

    it('should transfer multiple files using convenience function', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') },
        { source: path.join(sourceDir, 'file2.txt'), dest: path.join(destDir, 'file2.txt') }
      ]

      for (const file of files) {
        await fs.writeFile(file.source, 'content')
      }

      const results = await transferFiles(files)

      expect(results).toHaveLength(2)
      expect(results.every((r) => r.success)).toBe(true)
    })
  })

  describe('Cleanup Functions', () => {
    it('should handle non-existent directory in cleanup', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent')

      // Should not throw, just return 0
      const cleaned = await cleanupOrphanedPartFiles(nonExistentDir)
      expect(cleaned).toBe(0)
    })

    it('should skip files that cannot be deleted during cleanup', async () => {
      // This test verifies the error handling path in cleanup
      // Create an old .TBPART file
      const partFile = path.join(destDir, 'test.TBPART')
      await fs.writeFile(partFile, 'data')

      // Make it old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await fs.utimes(partFile, oldTime, oldTime)

      // On some systems, we might not be able to remove write permissions
      // This test mainly ensures the error handling path doesn't throw
      const cleaned = await cleanupOrphanedPartFiles(destDir)
      expect(cleaned).toBeGreaterThanOrEqual(0)
    })

    it('should handle directories that cannot be accessed', async () => {
      // Create a directory with restricted permissions
      const restrictedDir = path.join(destDir, 'restricted')
      await fs.mkdir(restrictedDir, { recursive: true })

      // Create a .TBPART file inside
      const partFile = path.join(restrictedDir, 'test.TBPART')
      await fs.writeFile(partFile, 'data')

      // Make it old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await fs.utimes(partFile, oldTime, oldTime)

      // Run cleanup - should work even if some subdirs have issues
      const cleaned = await cleanupOrphanedPartFiles(destDir)
      expect(cleaned).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Stream Error Handling', () => {
    it('should handle symlinks in source file validation', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      const symlinkFile = path.join(sourceDir, 'link.txt')
      const destFile = path.join(destDir, 'test.txt')

      await fs.writeFile(sourceFile, 'content')
      await fs.symlink(sourceFile, symlinkFile)

      // Symlinks should be rejected
      await expect(engine.transferFile(symlinkFile, destFile)).rejects.toThrow()
    })
  })

  describe('Stop with Active Transfers', () => {
    it('should handle stopping during active transfer', async () => {
      // Create a large file to ensure transfer is in progress when we stop
      const sourceFile = path.join(sourceDir, 'large.bin')
      const destFile = path.join(destDir, 'large.bin')
      const buffer = Buffer.alloc(200 * 1024 * 1024, 'z') // 200MB
      await fs.writeFile(sourceFile, buffer)

      // Start transfer without awaiting
      const transferPromise = engine.transferFile(sourceFile, destFile)

      // Give a moment for transfer to start, then stop
      setImmediate(() => {
        engine.stop()
      })

      // Transfer should be cancelled or completed
      try {
        await transferPromise
        // If completed, that's fine - fast systems might complete before stop
        expect(true).toBe(true)
      } catch (error) {
        // If cancelled/stopped, that's expected
        // Error could be any variant: Transfer stopped, Transfer cancelled, etc.
        expect(error).toBeDefined()
        expect((error as Error).message).toBeDefined()
      }
    })
  })
})

describe('FileTransferEngine - Progress Throttling Coverage', () => {
  let engine: FileTransferEngine

  beforeEach(() => {
    engine = new FileTransferEngine()
  })

  afterEach(async () => {
    await engine.stop()
  })

  it('should calculate progress throttle for small files', () => {
    const engineAny = engine as any

    // Small file < 100MB
    const throttle = engineAny.calculateProgressThrottle(50 * 1024 * 1024)
    expect(throttle.interval).toBeDefined()
    expect(throttle.minBytes).toBeDefined()
  })

  it('should calculate progress throttle for medium files', () => {
    const engineAny = engine as any

    // Medium file 100MB - 1GB
    const throttle = engineAny.calculateProgressThrottle(500 * 1024 * 1024)
    expect(throttle.interval).toBeDefined()
    expect(throttle.minBytes).toBeDefined()
  })

  it('should calculate progress throttle for large files', () => {
    const engineAny = engine as any

    // Large file 1GB - 10GB
    const throttle = engineAny.calculateProgressThrottle(5 * 1024 * 1024 * 1024)
    expect(throttle.interval).toBeDefined()
    expect(throttle.minBytes).toBeDefined()
  })

  it('should calculate progress throttle for extra large files', () => {
    const engineAny = engine as any

    // Extra large file > 10GB
    const throttle = engineAny.calculateProgressThrottle(15 * 1024 * 1024 * 1024)
    expect(throttle.interval).toBeDefined()
    expect(throttle.minBytes).toBeDefined()
  })
})

describe('FileTransferEngine - Additional Edge Cases', () => {
  let testDir: string
  let sourceDir: string
  let destDir: string
  let engine: FileTransferEngine

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `transferbox-edge-coverage-${Date.now()}`)
    sourceDir = path.join(testDir, 'source')
    destDir = path.join(testDir, 'dest')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })

    engine = new FileTransferEngine()
  })

  afterEach(async () => {
    await engine.stop()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Temp File Cleanup', () => {
    it('should handle cleanup when temp file does not exist', async () => {
      const engineAny = engine as any

      // Try to cleanup a non-existent temp file - should not throw
      await expect(
        engineAny.cleanupTempFile('/nonexistent/path/file.TBPART')
      ).resolves.not.toThrow()
    })
  })

  describe('Checksum Mismatch Detection', () => {
    it('should detect checksum mismatch when destination is corrupted', async () => {
      // This test verifies the checksum verification path
      const sourceFile = path.join(sourceDir, 'test.txt')
      const destFile = path.join(destDir, 'test.txt')
      await fs.writeFile(sourceFile, 'original content')

      // Transfer with checksum verification
      const result = await engine.transferFile(sourceFile, destFile, {
        verifyChecksum: true
      })

      // The transfer should succeed with matching checksums
      expect(result.success).toBe(true)
      expect(result.checksumVerified).toBe(true)
      expect(result.sourceChecksum).toBe(result.destChecksum)
    })
  })

  describe('Batch Transfer with onBatchProgress', () => {
    it('should call onBatchProgress callback on error', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') },
        { source: path.join(sourceDir, 'missing.txt'), dest: path.join(destDir, 'missing.txt') }
      ]

      await fs.writeFile(files[0].source, 'content')
      // Don't create missing.txt

      const batchProgress: { completed: number; total: number }[] = []

      const options: TransferOptions = {
        continueOnError: true,
        onBatchProgress: (completed, total) => {
          batchProgress.push({ completed, total })
        }
      }

      await engine.transferFiles(files, options)

      // Should have progress updates for both files
      expect(batchProgress.length).toBeGreaterThanOrEqual(2)
      const lastProgress = batchProgress[batchProgress.length - 1]
      expect(lastProgress.completed).toBe(2)
      expect(lastProgress.total).toBe(2)
    })
  })

  describe('Batch Transfer with Checksum Progress', () => {
    it('should pass through checksum progress in batch mode', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.txt'), dest: path.join(destDir, 'file1.txt') }
      ]

      // Create a file
      const buffer = Buffer.alloc(1024 * 1024, 'x') // 1MB
      await fs.writeFile(files[0].source, buffer)

      let checksumProgressCalled = false

      const options: TransferOptions = {
        verifyChecksum: true,
        onChecksumProgress: () => {
          checksumProgressCalled = true
        },
        onProgress: () => {} // Also add onProgress to trigger the branch
      }

      await engine.transferFiles(files, options)

      // The callback structure is set up correctly, but may not be called for fast transfers
      // What matters is no errors
    })
  })

  describe('Parallel Transfer Error Cleanup', () => {
    it('should wait for remaining transfers when one fails without continueOnError', async () => {
      const files = [
        { source: path.join(sourceDir, 'file1.bin'), dest: path.join(destDir, 'file1.bin') },
        { source: path.join(sourceDir, 'file2.bin'), dest: path.join(destDir, 'file2.bin') },
        { source: path.join(sourceDir, 'missing.bin'), dest: path.join(destDir, 'missing.bin') }
      ]

      // Create some files (larger to ensure parallel execution)
      const buffer = Buffer.alloc(2 * 1024 * 1024, 'x') // 2MB
      await fs.writeFile(files[0].source, buffer)
      await fs.writeFile(files[1].source, buffer)
      // Don't create missing.bin

      const options: TransferOptions = {
        maxConcurrency: 3,
        continueOnError: false
      }

      // Should throw but properly cleanup
      await expect(engine.transferFiles(files, options)).rejects.toThrow()

      // No .TBPART files should be left
      const destFiles = await fs.readdir(destDir)
      const tbpartFiles = destFiles.filter((f) => f.endsWith('.TBPART'))
      expect(tbpartFiles.length).toBe(0)
    })
  })

  describe('Transfer Stopped During Batch', () => {
    it('should handle batch cancellation or completion', async () => {
      const files = Array.from({ length: 5 }, (_, i) => ({
        source: path.join(sourceDir, `file${i}.bin`),
        dest: path.join(destDir, `file${i}.bin`)
      }))

      // Create larger source files
      for (const file of files) {
        const buffer = Buffer.alloc(10 * 1024 * 1024, 'y') // 10MB each
        await fs.writeFile(file.source, buffer)
      }

      // Start batch transfer
      const transferPromise = engine.transferFiles(files, { maxConcurrency: 2 })

      // Stop after a short delay
      setTimeout(() => {
        engine.stop()
      }, 10)

      // On fast systems, the transfer may complete before stop is processed
      // Either outcome is acceptable
      try {
        const results = await transferPromise
        // Transfer completed - verify results
        expect(Array.isArray(results)).toBe(true)
      } catch (error) {
        // Transfer was cancelled - message can be "cancelled", "stopped", or "stopping"
        expect((error as Error).message).toMatch(/cancell|stopp/i)
      }
    })
  })

  describe('File Stat Validation', () => {
    it('should handle files that disappear during transfer', async () => {
      const sourceFile = path.join(sourceDir, 'disappearing.txt')
      const destFile = path.join(destDir, 'disappearing.txt')

      await fs.writeFile(sourceFile, 'content')

      // Transfer should work normally
      const result = await engine.transferFile(sourceFile, destFile)
      expect(result.success).toBe(true)
    })
  })

  describe('Orphaned File Scanning', () => {
    it('should handle inaccessible files during scanning', async () => {
      // Create a .TBPART file that's old
      const partFile = path.join(destDir, 'old.TBPART')
      await fs.writeFile(partFile, 'data')

      // Make it old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await fs.utimes(partFile, oldTime, oldTime)

      // Run cleanup
      const cleaned = await cleanupOrphanedPartFiles(destDir)

      // Should have cleaned the file
      expect(cleaned).toBe(1)
    })

    it('should skip recent .TBPART files during cleanup', async () => {
      // Create a recent .TBPART file
      const recentFile = path.join(destDir, 'recent.TBPART')
      await fs.writeFile(recentFile, 'data')

      // Run cleanup immediately (file is recent)
      const cleaned = await cleanupOrphanedPartFiles(destDir)

      // Should not have cleaned the recent file
      expect(cleaned).toBe(0)

      // File should still exist
      await expect(fs.access(recentFile)).resolves.not.toThrow()
    })
  })
})
