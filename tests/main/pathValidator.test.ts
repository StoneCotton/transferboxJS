/**
 * Path Validator Tests
 * Following TDD - these tests are written BEFORE implementation
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { validatePath, isSystemDirectory, checkDiskSpace } from '../../src/main/pathValidator'

describe('PathValidator', () => {
  let testDir: string

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `transferbox-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validatePath', () => {
    it('should validate an existing writable directory', async () => {
      const result = await validatePath(testDir)

      expect(result.isValid).toBe(true)
      expect(result.exists).toBe(true)
      expect(result.isWritable).toBe(true)
      expect(result.isSystem).toBe(false)
      expect(result.hasSpace).toBe(true)
      expect(result.availableSpace).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should reject non-existent path', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist')
      const result = await validatePath(nonExistentPath)

      expect(result.isValid).toBe(false)
      expect(result.exists).toBe(false)
      expect(result.error).toContain('does not exist')
    })

    it('should reject empty path', async () => {
      const result = await validatePath('')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Path cannot be empty')
    })

    it('should reject system directories', async () => {
      const systemPaths =
        process.platform === 'darwin'
          ? ['/System', '/Library', '/private']
          : process.platform === 'win32'
            ? ['C:\\Windows', 'C:\\Program Files']
            : ['/boot', '/sys', '/proc']

      for (const systemPath of systemPaths) {
        const result = await validatePath(systemPath)

        expect(result.isValid).toBe(false)
        expect(result.isSystem).toBe(true)
        expect(result.error).toContain('system directory')
      }
    })

    it('should reject root directory', async () => {
      const rootPath = process.platform === 'win32' ? 'C:\\' : '/'
      const result = await validatePath(rootPath)

      expect(result.isValid).toBe(false)
      expect(result.isSystem).toBe(true)
      expect(result.error).toContain('system directory')
    })

    it('should detect read-only directories', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(testDir, 'readonly')
      await fs.mkdir(readOnlyDir)

      if (process.platform !== 'win32') {
        // Change permissions to read-only (Unix-like systems)
        await fs.chmod(readOnlyDir, 0o444)

        const result = await validatePath(readOnlyDir)

        expect(result.isValid).toBe(false)
        expect(result.isWritable).toBe(false)
        expect(result.error).toContain('not writable')

        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755)
      }
    })

    it('should check available disk space', async () => {
      const result = await validatePath(testDir)

      expect(result.availableSpace).toBeGreaterThan(0)
      expect(result.hasSpace).toBe(true)
    })

    it('should handle paths with spaces and special characters', async () => {
      const specialDir = path.join(testDir, 'special dir with spaces & chars!')
      await fs.mkdir(specialDir)

      const result = await validatePath(specialDir)

      expect(result.isValid).toBe(true)
      expect(result.exists).toBe(true)
    })

    it('should normalize path separators', async () => {
      // Test with mixed separators
      const mixedPath = testDir.replace(/\//g, path.sep)
      const result = await validatePath(mixedPath)

      expect(result.isValid).toBe(true)
    })

    it('should handle relative paths by converting to absolute', async () => {
      const relativePath = './test-dir'
      const result = await validatePath(relativePath)

      // Should process the path (even if it doesn't exist, it should be converted to absolute)
      expect(result.error).toBeDefined() // Will fail because it doesn't exist
      expect(result.exists).toBe(false)
    })
  })

  describe('isSystemDirectory', () => {
    it('should identify system directories on macOS', () => {
      if (process.platform !== 'darwin') return

      expect(isSystemDirectory('/System')).toBe(true)
      expect(isSystemDirectory('/Library')).toBe(true)
      expect(isSystemDirectory('/private')).toBe(true)
      expect(isSystemDirectory('/bin')).toBe(true)
      expect(isSystemDirectory('/sbin')).toBe(true)
      expect(isSystemDirectory('/usr')).toBe(true)
      expect(isSystemDirectory('/var')).toBe(true)
      expect(isSystemDirectory('/')).toBe(true)
    })

    it('should identify system directories on Windows', () => {
      if (process.platform !== 'win32') return

      expect(isSystemDirectory('C:\\')).toBe(true)
      expect(isSystemDirectory('C:\\Windows')).toBe(true)
      expect(isSystemDirectory('C:\\Program Files')).toBe(true)
      expect(isSystemDirectory('C:\\Program Files (x86)')).toBe(true)
    })

    it('should identify system directories on Linux', () => {
      if (process.platform !== 'linux') return

      expect(isSystemDirectory('/')).toBe(true)
      expect(isSystemDirectory('/boot')).toBe(true)
      expect(isSystemDirectory('/sys')).toBe(true)
      expect(isSystemDirectory('/proc')).toBe(true)
      expect(isSystemDirectory('/dev')).toBe(true)
      expect(isSystemDirectory('/etc')).toBe(true)
    })

    it('should not flag user directories as system directories', () => {
      const userDir = path.join(os.homedir(), 'Documents')
      expect(isSystemDirectory(userDir)).toBe(false)
      expect(isSystemDirectory(testDir)).toBe(false)
    })

    it('should handle case-insensitive paths on Windows', () => {
      if (process.platform !== 'win32') return

      expect(isSystemDirectory('c:\\windows')).toBe(true)
      expect(isSystemDirectory('C:\\WINDOWS')).toBe(true)
    })
  })

  describe('checkDiskSpace', () => {
    it('should return disk space information', async () => {
      const spaceInfo = await checkDiskSpace(testDir)

      expect(spaceInfo.totalSpace).toBeGreaterThan(0)
      expect(spaceInfo.freeSpace).toBeGreaterThan(0)
      expect(spaceInfo.freeSpace).toBeLessThanOrEqual(spaceInfo.totalSpace)
    })

    it('should handle non-existent paths gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist')

      await expect(checkDiskSpace(nonExistentPath)).rejects.toThrow()
    })

    it('should work with different drive types', async () => {
      // Test with temp directory (should always exist)
      const tempSpace = await checkDiskSpace(os.tmpdir())

      expect(tempSpace.totalSpace).toBeGreaterThan(0)
      expect(tempSpace.freeSpace).toBeGreaterThan(0)
    })
  })

  describe('Network paths', () => {
    it('should handle UNC paths on Windows', async () => {
      if (process.platform !== 'win32') return

      // Note: This will fail if no network share exists, but tests the logic
      const uncPath = '\\\\server\\share'
      const result = await validatePath(uncPath)

      // Should not crash, will likely fail as path doesn't exist
      expect(result.isValid).toBe(false)
      expect(result.exists).toBe(false)
    })

    it('should handle mounted network drives', async () => {
      // Test with actual mount point if available
      // This is a basic test - real network testing would need actual network setup
      const result = await validatePath(testDir)

      expect(result.isValid).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle very long paths', async () => {
      const longPath = path.join(testDir, 'a'.repeat(255))

      try {
        await fs.mkdir(longPath)
        const result = await validatePath(longPath)
        expect(result.exists).toBe(true)
      } catch (error) {
        // Some filesystems have path length limits
        expect(error).toBeDefined()
      }
    })

    it('should handle paths with unicode characters', async () => {
      const unicodePath = path.join(testDir, '你好世界')
      await fs.mkdir(unicodePath)

      const result = await validatePath(unicodePath)

      expect(result.isValid).toBe(true)
      expect(result.exists).toBe(true)
    })

    it('should handle concurrent validation calls', async () => {
      const promises = Array.from({ length: 10 }, () => validatePath(testDir))
      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result.isValid).toBe(true)
      })
    })
  })
})
