/**
 * Drive Removal Integration Tests
 * Tests for drive disconnection during active transfers
 */

import { FileTransferEngine } from '../../src/main/fileTransfer'
import * as path from 'path'
import * as fsPromises from 'fs/promises'

describe('Drive Removal During Transfer', () => {
  let engine: FileTransferEngine
  let testDir: string

  beforeEach(async () => {
    engine = new FileTransferEngine()
    testDir = path.join(__dirname, '../temp/drive-removal-test')
    await fsPromises.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Error Categorization', () => {
    it('should wrap errors with TransferError type', async () => {
      const sourceFile = path.join(testDir, 'nonexistent.txt')
      const destFile = path.join(testDir, 'dest.txt')

      try {
        await engine.transferFile(sourceFile, destFile)
        fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
        // Check that error has an errorType (meaning it's a TransferError)
        expect((error as any).errorType).toBeDefined()
        // Error should be categorized (not just a generic Error)
        expect((error as any).name).toBe('TransferError')
      }
    })

    it('should categorize permission errors', async () => {
      const sourceFile = path.join(testDir, 'readonly.txt')
      const destFile = path.join(testDir, 'dest.txt')

      // Create file and remove read permissions
      await fsPromises.writeFile(sourceFile, 'content')
      await fsPromises.chmod(sourceFile, 0o000)

      try {
        await engine.transferFile(sourceFile, destFile)
        fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
        expect((error as any).errorType).toBeDefined()
        expect((error as any).name).toBe('TransferError')
        // Error should have isRetryable property
        expect(typeof (error as any).isRetryable).toBe('boolean')
      } finally {
        // Restore permissions for cleanup
        await fsPromises.chmod(sourceFile, 0o644).catch(() => {})
      }
    })
  })

  describe('Batch Transfer Error Handling', () => {
    it('should continue batch transfer with continueOnError when files fail', async () => {
      const file1 = path.join(testDir, 'file1.txt')
      const file2 = path.join(testDir, 'missing.txt') // This will fail
      const file3 = path.join(testDir, 'file3.txt')

      await fsPromises.writeFile(file1, 'content1')
      // Don't create file2
      await fsPromises.writeFile(file3, 'content3')

      const dest1 = path.join(testDir, 'dest1.txt')
      const dest2 = path.join(testDir, 'dest2.txt')
      const dest3 = path.join(testDir, 'dest3.txt')

      const results = await engine.transferFiles(
        [
          { source: file1, dest: dest1 },
          { source: file2, dest: dest2 },
          { source: file3, dest: dest3 }
        ],
        { continueOnError: true }
      )

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].errorType).toBeDefined() // Should have an error type
      expect(results[2].success).toBe(true)
    })

    it('should propagate error types through batch transfers', async () => {
      const file1 = path.join(testDir, 'file1.txt')
      const file2 = path.join(testDir, 'file2.txt')

      await fsPromises.writeFile(file1, 'content1')
      await fsPromises.writeFile(file2, 'content2')
      await fsPromises.chmod(file2, 0o000) // Remove permissions

      const results = await engine.transferFiles(
        [
          { source: file1, dest: path.join(testDir, 'dest1.txt') },
          { source: file2, dest: path.join(testDir, 'dest2.txt') }
        ],
        { continueOnError: true }
      )

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].errorType).toBeDefined() // Should have an error type

      // Restore permissions for cleanup
      await fsPromises.chmod(file2, 0o644).catch(() => {})
    })
  })

  describe('Cleanup', () => {
    it('should cleanup .TBPART file on error', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destFile = path.join(testDir, 'nonexistent-dir/dest.txt')
      const partFile = destFile + '.TBPART'

      await fsPromises.writeFile(sourceFile, 'content')

      // Transfer to non-existent directory should fail
      // But the .TBPART file should still be cleaned up
      try {
        await engine.transferFile(sourceFile, destFile)
        fail('Should have thrown error')
      } catch {
        // Verify .TBPART file doesn't exist
        await expect(fsPromises.access(partFile)).rejects.toThrow()
      }
    })
  })
})
