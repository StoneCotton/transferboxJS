/**
 * IPC Validator Tests
 * Tests for input validation utilities
 */

import {
  validateFilePath,
  validateFilePaths,
  validateDeviceId,
  validateTransferStartRequest,
  validatePathValidationRequest,
  validateSessionId,
  validateLimit,
  validateLogLevel
} from '../../../src/main/utils/ipcValidator'

describe('IPC Validator', () => {
  describe('validateDeviceId', () => {
    describe('macOS/Linux device paths', () => {
      it('should accept valid Unix device paths', () => {
        const validPaths = [
          '/dev/disk2',
          '/dev/disk2s1',
          '/dev/sda',
          '/dev/sda1',
          '/dev/mmcblk0',
          '/dev/mmcblk0p1'
        ]

        validPaths.forEach((devicePath) => {
          expect(() => validateDeviceId(devicePath)).not.toThrow()
          expect(validateDeviceId(devicePath)).toBe(devicePath)
        })
      })

      it('should trim whitespace from Unix device paths', () => {
        expect(validateDeviceId('  /dev/disk2  ')).toBe('/dev/disk2')
      })
    })

    describe('Windows drive letters', () => {
      it('should accept valid Windows drive letters', () => {
        const validDrives = ['C:', 'D:', 'E:', 'F:', 'Z:']

        validDrives.forEach((drive) => {
          expect(() => validateDeviceId(drive)).not.toThrow()
          expect(validateDeviceId(drive)).toBe(drive)
        })
      })

      it('should accept Windows drive letters with backslashes', () => {
        const drives = ['C:\\', 'D:\\', 'E:\\']

        drives.forEach((drive) => {
          expect(() => validateDeviceId(drive)).not.toThrow()
        })
      })
    })

    describe('invalid device IDs', () => {
      it('should reject empty strings', () => {
        expect(() => validateDeviceId('')).toThrow('Device ID must be a non-empty string')
        expect(() => validateDeviceId('   ')).toThrow('Device ID must be a non-empty string')
      })

      it('should reject non-string values', () => {
        expect(() => validateDeviceId(null)).toThrow('Device ID must be a non-empty string')
        expect(() => validateDeviceId(undefined)).toThrow('Device ID must be a non-empty string')
        expect(() => validateDeviceId(123)).toThrow('Device ID must be a non-empty string')
      })

      it('should reject control characters', () => {
        expect(() => validateDeviceId('/dev/disk\x00')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/disk\x1f')).toThrow('Device ID contains invalid characters')
      })

      it('should reject path traversal attempts', () => {
        expect(() => validateDeviceId('../etc/passwd')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/../etc/passwd')).toThrow('Device ID contains invalid characters')
      })

      it('should reject wildcard characters', () => {
        expect(() => validateDeviceId('/dev/disk*')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/disk?')).toThrow('Device ID contains invalid characters')
      })

      it('should reject shell metacharacters', () => {
        expect(() => validateDeviceId('/dev/disk;ls')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/disk|cat')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/disk`whoami`')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('/dev/disk$(whoami)')).toThrow('Device ID contains invalid characters')
      })

      it('should reject excessively long device IDs', () => {
        const longDevice = 'A'.repeat(513)
        expect(() => validateDeviceId(longDevice)).toThrow('Device ID exceeds maximum length')
      })

      it('should reject pipe and redirect characters', () => {
        expect(() => validateDeviceId('C:|dir')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('C:>file')).toThrow('Device ID contains invalid characters')
        expect(() => validateDeviceId('C:<file')).toThrow('Device ID contains invalid characters')
      })
    })
  })

  describe('validateFilePath', () => {
    it('should accept valid absolute paths', () => {
      const path = '/Users/test/Documents'
      expect(validateFilePath(path)).toBe(path)
    })

    it('should reject empty paths', () => {
      expect(() => validateFilePath('')).toThrow('File path must be a non-empty string')
    })

    it('should reject path traversal', () => {
      expect(() => validateFilePath('/Users/../etc/passwd')).toThrow('path traversal not allowed')
    })

    it('should reject relative paths by default', () => {
      expect(() => validateFilePath('relative/path')).toThrow('File path must be absolute')
    })

    it('should accept relative paths when allowed', () => {
      expect(() => validateFilePath('relative/path', true)).not.toThrow()
    })

    it('should reject excessively long paths', () => {
      const longPath = '/' + 'a'.repeat(4097)
      expect(() => validateFilePath(longPath)).toThrow('File path exceeds maximum length')
    })
  })

  describe('validateFilePaths', () => {
    it('should validate array of file paths', () => {
      const paths = ['/path/one', '/path/two']
      expect(validateFilePaths(paths)).toEqual(paths)
    })

    it('should reject non-arrays', () => {
      expect(() => validateFilePaths('not an array' as any)).toThrow('Files must be an array')
    })

    it('should reject empty arrays', () => {
      expect(() => validateFilePaths([])).toThrow('Files array cannot be empty')
    })

    it('should reject arrays with too many items', () => {
      const largePaths = Array(100001).fill('/path')
      expect(() => validateFilePaths(largePaths)).toThrow('Too many files in transfer request')
    })

    it('should reject invalid path in array', () => {
      const paths = ['/valid/path', '../../../etc/passwd']
      expect(() => validateFilePaths(paths)).toThrow('path traversal not allowed')
    })
  })

  describe('validateSessionId', () => {
    it('should accept valid session IDs', () => {
      const validIds = [
        'session_1234567890_abc123',
        'session_9876543210_xyz789',
        'session_1111111111_AAA111'
      ]

      validIds.forEach((id) => {
        expect(validateSessionId(id)).toBe(id)
      })
    })

    it('should reject invalid session ID formats', () => {
      expect(() => validateSessionId('invalid')).toThrow('Invalid session ID format')
      expect(() => validateSessionId('session_abc_123')).toThrow('Invalid session ID format')
    })

    it('should reject empty session IDs', () => {
      expect(() => validateSessionId('')).toThrow('Session ID must be a non-empty string')
    })

    it('should reject excessively long session IDs', () => {
      const longId = 'session_1234567890_' + 'a'.repeat(200)
      expect(() => validateSessionId(longId)).toThrow('Session ID exceeds maximum length')
    })
  })

  describe('validateLimit', () => {
    it('should accept valid limits', () => {
      expect(validateLimit(10)).toBe(10)
      expect(validateLimit(100)).toBe(100)
      expect(validateLimit(1000)).toBe(1000)
    })

    it('should return default for undefined', () => {
      expect(validateLimit(undefined)).toBe(10000)
      expect(validateLimit(undefined, 500)).toBe(500)
    })

    it('should reject non-integers', () => {
      expect(() => validateLimit(10.5)).toThrow('Limit must be an integer')
    })

    it('should reject negative numbers', () => {
      expect(() => validateLimit(-1)).toThrow('Limit must be an integer between')
    })

    it('should reject limits exceeding max', () => {
      expect(() => validateLimit(10001)).toThrow('Limit must be an integer between')
      expect(() => validateLimit(501, 500)).toThrow('Limit must be an integer between')
    })
  })

  describe('validateLogLevel', () => {
    it('should accept valid log levels', () => {
      expect(validateLogLevel('debug')).toBe('debug')
      expect(validateLogLevel('info')).toBe('info')
      expect(validateLogLevel('warn')).toBe('warn')
      expect(validateLogLevel('error')).toBe('error')
    })

    it('should reject invalid log levels', () => {
      expect(() => validateLogLevel('invalid')).toThrow('Invalid log level')
    })

    it('should reject non-string values', () => {
      expect(() => validateLogLevel(123 as any)).toThrow('Log level must be a string')
    })
  })

  describe('validateTransferStartRequest', () => {
    const validRequest = {
      sourceRoot: '/source/path',
      destinationRoot: '/dest/path',
      driveInfo: {
        device: '/dev/disk2',
        displayName: 'Test Drive'
      },
      files: ['/source/path/file1.mp4', '/source/path/file2.jpg']
    }

    it('should validate a valid request', () => {
      const result = validateTransferStartRequest(validRequest)
      expect(result.sourceRoot).toBe('/source/path')
      expect(result.destinationRoot).toBe('/dest/path')
      expect(result.driveInfo.device).toBe('/dev/disk2')
      expect(result.files).toHaveLength(2)
    })

    it('should reject non-object requests', () => {
      expect(() => validateTransferStartRequest('invalid')).toThrow('Transfer request must be an object')
    })

    it('should reject missing fields', () => {
      expect(() =>
        validateTransferStartRequest({
          sourceRoot: '/source/path'
        })
      ).toThrow()
    })

    it('should reject invalid device in driveInfo', () => {
      expect(() =>
        validateTransferStartRequest({
          ...validRequest,
          driveInfo: { device: '../../../etc/passwd', displayName: 'Hack' }
        })
      ).toThrow('Device ID contains invalid characters')
    })
  })

  describe('validatePathValidationRequest', () => {
    it('should validate a valid path request', () => {
      const result = validatePathValidationRequest({ path: '/some/path' })
      expect(result).toBe('/some/path')
    })

    it('should reject non-object requests', () => {
      expect(() => validatePathValidationRequest('invalid')).toThrow(
        'Path validation request must be an object'
      )
    })

    it('should reject missing path field', () => {
      expect(() => validatePathValidationRequest({})).toThrow('path must be a string')
    })
  })
})

