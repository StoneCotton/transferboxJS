/**
 * ChecksumCalculator Service Tests
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  ChecksumCalculator,
  getChecksumCalculator,
  resetChecksumCalculator
} from '../../../src/main/services/checksumCalculator'

describe('ChecksumCalculator', () => {
  let calculator: ChecksumCalculator
  let tempDir: string
  let testFile: string

  beforeAll(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checksum-test-'))
    testFile = path.join(tempDir, 'test.txt')
    fs.writeFileSync(testFile, 'Hello, World!')
  })

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile)
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir)
    }
  })

  beforeEach(() => {
    resetChecksumCalculator()
    calculator = new ChecksumCalculator()
  })

  describe('createHasher', () => {
    it('should create a hasher that can update and digest', () => {
      const hasher = calculator.createHasher()
      expect(hasher).toBeDefined()
      expect(typeof hasher.update).toBe('function')
      expect(typeof hasher.digest).toBe('function')
    })

    it('should produce consistent checksums for same data', () => {
      const hasher1 = calculator.createHasher()
      const hasher2 = calculator.createHasher()

      const data = Buffer.from('test data')
      hasher1.update(data)
      hasher2.update(data)

      expect(hasher1.digest()).toBe(hasher2.digest())
    })

    it('should produce different checksums for different data', () => {
      const hasher1 = calculator.createHasher()
      const hasher2 = calculator.createHasher()

      hasher1.update(Buffer.from('data1'))
      hasher2.update(Buffer.from('data2'))

      expect(hasher1.digest()).not.toBe(hasher2.digest())
    })

    it('should handle incremental updates', () => {
      const hasher1 = calculator.createHasher()
      const hasher2 = calculator.createHasher()

      // Update hasher1 with full data
      hasher1.update(Buffer.from('Hello, World!'))

      // Update hasher2 incrementally
      hasher2.update(Buffer.from('Hello, '))
      hasher2.update(Buffer.from('World!'))

      expect(hasher1.digest()).toBe(hasher2.digest())
    })
  })

  describe('createHasherPair', () => {
    it('should create two independent hashers', () => {
      const { sourceHasher, destHasher } = calculator.createHasherPair()

      expect(sourceHasher).toBeDefined()
      expect(destHasher).toBeDefined()

      // Update them with different data
      sourceHasher.update(Buffer.from('source'))
      destHasher.update(Buffer.from('dest'))

      expect(sourceHasher.digest()).not.toBe(destHasher.digest())
    })

    it('should produce matching checksums when given same data', () => {
      const { sourceHasher, destHasher } = calculator.createHasherPair()
      const data = Buffer.from('same data')

      sourceHasher.update(data)
      destHasher.update(data)

      expect(sourceHasher.digest()).toBe(destHasher.digest())
    })
  })

  describe('calculateFileChecksum', () => {
    it('should calculate checksum of a file', async () => {
      const checksum = await calculator.calculateFileChecksum(testFile)
      expect(typeof checksum).toBe('string')
      expect(checksum.length).toBeGreaterThan(0)
    })

    it('should produce consistent checksums for same file', async () => {
      const checksum1 = await calculator.calculateFileChecksum(testFile)
      const checksum2 = await calculator.calculateFileChecksum(testFile)
      expect(checksum1).toBe(checksum2)
    })

    it('should match hasher-based checksum', async () => {
      const fileContent = fs.readFileSync(testFile)
      const hasher = calculator.createHasher()
      hasher.update(fileContent)
      const hasherChecksum = hasher.digest()

      const fileChecksum = await calculator.calculateFileChecksum(testFile)
      expect(fileChecksum).toBe(hasherChecksum)
    })

    it('should reject for non-existent file', async () => {
      await expect(calculator.calculateFileChecksum('/non/existent/file.txt')).rejects.toThrow()
    })
  })

  describe('compareChecksums', () => {
    it('should return true for matching checksums', () => {
      expect(calculator.compareChecksums('abc123', 'abc123')).toBe(true)
    })

    it('should return false for different checksums', () => {
      expect(calculator.compareChecksums('abc123', 'def456')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(calculator.compareChecksums('ABC123', 'abc123')).toBe(false)
    })
  })

  describe('verifyIntegrity', () => {
    it('should return true when checksums match', () => {
      const result = {
        sourceChecksum: 'abc123',
        destChecksum: 'abc123'
      }
      expect(calculator.verifyIntegrity(result)).toBe(true)
    })

    it('should return false when checksums differ', () => {
      const result = {
        sourceChecksum: 'abc123',
        destChecksum: 'def456'
      }
      expect(calculator.verifyIntegrity(result)).toBe(false)
    })
  })

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getChecksumCalculator()
      const instance2 = getChecksumCalculator()
      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getChecksumCalculator()
      resetChecksumCalculator()
      const instance2 = getChecksumCalculator()
      expect(instance1).not.toBe(instance2)
    })
  })
})
