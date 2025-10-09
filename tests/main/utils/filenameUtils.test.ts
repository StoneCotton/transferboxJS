/**
 * Filename Utils Tests
 * Tests for filename sanitization and conflict resolution
 */

import { FilenameUtils } from '../../../src/main/utils/filenameUtils'
import { access } from 'fs/promises'

jest.mock('fs/promises')

describe('FilenameUtils', () => {
  let utils: FilenameUtils

  beforeEach(() => {
    utils = new FilenameUtils()
    jest.clearAllMocks()
  })

  describe('sanitize', () => {
    describe('Windows platform', () => {
      it('should replace forbidden characters', () => {
        const result = utils.sanitize('file<>:"|?*.txt', { platform: 'win32' })
        expect(result).toBe('file_______.txt') // Each forbidden char replaced with _
      })

      it('should handle Windows reserved names', () => {
        const result = utils.sanitize('con.txt', { platform: 'win32' })
        expect(result).toBe('_con.txt')
      })

      it('should handle reserved names with extensions', () => {
        const result = utils.sanitize('aux.log', { platform: 'win32' })
        expect(result).toBe('_aux.log')
      })

      it('should remove trailing dots and spaces', () => {
        const result = utils.sanitize('file.. ', { platform: 'win32' })
        expect(result).toBe('file')
      })

      it('should handle multiple reserved names', () => {
        expect(utils.sanitize('prn', { platform: 'win32' })).toBe('_prn')
        expect(utils.sanitize('com1', { platform: 'win32' })).toBe('_com1')
        expect(utils.sanitize('lpt9.txt', { platform: 'win32' })).toBe('_lpt9.txt')
      })
    })

    describe('Unix platform', () => {
      it('should replace forward slashes', () => {
        const result = utils.sanitize('path/to/file.txt', { platform: 'linux' })
        expect(result).toBe('path_to_file.txt')
      })

      it('should remove control characters', () => {
        const result = utils.sanitize('file\x00\x01\x1f.txt', { platform: 'linux' })
        expect(result).toBe('file_.txt') // \x00 becomes _, others are removed
      })

      it('should keep valid characters', () => {
        const result = utils.sanitize('valid-filename_123.txt', { platform: 'linux' })
        expect(result).toBe('valid-filename_123.txt')
      })
    })

    describe('Length limits', () => {
      it('should truncate long filenames while preserving extension', () => {
        const longName = 'a'.repeat(300) + '.txt'
        const result = utils.sanitize(longName, { maxLength: 255 })

        expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(255)
        expect(result).toMatch(/\.txt$/)
      })

      it('should handle unicode characters in length calculation', () => {
        const unicodeName = '文'.repeat(100) + '.txt'
        const result = utils.sanitize(unicodeName, { maxLength: 255 })

        expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(255)
      })
    })

    describe('Edge cases', () => {
      it('should handle empty filenames', () => {
        const result = utils.sanitize('', { platform: 'win32' })
        expect(result).toBe('unnamed_file')
      })

      it('should handle filenames with only spaces', () => {
        const result = utils.sanitize('   ', { platform: 'win32' })
        expect(result).toBe('unnamed_file')
      })

      it('should use custom replacement character', () => {
        const result = utils.sanitize('file:name.txt', { platform: 'win32', replacement: '-' })
        expect(result).toBe('file-name.txt')
      })
    })
  })

  describe('resolveConflict', () => {
    describe('overwrite strategy', () => {
      it('should allow overwrite when file exists', async () => {
        ;(access as jest.Mock).mockResolvedValue(undefined)

        const result = await utils.resolveConflict('/path/file.txt', { strategy: 'overwrite' })

        expect(result.action).toBe('write')
        expect(result.path).toBe('/path/file.txt')
      })
    })

    describe('skip strategy', () => {
      it('should skip when file exists', async () => {
        ;(access as jest.Mock).mockResolvedValue(undefined)

        const result = await utils.resolveConflict('/path/file.txt', { strategy: 'skip' })

        expect(result.action).toBe('skip')
        expect(result.path).toBe('/path/file.txt')
      })
    })

    describe('rename strategy', () => {
      it('should generate unique name when file exists', async () => {
        ;(access as jest.Mock)
          .mockResolvedValueOnce(undefined) // Original exists
          .mockResolvedValueOnce(undefined) // _1 exists
          .mockResolvedValueOnce(undefined) // _2 exists
          .mockRejectedValueOnce({ code: 'ENOENT' }) // _3 doesn't exist

        const result = await utils.resolveConflict('/path/file.txt', { strategy: 'rename' })

        expect(result.action).toBe('write')
        expect(result.path).toBe('/path/file_3.txt')
      })

      it('should not rename when file does not exist', async () => {
        ;(access as jest.Mock).mockRejectedValue({ code: 'ENOENT' })

        const result = await utils.resolveConflict('/path/file.txt', { strategy: 'rename' })

        expect(result.action).toBe('write')
        expect(result.path).toBe('/path/file.txt')
      })
    })

    describe('rename-timestamp strategy', () => {
      it('should add timestamp to filename', async () => {
        ;(access as jest.Mock).mockResolvedValue(undefined)

        const result = await utils.resolveConflict('/path/file.txt', {
          strategy: 'rename-timestamp'
        })

        expect(result.action).toBe('write')
        expect(result.path).toMatch(/\/path\/file_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt/)
      })
    })

    describe('error strategy', () => {
      it('should throw when file exists', async () => {
        ;(access as jest.Mock).mockResolvedValue(undefined)

        await expect(
          utils.resolveConflict('/path/file.txt', { strategy: 'error' })
        ).rejects.toThrow('File already exists: /path/file.txt')
      })
    })
  })
})
