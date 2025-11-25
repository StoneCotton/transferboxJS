/**
 * Tests for File Size Utilities
 */

import {
  safeAdd,
  safeSum,
  validateFileSize,
  formatFileSize,
  MAX_SAFE_FILE_SIZE
} from '../../../src/main/utils/fileSizeUtils'

describe('FileSizeUtils', () => {
  describe('safeAdd', () => {
    it('should add two numbers safely', () => {
      expect(safeAdd(100, 200)).toBe(300)
      expect(safeAdd(0, 0)).toBe(0)
      expect(safeAdd(1000000, 2000000)).toBe(3000000)
    })

    it('should handle large but safe numbers', () => {
      const large = Number.MAX_SAFE_INTEGER - 1000
      expect(safeAdd(large, 500)).toBe(large + 500)
    })

    it('should throw on overflow', () => {
      const large = Number.MAX_SAFE_INTEGER
      expect(() => safeAdd(large, 1)).toThrow(/overflow/)
    })

    it('should throw if input is unsafe integer', () => {
      const unsafe = Number.MAX_SAFE_INTEGER + 1
      expect(() => safeAdd(unsafe, 1)).toThrow(/exceeds maximum safe integer/)
    })

    it('should handle zero additions', () => {
      expect(safeAdd(0, 0)).toBe(0)
      expect(safeAdd(100, 0)).toBe(100)
      expect(safeAdd(0, 100)).toBe(100)
    })
  })

  describe('safeSum', () => {
    it('should sum array of numbers', () => {
      expect(safeSum([10, 20, 30])).toBe(60)
      expect(safeSum([])).toBe(0)
      expect(safeSum([100])).toBe(100)
    })

    it('should handle large arrays', () => {
      const arr = Array(1000).fill(1000000)
      expect(safeSum(arr)).toBe(1000000000)
    })

    it('should throw on overflow in sum', () => {
      const large = Math.floor(Number.MAX_SAFE_INTEGER / 2)
      expect(() => safeSum([large, large, large])).toThrow(/overflow/)
    })
  })

  describe('validateFileSize', () => {
    it('should validate correct file sizes', () => {
      expect(validateFileSize(0, 'test')).toBe(0)
      expect(validateFileSize(1024, 'test')).toBe(1024)
      expect(validateFileSize(Number.MAX_SAFE_INTEGER, 'test')).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should throw on non-number', () => {
      expect(() => validateFileSize('100' as any, 'test')).toThrow(/expected number/)
    })

    it('should throw on negative size', () => {
      expect(() => validateFileSize(-1, 'test')).toThrow(/negative value/)
    })

    it('should throw on unsafe integer', () => {
      const unsafe = Number.MAX_SAFE_INTEGER + 1
      expect(() => validateFileSize(unsafe, 'test')).toThrow(/exceeds maximum safe integer/)
    })

    it('should use context in error messages', () => {
      expect(() => validateFileSize(-1, 'my_field')).toThrow(/my_field/)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0.00 B')
      expect(formatFileSize(500)).toBe('500.00 B')
      expect(formatFileSize(1023)).toBe('1023.00 B')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB')
      expect(formatFileSize(1536)).toBe('1.50 KB')
      expect(formatFileSize(2048)).toBe('2.00 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
      expect(formatFileSize(1024 * 1024 * 5)).toBe('5.00 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.50 GB')
    })

    it('should format terabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB')
    })

    it('should format petabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1.00 PB')
    })

    it('should handle unsafe integers gracefully', () => {
      const unsafe = Number.MAX_SAFE_INTEGER + 1000
      const result = formatFileSize(unsafe)
      expect(result).toContain('PB')
      expect(result).toContain('precision limited')
    })
  })

  describe('MAX_SAFE_FILE_SIZE', () => {
    it('should equal Number.MAX_SAFE_INTEGER', () => {
      expect(MAX_SAFE_FILE_SIZE).toBe(Number.MAX_SAFE_INTEGER)
      expect(MAX_SAFE_FILE_SIZE).toBe(9007199254740991)
    })
  })
})
