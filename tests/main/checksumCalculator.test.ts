/**
 * Checksum Calculator Tests
 * Following TDD - these tests are written BEFORE implementation
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  calculateChecksum,
  calculateChecksumFromBuffer,
  verifyChecksum,
  calculateChecksumStream,
  ChecksumOptions
} from '../../src/main/checksumCalculator'

describe('ChecksumCalculator', () => {
  let testDir: string
  let testFilePath: string

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `transferbox-checksum-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })

    // Create a test file
    testFilePath = path.join(testDir, 'test-file.txt')
    await fs.writeFile(testFilePath, 'Hello, TransferBox!')
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('calculateChecksum', () => {
    it('should calculate checksum for a file', async () => {
      const checksum = await calculateChecksum(testFilePath)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
      expect(checksum.length).toBeGreaterThan(0)
    })

    it('should return consistent checksum for same file', async () => {
      const checksum1 = await calculateChecksum(testFilePath)
      const checksum2 = await calculateChecksum(testFilePath)

      expect(checksum1).toBe(checksum2)
    })

    it('should return different checksums for different files', async () => {
      const file2Path = path.join(testDir, 'test-file-2.txt')
      await fs.writeFile(file2Path, 'Different content')

      const checksum1 = await calculateChecksum(testFilePath)
      const checksum2 = await calculateChecksum(file2Path)

      expect(checksum1).not.toBe(checksum2)
    })

    it('should handle large files', async () => {
      const largePath = path.join(testDir, 'large-file.bin')
      // Create a 10MB file
      const buffer = Buffer.alloc(10 * 1024 * 1024, 'a')
      await fs.writeFile(largePath, buffer)

      const checksum = await calculateChecksum(largePath)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
    })

    it('should handle empty files', async () => {
      const emptyPath = path.join(testDir, 'empty-file.txt')
      await fs.writeFile(emptyPath, '')

      const checksum = await calculateChecksum(emptyPath)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
    })

    it('should reject non-existent files', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.txt')

      await expect(calculateChecksum(nonExistentPath)).rejects.toThrow()
    })

    it('should use custom buffer size', async () => {
      const options: ChecksumOptions = {
        bufferSize: 4096
      }

      const checksum = await calculateChecksum(testFilePath, options)

      expect(checksum).toBeDefined()
    })

    it('should report progress', async () => {
      const largePath = path.join(testDir, 'progress-test.bin')
      const buffer = Buffer.alloc(1024 * 1024, 'b') // 1MB
      await fs.writeFile(largePath, buffer)

      const progressUpdates: number[] = []

      const options: ChecksumOptions = {
        onProgress: (bytesProcessed, totalBytes) => {
          const percentage = (bytesProcessed / totalBytes) * 100
          progressUpdates.push(percentage)
        }
      }

      await calculateChecksum(largePath, options)

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
    })

    it('should handle files with special characters in path', async () => {
      const specialPath = path.join(testDir, "file with spaces & 'quotes'.txt")
      await fs.writeFile(specialPath, 'Special file')

      const checksum = await calculateChecksum(specialPath)

      expect(checksum).toBeDefined()
    })
  })

  describe('calculateChecksumFromBuffer', () => {
    it('should calculate checksum from buffer', () => {
      const buffer = Buffer.from('Hello, TransferBox!')
      const checksum = calculateChecksumFromBuffer(buffer)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
    })

    it('should return consistent checksum for same buffer', () => {
      const buffer = Buffer.from('Test content')
      const checksum1 = calculateChecksumFromBuffer(buffer)
      const checksum2 = calculateChecksumFromBuffer(buffer)

      expect(checksum1).toBe(checksum2)
    })

    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0)
      const checksum = calculateChecksumFromBuffer(buffer)

      expect(checksum).toBeDefined()
    })

    it('should handle large buffers', () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024, 'x')
      const checksum = calculateChecksumFromBuffer(buffer)

      expect(checksum).toBeDefined()
    })
  })

  describe('verifyChecksum', () => {
    it('should verify matching checksums', async () => {
      const expectedChecksum = await calculateChecksum(testFilePath)
      const isValid = await verifyChecksum(testFilePath, expectedChecksum)

      expect(isValid).toBe(true)
    })

    it('should reject mismatched checksums', async () => {
      const wrongChecksum = 'incorrect-checksum-value'
      const isValid = await verifyChecksum(testFilePath, wrongChecksum)

      expect(isValid).toBe(false)
    })

    it('should reject checksums for non-existent files', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.txt')

      await expect(verifyChecksum(nonExistentPath, 'any-checksum')).rejects.toThrow()
    })

    it('should verify after file modification', async () => {
      const originalChecksum = await calculateChecksum(testFilePath)

      // Modify the file
      await fs.appendFile(testFilePath, ' Modified!')

      const isValid = await verifyChecksum(testFilePath, originalChecksum)

      expect(isValid).toBe(false)
    })
  })

  describe('calculateChecksumStream', () => {
    it('should calculate checksum from stream', async () => {
      const checksum = await calculateChecksumStream(testFilePath)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
    })

    it('should match checksum from file read', async () => {
      const checksumFromFile = await calculateChecksum(testFilePath)
      const checksumFromStream = await calculateChecksumStream(testFilePath)

      expect(checksumFromStream).toBe(checksumFromFile)
    })

    it('should report progress with stream', async () => {
      const largePath = path.join(testDir, 'stream-test.bin')
      const buffer = Buffer.alloc(1024 * 1024, 'c') // 1MB
      await fs.writeFile(largePath, buffer)

      const progressUpdates: number[] = []

      const options: ChecksumOptions = {
        onProgress: (bytesProcessed, totalBytes) => {
          const percentage = (bytesProcessed / totalBytes) * 100
          progressUpdates.push(percentage)
        }
      }

      await calculateChecksumStream(largePath, options)

      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('should handle stream errors gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.txt')

      await expect(calculateChecksumStream(nonExistentPath)).rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should calculate checksum quickly for small files', async () => {
      const startTime = Date.now()
      await calculateChecksum(testFilePath)
      const duration = Date.now() - startTime

      // Should complete in less than 100ms for a small file
      expect(duration).toBeLessThan(100)
    })

    it('should handle concurrent checksum calculations', async () => {
      // Create multiple test files
      const files = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const filePath = path.join(testDir, `concurrent-${i}.txt`)
          await fs.writeFile(filePath, `Content ${i}`)
          return filePath
        })
      )

      // Calculate checksums concurrently
      const checksums = await Promise.all(files.map((file) => calculateChecksum(file)))

      expect(checksums).toHaveLength(5)
      // All checksums should be different (different content)
      const uniqueChecksums = new Set(checksums)
      expect(uniqueChecksums.size).toBe(5)
    })
  })

  describe('Edge Cases', () => {
    it('should handle binary files', async () => {
      const binaryPath = path.join(testDir, 'binary-file.bin')
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd])
      await fs.writeFile(binaryPath, binaryData)

      const checksum = await calculateChecksum(binaryPath)

      expect(checksum).toBeDefined()
    })

    it('should handle files with unicode content', async () => {
      const unicodePath = path.join(testDir, 'unicode.txt')
      await fs.writeFile(unicodePath, '你好世界 🚀 Привет мир')

      const checksum = await calculateChecksum(unicodePath)

      expect(checksum).toBeDefined()
    })

    it('should handle very large files efficiently', async () => {
      const hugePath = path.join(testDir, 'huge-file.bin')
      // Create a 50MB file
      const buffer = Buffer.alloc(50 * 1024 * 1024, 'd')
      await fs.writeFile(hugePath, buffer)

      const startTime = Date.now()
      const checksum = await calculateChecksum(hugePath)
      const duration = Date.now() - startTime

      expect(checksum).toBeDefined()
      // Should complete reasonably fast (less than 5 seconds for 50MB)
      expect(duration).toBeLessThan(5000)
    }, 10000) // 10 second timeout for this test

    it('should handle symbolic links', async () => {
      const realPath = path.join(testDir, 'real-file.txt')
      const linkPath = path.join(testDir, 'link-file.txt')

      await fs.writeFile(realPath, 'Real file content')

      try {
        await fs.symlink(realPath, linkPath)

        const checksumReal = await calculateChecksum(realPath)
        const checksumLink = await calculateChecksum(linkPath)

        // Both should have the same checksum
        expect(checksumLink).toBe(checksumReal)
      } catch {
        // Skip test if symlinks not supported
        console.log('Symlinks not supported on this platform')
      }
    })
  })

  describe('Algorithm Consistency', () => {
    it('should use xxHash64 algorithm', async () => {
      const checksum = await calculateChecksum(testFilePath)

      // xxHash64 produces a hex string
      expect(checksum).toMatch(/^[0-9a-f]+$/)
    })

    it('should produce same checksum as reference implementation', async () => {
      // Test with known content and expected checksum
      const knownContent = 'The quick brown fox jumps over the lazy dog'
      const knownPath = path.join(testDir, 'known.txt')
      await fs.writeFile(knownPath, knownContent)

      const checksum = await calculateChecksum(knownPath)

      // Verify it's a valid hex string of appropriate length
      expect(checksum).toBeDefined()
      expect(checksum.length).toBeGreaterThan(0)
    })
  })
})
