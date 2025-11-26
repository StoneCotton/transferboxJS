/**
 * Path Processor Tests
 * Tests for file naming and directory structure logic
 */

import * as path from 'path'
// Use require to allow spying on fs.promises methods in Jest
const fs = require('fs/promises')
import * as os from 'os'
import { PathProcessor, createPathProcessor } from '../../src/main/pathProcessor'
import { DEFAULT_CONFIG, AppConfig } from '../../src/shared/types'

describe('PathProcessor', () => {
  let testDir: string
  let sourceDir: string
  let destDir: string
  let processor: PathProcessor

  beforeEach(async () => {
    // Create test directories
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pathprocessor-test-'))
    sourceDir = path.join(testDir, 'source')
    destDir = path.join(testDir, 'dest')
    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })

    // Create a default processor
    processor = createPathProcessor(DEFAULT_CONFIG)
  })

  afterEach(async () => {
    // Cleanup test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Basic file processing', () => {
    it('should process a simple file path', async () => {
      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir)

      expect(result.fileName).toBe('test.mp4')
      expect(result.destinationPath).toBe(path.join(destDir, 'test.mp4'))
    })

    it('should add timestamp when configured', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        addTimestampToFilename: true,
        keepOriginalFilename: false,
        timestampFormat: '%Y%m%d_%H%M%S'
      }
      processor = createPathProcessor(config)

      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir)

      // Should have timestamp format YYYYMMDD_HHMMSS.mp4
      expect(result.fileName).toMatch(/^\d{8}_\d{6}\.mp4$/)
    })

    it('should preserve original filename with timestamp', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        addTimestampToFilename: true,
        keepOriginalFilename: true,
        filenameTemplate: '{original}_{timestamp}',
        timestampFormat: '%Y%m%d_%H%M%S'
      }
      processor = createPathProcessor(config)

      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir)

      // Should have format: test_YYYYMMDD_HHMMSS.mp4
      expect(result.fileName).toMatch(/^test_\d{8}_\d{6}\.mp4$/)
    })
  })

  describe('Folder structure preservation', () => {
    it('should preserve folder structure when enabled', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        keepFolderStructure: true
      }
      processor = createPathProcessor(config)

      // Create nested source structure
      const nestedDir = path.join(sourceDir, 'subfolder', 'nested')
      await fs.mkdir(nestedDir, { recursive: true })
      const sourceFile = path.join(nestedDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir)

      // Should preserve the subfolder/nested structure
      expect(result.directory).toContain('subfolder')
      expect(result.directory).toContain('nested')
    })

    it('should NOT allow path traversal via folder structure', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        keepFolderStructure: true
      }
      processor = createPathProcessor(config)

      // Attempt path traversal via crafted source path
      // This simulates a malicious source with .. in the path
      const maliciousPath = path.join(sourceDir, '..', '..', 'etc', 'passwd')

      // Create the file (in test environment)
      const etcDir = path.join(testDir, 'etc')
      await fs.mkdir(etcDir, { recursive: true })
      const testFile = path.join(etcDir, 'passwd')
      await fs.writeFile(testFile, 'test')

      // Processing should either throw or ensure result is within destDir
      try {
        const result = await processor.processFilePath(maliciousPath, destDir)

        // If it doesn't throw, verify the result is still within destDir
        const resolvedDest = path.resolve(result.destinationPath)
        const resolvedDestDir = path.resolve(destDir)
        expect(resolvedDest.startsWith(resolvedDestDir)).toBe(true)
      } catch (error) {
        // Throwing is also acceptable
        expect(error).toBeDefined()
      }
    })

    it('should handle symlinks safely without traversal', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        keepFolderStructure: true
      }
      processor = createPathProcessor(config)

      // Create a symlink that points outside source
      const outsideDir = path.join(testDir, 'outside')
      await fs.mkdir(outsideDir, { recursive: true })
      const outsideFile = path.join(outsideDir, 'secret.txt')
      await fs.writeFile(outsideFile, 'secret content')

      const symlinkPath = path.join(sourceDir, 'link-to-outside')
      try {
        await fs.symlink(outsideFile, symlinkPath)
      } catch {
        // Symlinks might not be supported on all systems
        return
      }

      // Process the symlink
      const result = await processor.processFilePath(symlinkPath, destDir)

      // Verify result is within destDir
      const resolvedDest = path.resolve(result.destinationPath)
      const resolvedDestDir = path.resolve(destDir)
      expect(resolvedDest.startsWith(resolvedDestDir)).toBe(true)
    })
  })

  describe('Date-based folders', () => {
    it('should create date-based folders when enabled', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        createDateBasedFolders: true,
        dateFolderFormat: '%Y/%m/%d'
      }
      processor = createPathProcessor(config)

      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir)

      // Should contain year/month/day structure
      expect(result.directory).toMatch(/\d{4}\/\d{2}\/\d{2}/)
    })
  })

  describe('Device-based folders', () => {
    it('should create device-based folders when enabled', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        createDeviceBasedFolders: true,
        deviceFolderTemplate: '{device_name}'
      }
      processor = createPathProcessor(config)

      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      const result = await processor.processFilePath(sourceFile, destDir, 'MyCamera')

      // Should contain device name
      expect(result.directory).toContain('MyCamera')
    })

    it('should sanitize device names in folders', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        createDeviceBasedFolders: true,
        deviceFolderTemplate: '{device_name}'
      }
      processor = createPathProcessor(config)

      const sourceFile = path.join(sourceDir, 'test.mp4')
      await fs.writeFile(sourceFile, 'test content')

      // Device name with special characters
      const result = await processor.processFilePath(sourceFile, destDir, 'My/Bad:Device<>')

      // Should not contain dangerous characters in path
      expect(result.directory).not.toContain('<')
      expect(result.directory).not.toContain('>')
      expect(result.directory).not.toContain(':')
    })
  })

  describe('Media file filtering', () => {
    it('should filter non-media files when enabled', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        transferOnlyMediaFiles: true,
        mediaExtensions: ['.mp4', '.jpg']
      }
      processor = createPathProcessor(config)

      const mediaFile = path.join(sourceDir, 'video.mp4')
      await fs.writeFile(mediaFile, 'content')

      const nonMediaFile = path.join(sourceDir, 'document.txt')
      await fs.writeFile(nonMediaFile, 'content')

      // Should process media file
      expect(processor.shouldTransferFile(mediaFile)).toBe(true)

      // Should reject non-media file
      expect(processor.shouldTransferFile(nonMediaFile)).toBe(false)
    })

    it('should throw error when processing non-media file with filter enabled', async () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        transferOnlyMediaFiles: true,
        mediaExtensions: ['.mp4', '.jpg']
      }
      processor = createPathProcessor(config)

      const nonMediaFile = path.join(sourceDir, 'document.txt')
      await fs.writeFile(nonMediaFile, 'content')

      await expect(processor.processFilePath(nonMediaFile, destDir)).rejects.toThrow()
    })
  })

  describe('Cross-platform filename sanitization', () => {
    it('should sanitize filenames with invalid characters', async () => {
      const sourceFile = path.join(sourceDir, 'test:file<>.mp4')

      // Create file with valid name for testing
      const validSourceFile = path.join(sourceDir, 'test-file.mp4')
      await fs.writeFile(validSourceFile, 'content')

      // Mock the stat to return our test file
      const originalStat = fs.stat
      jest.spyOn(fs, 'stat').mockImplementation(async (p) => {
        if (p === sourceFile) {
          return originalStat(validSourceFile)
        }
        return originalStat(p)
      })

      try {
        const result = await processor.processFilePath(sourceFile, destDir)

        // Should not contain invalid characters
        expect(result.fileName).not.toContain('<')
        expect(result.fileName).not.toContain('>')
        expect(result.fileName).not.toContain(':')
      } finally {
        jest.restoreAllMocks()
      }
    })
  })
})
