/**
 * File Validator Tests
 * Tests for file validation before transfer
 */

import { FileValidator } from '../../../src/main/validators/fileValidator'
import { lstat, access, open } from 'fs/promises'
import type { Stats } from 'fs'
import { TransferErrorType } from '../../../src/shared/types'

jest.mock('fs/promises')

describe('FileValidator', () => {
  let validator: FileValidator

  beforeEach(() => {
    validator = new FileValidator()
    jest.clearAllMocks()
  })

  describe('validate', () => {
    it('should validate regular files successfully', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        size: 1000
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)
      ;(access as jest.Mock).mockResolvedValue(undefined)
      ;(open as jest.Mock).mockResolvedValue({
        read: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue(undefined)
      })

      const result = await validator.validate('/path/to/file.txt')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.stats).toBeDefined()
    })

    it('should reject symlinks by default', async () => {
      const mockStats = {
        isSymbolicLink: () => true
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)

      const result = await validator.validate('/path/to/symlink')

      expect(result.valid).toBe(false)
      expect(result.error?.errorType).toBe(TransferErrorType.SOURCE_NOT_FOUND)
      expect(result.error?.message).toContain('Symlinks')
    })

    it('should allow symlinks when configured', async () => {
      const mockStats = {
        isSymbolicLink: () => true,
        isFile: () => true,
        size: 1000
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)
      ;(access as jest.Mock).mockResolvedValue(undefined)
      ;(open as jest.Mock).mockResolvedValue({
        read: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue(undefined)
      })

      const result = await validator.validate('/path/to/symlink', { allowSymlinks: true })

      expect(result.valid).toBe(true)
    })

    it('should reject special files', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => false,
        isDirectory: () => false,
        isBlockDevice: () => true,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)

      const result = await validator.validate('/dev/sda1')

      expect(result.valid).toBe(false)
      expect(result.error?.message).toContain('block device')
    })

    it('should reject files that are too small', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        size: 0
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)

      const result = await validator.validate('/path/to/empty.txt', {
        checkSize: true,
        minSize: 1
      })

      expect(result.valid).toBe(false)
      expect(result.error?.message).toContain('too small')
    })

    it('should reject files that are too large', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        size: 10000000
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)

      const result = await validator.validate('/path/to/huge.bin', {
        checkSize: true,
        maxSize: 1000000
      })

      expect(result.valid).toBe(false)
      expect(result.error?.message).toContain('too large')
    })

    it('should handle unreadable files', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        size: 1000
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)
      ;(access as jest.Mock).mockRejectedValue({ code: 'EACCES' })

      const result = await validator.validate('/path/to/unreadable.txt')

      expect(result.valid).toBe(false)
      expect(result.error?.errorType).toBe(TransferErrorType.PERMISSION_DENIED)
    })

    it('should detect missing files', async () => {
      ;(lstat as jest.Mock).mockRejectedValue({ code: 'ENOENT' })

      const result = await validator.validate('/path/to/missing.txt')

      expect(result.valid).toBe(false)
      expect(result.error?.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
    })

    it('should skip readability check when disabled', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        size: 1000
      } as unknown as Stats

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)

      const result = await validator.validate('/path/to/file.txt', { checkReadability: false })

      expect(result.valid).toBe(true)
      expect(access).not.toHaveBeenCalled()
    })

    it('should validate file can be read (opens and reads first bytes)', async () => {
      const mockStats = {
        isSymbolicLink: () => false,
        isFile: () => true,
        isDirectory: () => false,
        size: 1000
      } as unknown as Stats

      const mockFd = {
        read: jest.fn().mockResolvedValue({ bytesRead: 100 }),
        close: jest.fn().mockResolvedValue(undefined)
      }

      ;(lstat as jest.Mock).mockResolvedValue(mockStats)
      ;(access as jest.Mock).mockResolvedValue(undefined)
      ;(open as jest.Mock).mockResolvedValue(mockFd)

      const result = await validator.validate('/path/to/file.txt')

      expect(result.valid).toBe(true)
      expect(mockFd.read).toHaveBeenCalled()
      expect(mockFd.close).toHaveBeenCalled()
    })
  })
})
