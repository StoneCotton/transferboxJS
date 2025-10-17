/**
 * Tests for file metadata preservation during transfers
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { transferFile } from '../../src/main/fileTransfer'

describe('File Transfer Metadata Preservation', () => {
  let tempDir: string
  let sourceDir: string
  let destDir: string

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `transferbox-metadata-test-${Date.now()}`)
    sourceDir = path.join(tempDir, 'source')
    destDir = path.join(tempDir, 'dest')
    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should preserve file timestamps (atime, mtime)', async () => {
    // Create a test file with specific timestamps
    const testFile = path.join(sourceDir, 'test.txt')
    const testContent = 'This is a test file for metadata preservation'
    await fs.writeFile(testFile, testContent)

    // Set specific timestamps (1 hour ago for atime, 2 hours ago for mtime)
    const now = new Date()
    const atime = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
    const mtime = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago

    await fs.utimes(testFile, atime, mtime)

    // Get original stats
    const originalStats = await fs.stat(testFile)
    const originalAtime = originalStats.atime
    const originalMtime = originalStats.mtime

    // Transfer the file
    const destFile = path.join(destDir, 'test.txt')
    await transferFile(testFile, destFile)

    // Get destination stats
    const destStats = await fs.stat(destFile)

    // Verify timestamps are preserved (within 1 second tolerance for filesystem precision)
    const timeTolerance = 1000 // 1 second in milliseconds

    expect(Math.abs(destStats.atime.getTime() - originalAtime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
    expect(Math.abs(destStats.mtime.getTime() - originalMtime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
  })

  it('should preserve file permissions', async () => {
    // Create a test file
    const testFile = path.join(sourceDir, 'test.txt')
    await fs.writeFile(testFile, 'Test content')

    // Set specific permissions (read/write for owner, read for group and others)
    const testMode = 0o644
    await fs.chmod(testFile, testMode)

    // Get original stats
    const originalStats = await fs.stat(testFile)

    // Transfer the file
    const destFile = path.join(destDir, 'test.txt')
    await transferFile(testFile, destFile)

    // Get destination stats
    const destStats = await fs.stat(destFile)

    // Verify permissions are preserved
    expect(destStats.mode & 0o777).toBe(originalStats.mode & 0o777)
  })

  it('should preserve file size', async () => {
    // Create a test file with specific content
    const testContent = 'This is a test file for size verification'
    const testFile = path.join(sourceDir, 'test.txt')
    await fs.writeFile(testFile, testContent)

    // Get original stats
    const originalStats = await fs.stat(testFile)

    // Transfer the file
    const destFile = path.join(destDir, 'test.txt')
    await transferFile(testFile, destFile)

    // Get destination stats
    const destStats = await fs.stat(destFile)

    // Verify file size is preserved
    expect(destStats.size).toBe(originalStats.size)
  })

  it('should preserve file content integrity', async () => {
    // Create a test file with specific content
    const testContent =
      'This is a test file for content verification with special characters: éñ中文🚀'
    const testFile = path.join(sourceDir, 'test.txt')
    await fs.writeFile(testFile, testContent, 'utf8')

    // Transfer the file
    const destFile = path.join(destDir, 'test.txt')
    await transferFile(testFile, destFile)

    // Verify content is preserved
    const destContent = await fs.readFile(destFile, 'utf8')
    expect(destContent).toBe(testContent)
  })

  it('should handle binary files with metadata preservation', async () => {
    // Create a binary test file
    const testFile = path.join(sourceDir, 'test.bin')
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd, 0xfc])
    await fs.writeFile(testFile, binaryData)

    // Set specific timestamps
    const now = new Date()
    const atime = new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
    const mtime = new Date(now.getTime() - 45 * 60 * 1000) // 45 minutes ago
    await fs.utimes(testFile, atime, mtime)

    // Get original stats
    const originalStats = await fs.stat(testFile)

    // Transfer the file
    const destFile = path.join(destDir, 'test.bin')
    await transferFile(testFile, destFile)

    // Get destination stats
    const destStats = await fs.stat(destFile)

    // Verify binary content is preserved
    const destContent = await fs.readFile(destFile)
    expect(destContent).toEqual(binaryData)

    // Verify timestamps are preserved
    const timeTolerance = 1000 // 1 second in milliseconds
    expect(Math.abs(destStats.atime.getTime() - originalStats.atime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
    expect(Math.abs(destStats.mtime.getTime() - originalStats.mtime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
  })

  it('should preserve metadata with checksum verification enabled', async () => {
    // Create a test file
    const testFile = path.join(sourceDir, 'test.txt')
    const testContent = 'Test content for checksum verification'
    await fs.writeFile(testFile, testContent)

    // Set specific timestamps
    const now = new Date()
    const atime = new Date(now.getTime() - 15 * 60 * 1000) // 15 minutes ago
    const mtime = new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
    await fs.utimes(testFile, atime, mtime)

    // Get original stats
    const originalStats = await fs.stat(testFile)

    // Transfer the file with checksum verification
    const destFile = path.join(destDir, 'test.txt')
    const result = await transferFile(testFile, destFile, { verifyChecksum: true })

    // Verify transfer was successful
    expect(result.success).toBe(true)
    expect(result.checksumVerified).toBe(true)

    // Get destination stats
    const destStats = await fs.stat(destFile)

    // Verify timestamps are preserved
    const timeTolerance = 1000 // 1 second in milliseconds
    expect(Math.abs(destStats.atime.getTime() - originalStats.atime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
    expect(Math.abs(destStats.mtime.getTime() - originalStats.mtime.getTime())).toBeLessThanOrEqual(
      timeTolerance
    )
  })
})
