/**
 * Transfer Validator Tests
 * Tests for pre-transfer safety checks including conflict detection,
 * same/nested directory validation, and space validation
 */

import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'
import { validateTransfer, type TransferValidationOptions } from '../../src/main/transferValidator'

// Mock the logger
jest.mock('../../src/main/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))

// Mock pathValidator for disk space checks
jest.mock('../../src/main/pathValidator', () => ({
  hasEnoughSpace: jest.fn().mockResolvedValue(true),
  checkDiskSpace: jest.fn().mockResolvedValue({ totalSpace: 1000000000, freeSpace: 500000000 })
}))

describe('TransferValidator', () => {
  let tempDir: string
  let sourceDir: string
  let destDir: string

  beforeAll(async () => {
    // Create temp directories for testing
    tempDir = path.join(os.tmpdir(), `transferbox-test-${Date.now()}`)
    sourceDir = path.join(tempDir, 'source')
    destDir = path.join(tempDir, 'dest')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })
  })

  afterAll(async () => {
    // Cleanup temp directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  beforeEach(async () => {
    // Clean up dest directory contents before each test
    try {
      const entries = await fs.readdir(destDir)
      for (const entry of entries) {
        await fs.rm(path.join(destDir, entry), { recursive: true, force: true })
      }
    } catch {
      // Ignore errors
    }
  })

  describe('validateTransfer', () => {
    it('should pass validation for valid transfer', async () => {
      const sourceFile = path.join(sourceDir, 'test.txt')
      await fs.writeFile(sourceFile, 'test content')

      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: destDir,
        files: [{ source: sourceFile, dest: path.join(destDir, 'test.txt') }]
      }

      const result = await validateTransfer(options)

      expect(result.isValid).toBe(true)
      expect(result.canProceed).toBe(true)
      expect(result.conflicts).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)

      // Cleanup
      await fs.unlink(sourceFile)
    })

    it('should detect same directory error', async () => {
      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: sourceDir,
        files: []
      }

      const result = await validateTransfer(options)

      expect(result.isValid).toBe(false)
      expect(result.canProceed).toBe(false)
      expect(result.warnings.some((w) => w.type === 'same_directory')).toBe(true)
      expect(result.error).toContain('same directory')
    })

    it('should detect nested destination in source error', async () => {
      const nestedDest = path.join(sourceDir, 'nested', 'dest')
      await fs.mkdir(nestedDest, { recursive: true })

      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: nestedDest,
        files: []
      }

      const result = await validateTransfer(options)

      expect(result.isValid).toBe(false)
      expect(result.canProceed).toBe(false)
      expect(result.warnings.some((w) => w.type === 'nested_dest_in_source')).toBe(true)
      expect(result.error).toContain('inside the source')

      // Cleanup
      await fs.rm(path.join(sourceDir, 'nested'), { recursive: true, force: true })
    })

    it('should detect nested source in destination error', async () => {
      const nestedSource = path.join(destDir, 'nested', 'source')
      await fs.mkdir(nestedSource, { recursive: true })

      const options: TransferValidationOptions = {
        sourceRoot: nestedSource,
        destinationRoot: destDir,
        files: []
      }

      const result = await validateTransfer(options)

      expect(result.isValid).toBe(false)
      expect(result.canProceed).toBe(false)
      expect(result.warnings.some((w) => w.type === 'nested_source_in_dest')).toBe(true)

      // Cleanup
      await fs.rm(path.join(destDir, 'nested'), { recursive: true, force: true })
    })

    it('should detect file conflicts', async () => {
      // Create source and destination files with same name
      const sourceFile = path.join(sourceDir, 'conflict.txt')
      const destFile = path.join(destDir, 'conflict.txt')

      await fs.writeFile(sourceFile, 'source content')
      await fs.writeFile(destFile, 'dest content')

      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: destDir,
        files: [{ source: sourceFile, dest: destFile }],
        conflictResolution: 'ask'
      }

      const result = await validateTransfer(options)

      expect(result.isValid).toBe(true) // Conflicts don't make it invalid
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].fileName).toBe('conflict.txt')
      expect(result.requiresConfirmation).toBe(true)
      expect(result.warnings.some((w) => w.type === 'file_conflicts')).toBe(true)

      // Cleanup
      await fs.unlink(sourceFile)
      await fs.unlink(destFile)
    })

    it('should not require confirmation when conflict resolution is not ask', async () => {
      // Create source and destination files with same name
      const sourceFile = path.join(sourceDir, 'conflict2.txt')
      const destFile = path.join(destDir, 'conflict2.txt')

      await fs.writeFile(sourceFile, 'source content')
      await fs.writeFile(destFile, 'dest content')

      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: destDir,
        files: [{ source: sourceFile, dest: destFile }],
        conflictResolution: 'skip' // Not 'ask'
      }

      const result = await validateTransfer(options)

      expect(result.conflicts).toHaveLength(1)
      expect(result.requiresConfirmation).toBe(false)

      // Cleanup
      await fs.unlink(sourceFile)
      await fs.unlink(destFile)
    })

    it('should calculate space required from file sizes', async () => {
      const sourceFile = path.join(sourceDir, 'size-test.txt')
      const content = 'A'.repeat(1024) // 1KB file
      await fs.writeFile(sourceFile, content)

      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: destDir,
        files: [{ source: sourceFile, dest: path.join(destDir, 'size-test.txt') }]
      }

      const result = await validateTransfer(options)

      expect(result.spaceRequired).toBeGreaterThan(0)

      // Cleanup
      await fs.unlink(sourceFile)
    })

    it('should use provided file sizes if available', async () => {
      const options: TransferValidationOptions = {
        sourceRoot: sourceDir,
        destinationRoot: destDir,
        files: [
          { source: '/nonexistent/file.txt', dest: path.join(destDir, 'file.txt'), size: 5000 }
        ]
      }

      const result = await validateTransfer(options)

      expect(result.spaceRequired).toBe(5000)
    })
  })
})
