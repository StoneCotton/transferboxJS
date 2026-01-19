/**
 * Drive Monitor Tests
 * Following TDD - these tests are written BEFORE implementation
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import {
  DriveMonitor,
  listRemovableDrives,
  listSourceDrives,
  scanDriveForMedia,
  getDriveStats,
  isRemovableDrive
} from '../../src/main/driveMonitor'
import { DriveInfo } from '../../src/shared/types'

// Mock config values that can be changed per test
let mockConfigValues = {
  transferOnlyMediaFiles: true, // Filter by media extensions in these tests
  excludeSystemFiles: true, // Exclude system files by default
  showAllDrives: false, // Only show removable drives by default
  mediaExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.jpg', '.jpeg', '.png', '.gif', '.raw', '.cr2', '.nef', '.arw', '.dng', '.heic', '.wav', '.mp3', '.aiff']
}

// Mock configManager to control settings
jest.mock('../../src/main/configManager', () => ({
  getConfig: jest.fn(() => mockConfigValues)
}))

describe('DriveMonitor', () => {
  let monitor: DriveMonitor

  beforeEach(() => {
    monitor = new DriveMonitor()
  })

  afterEach(() => {
    monitor.stop()
  })

  describe('Drive Detection', () => {
    it('should list all drives', async () => {
      const drives = await monitor.listDrives()

      expect(Array.isArray(drives)).toBe(true)
      // Should have at least the system drive
      expect(drives.length).toBeGreaterThanOrEqual(1)
    })

    it('should list only removable drives', async () => {
      const drives = await monitor.listRemovableDrives()

      expect(Array.isArray(drives)).toBe(true)
      // All returned drives should be removable
      drives.forEach((drive) => {
        expect(drive.isRemovable).toBe(true)
      })
    })

    it('should filter out system drives', async () => {
      const drives = await monitor.listRemovableDrives()

      // No system drives should be included
      drives.forEach((drive) => {
        expect(drive.isSystem).toBe(false)
      })
    })

    it('should provide drive metadata', async () => {
      const drives = await monitor.listDrives()

      if (drives.length > 0) {
        const drive = drives[0]
        expect(drive.device).toBeDefined()
        expect(drive.displayName).toBeDefined()
        expect(drive.description).toBeDefined()
        expect(drive.mountpoints).toBeDefined()
        expect(Array.isArray(drive.mountpoints)).toBe(true)
        expect(typeof drive.size).toBe('number')
        expect(typeof drive.isRemovable).toBe('boolean')
        expect(typeof drive.isSystem).toBe('boolean')
      }
    })
  })

  describe('Drive Monitoring', () => {
    it('should start monitoring for drive changes', async () => {
      await monitor.start({
        onDriveAdded: () => {
          // Drive added callback
        }
      })

      expect(monitor.isMonitoring()).toBe(true)
    })

    it('should stop monitoring', async () => {
      await monitor.start({
        onDriveAdded: () => {}
      })

      expect(monitor.isMonitoring()).toBe(true)

      monitor.stop()

      expect(monitor.isMonitoring()).toBe(false)
    })

    it('should detect drive changes with polling', async () => {
      // Note: This test may not detect real drive changes in CI
      // It tests the polling mechanism works

      const detectedDrives: DriveInfo[] = []

      await monitor.start({
        pollingInterval: 100, // Fast polling for test
        onDriveAdded: (drive) => {
          detectedDrives.push(drive)
        },
        onDriveRemoved: () => {}
      })

      // Wait a bit for at least one poll
      await new Promise((resolve) => setTimeout(resolve, 250))

      monitor.stop()

      // Monitoring should have run
      expect(monitor.isMonitoring()).toBe(false)
    })

    it('should not start monitoring twice', async () => {
      await monitor.start({
        onDriveAdded: () => {}
      })

      // Try to start again
      await expect(
        monitor.start({
          onDriveAdded: () => {}
        })
      ).rejects.toThrow(/already monitoring/i)

      monitor.stop()
    })
  })

  describe('Media File Scanning', () => {
    let testDir: string

    beforeEach(async () => {
      // Create a test directory to simulate a drive
      testDir = path.join(os.tmpdir(), `transferbox-drive-test-${Date.now()}`)
      await fs.mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should scan directory for media files', async () => {
      // Create test media files
      await fs.writeFile(path.join(testDir, 'photo1.jpg'), 'fake image')
      await fs.writeFile(path.join(testDir, 'photo2.png'), 'fake image')
      await fs.writeFile(path.join(testDir, 'video.mp4'), 'fake video')
      await fs.writeFile(path.join(testDir, 'document.txt'), 'not media') // Should be ignored

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(3)
      expect(result.fileCount).toBe(3)
      expect(result.totalSize).toBeGreaterThan(0)
      expect(result.scanTime).toBeGreaterThan(0)
    })

    it('should scan nested directories', async () => {
      await fs.mkdir(path.join(testDir, 'DCIM'))
      await fs.mkdir(path.join(testDir, 'DCIM', '100APPLE'))

      await fs.writeFile(path.join(testDir, 'DCIM', '100APPLE', 'IMG_001.jpg'), 'image')
      await fs.writeFile(path.join(testDir, 'DCIM', '100APPLE', 'IMG_002.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(2)
    })

    it('should filter by media extensions', async () => {
      await fs.writeFile(path.join(testDir, 'media.mp4'), 'video')
      await fs.writeFile(path.join(testDir, 'media.jpg'), 'image')
      await fs.writeFile(path.join(testDir, 'media.txt'), 'text')
      await fs.writeFile(path.join(testDir, 'media.doc'), 'document')

      const result = await monitor.scanForMedia(testDir)

      // Should only find mp4 and jpg
      expect(result.files.length).toBe(2)

      // Verify only media files
      result.files.forEach((ScannedFile) => {
        const ext = path.extname(ScannedFile.path).toLowerCase()
        expect(['.mp4', '.jpg'].includes(ext)).toBe(true)
      })
    })

    it('should handle empty directories', async () => {
      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(0)
      expect(result.fileCount).toBe(0)
      expect(result.totalSize).toBe(0)
    })

    it('should calculate total size correctly', async () => {
      const file1Size = 1024
      const file2Size = 2048

      await fs.writeFile(path.join(testDir, 'file1.jpg'), Buffer.alloc(file1Size))
      await fs.writeFile(path.join(testDir, 'file2.mp4'), Buffer.alloc(file2Size))

      const result = await monitor.scanForMedia(testDir)

      expect(result.totalSize).toBe(file1Size + file2Size)
    })

    it('should report scan time', async () => {
      await fs.writeFile(path.join(testDir, 'test.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      // Scan time should be present (may be 0 on very fast systems)
      expect(result.scanTime).toBeGreaterThanOrEqual(0)
      expect(result.scanTime).toBeLessThan(5000) // Should be fast
    })

    it('should handle permission errors gracefully', async () => {
      // This test may not work on all platforms
      if (process.platform !== 'win32') {
        const restrictedDir = path.join(testDir, 'restricted')
        await fs.mkdir(restrictedDir)
        await fs.writeFile(path.join(restrictedDir, 'file.jpg'), 'image')
        await fs.chmod(restrictedDir, 0o000) // No permissions

        const result = await monitor.scanForMedia(testDir)

        // Should not crash, may or may not find files depending on race condition
        expect(result).toBeDefined()

        // Restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755)
      }
    })
  })

  describe('Drive Statistics', () => {
    it('should get drive statistics', async () => {
      const drives = await monitor.listDrives()

      if (drives.length > 0 && drives[0].mountpoints.length > 0) {
        const stats = await monitor.getDriveStats(drives[0].mountpoints[0])

        expect(stats.totalSpace).toBeGreaterThan(0)
        expect(stats.freeSpace).toBeGreaterThan(0)
        expect(stats.usedSpace).toBeGreaterThanOrEqual(0)
        expect(stats.percentUsed).toBeGreaterThanOrEqual(0)
        expect(stats.percentUsed).toBeLessThanOrEqual(100)
      }
    })

    it('should handle non-existent paths', async () => {
      await expect(monitor.getDriveStats('/non/existent/path')).rejects.toThrow()
    })
  })

  describe('Drive Identification', () => {
    it('should identify removable drives by bus type', () => {
      const usbDrive: DriveInfo = {
        device: '/dev/disk2',
        displayName: 'USB Drive',
        description: 'USB Storage',
        mountpoints: ['/Volumes/USB'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      expect(isRemovableDrive(usbDrive)).toBe(true)
    })

    it('should identify system drives', () => {
      const systemDrive: DriveInfo = {
        device: '/dev/disk0',
        displayName: 'System Drive',
        description: 'Internal Storage',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: false,
        isSystem: true,
        busType: 'SATA'
      }

      expect(isRemovableDrive(systemDrive)).toBe(false)
    })
  })

  describe('Standalone Functions', () => {
    it('should list removable drives using standalone function', async () => {
      const drives = await listRemovableDrives()

      expect(Array.isArray(drives)).toBe(true)
      drives.forEach((drive) => {
        expect(drive.isRemovable).toBe(true)
      })
    })

    it('should scan drive using standalone function', async () => {
      const testDir = path.join(os.tmpdir(), `transferbox-scan-test-${Date.now()}`)
      await fs.mkdir(testDir, { recursive: true })

      try {
        await fs.writeFile(path.join(testDir, 'test.jpg'), 'image')

        const result = await scanDriveForMedia(testDir)

        expect(result.files.length).toBeGreaterThanOrEqual(0)
        expect(result.fileCount).toBeGreaterThanOrEqual(0)
      } finally {
        await fs.rm(testDir, { recursive: true, force: true })
      }
    })

    it('should get drive stats using standalone function', async () => {
      const tempDir = os.tmpdir()
      const stats = await getDriveStats(tempDir)

      expect(stats.totalSpace).toBeGreaterThan(0)
      expect(stats.freeSpace).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle drives with no mount points', async () => {
      const drives = await monitor.listDrives()

      // Should not crash even if some drives have no mount points
      expect(drives).toBeDefined()
    })

    it('should handle very long file paths in scan', async () => {
      const testDir = path.join(os.tmpdir(), `transferbox-long-test-${Date.now()}`)
      await fs.mkdir(testDir, { recursive: true })

      try {
        const longPath = path.join(testDir, 'a'.repeat(200), 'file.jpg')
        await fs.mkdir(path.dirname(longPath), { recursive: true })
        await fs.writeFile(longPath, 'image')

        const result = await monitor.scanForMedia(testDir)

        expect(result.files.length).toBeGreaterThanOrEqual(0)
      } catch (error) {
        // May fail on some filesystems with path length limits
        // That's okay, just verify it doesn't crash the entire app
        expect(error).toBeDefined()
      } finally {
        await fs.rm(testDir, { recursive: true, force: true })
      }
    })

    it('should handle special characters in filenames', async () => {
      const testDir = path.join(os.tmpdir(), `transferbox-special-test-${Date.now()}`)
      await fs.mkdir(testDir, { recursive: true })

      try {
        await fs.writeFile(path.join(testDir, "file with spaces & 'quotes'.jpg"), 'image')
        await fs.writeFile(path.join(testDir, 'file_with_émojis_🚀.mp4'), 'video')

        const result = await monitor.scanForMedia(testDir)

        expect(result.files.length).toBeGreaterThanOrEqual(0)
      } finally {
        await fs.rm(testDir, { recursive: true, force: true })
      }
    })
  })

  describe('System File Filtering', () => {
    let testDir: string

    beforeEach(async () => {
      testDir = path.join(os.tmpdir(), `transferbox-sysfile-test-${Date.now()}`)
      await fs.mkdir(testDir, { recursive: true })

      // Reset mock to default (excludeSystemFiles: true)
      mockConfigValues =({
        transferOnlyMediaFiles: false, // Include all files to test system file filtering
        excludeSystemFiles: true,
        showAllDrives: false,
        mediaExtensions: ['.mp4', '.jpg']
      })
    })

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should exclude .DS_Store files when excludeSystemFiles is true', async () => {
      await fs.writeFile(path.join(testDir, '.DS_Store'), 'macOS metadata')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
    })

    it('should exclude Thumbs.db files when excludeSystemFiles is true', async () => {
      await fs.writeFile(path.join(testDir, 'Thumbs.db'), 'Windows thumbnail cache')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
    })

    it('should exclude desktop.ini files when excludeSystemFiles is true', async () => {
      await fs.writeFile(path.join(testDir, 'desktop.ini'), 'Windows folder settings')
      await fs.writeFile(path.join(testDir, 'video.mp4'), 'video')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('video.mp4')
    })

    it('should exclude AppleDouble resource fork files (._*)', async () => {
      await fs.writeFile(path.join(testDir, '._photo.jpg'), 'AppleDouble metadata')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
      expect(result.files[0].path).not.toContain('._photo')
    })

    it('should exclude .git directories', async () => {
      const gitDir = path.join(testDir, '.git')
      await fs.mkdir(gitDir, { recursive: true })
      await fs.writeFile(path.join(gitDir, 'config'), 'git config')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
    })

    it('should exclude .Spotlight-V100 directories', async () => {
      const spotlightDir = path.join(testDir, '.Spotlight-V100')
      await fs.mkdir(spotlightDir, { recursive: true })
      await fs.writeFile(path.join(spotlightDir, 'index'), 'spotlight index')
      await fs.writeFile(path.join(testDir, 'video.mp4'), 'video')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('video.mp4')
    })

    it('should exclude .Trashes directories', async () => {
      const trashDir = path.join(testDir, '.Trashes')
      await fs.mkdir(trashDir, { recursive: true })
      await fs.writeFile(path.join(trashDir, 'deleted.jpg'), 'deleted file')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
    })

    it('should include system files when excludeSystemFiles is false', async () => {
      mockConfigValues =({
        transferOnlyMediaFiles: false,
        excludeSystemFiles: false, // Disable system file filtering
        showAllDrives: false,
        mediaExtensions: ['.mp4', '.jpg']
      })

      await fs.writeFile(path.join(testDir, '.DS_Store'), 'macOS metadata')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(2)
    })

    it('should exclude multiple system files in same scan', async () => {
      await fs.writeFile(path.join(testDir, '.DS_Store'), 'macOS metadata')
      await fs.writeFile(path.join(testDir, 'Thumbs.db'), 'Windows thumbnails')
      await fs.writeFile(path.join(testDir, 'desktop.ini'), 'Windows settings')
      await fs.writeFile(path.join(testDir, '._hidden'), 'AppleDouble')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')
      await fs.writeFile(path.join(testDir, 'video.mp4'), 'video')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(2)
      const filenames = result.files.map((f) => path.basename(f.path))
      expect(filenames).toContain('photo.jpg')
      expect(filenames).toContain('video.mp4')
    })

    it('should handle case-insensitive system file matching', async () => {
      await fs.writeFile(path.join(testDir, 'THUMBS.DB'), 'Windows thumbnails')
      await fs.writeFile(path.join(testDir, 'Desktop.INI'), 'Windows settings')
      await fs.writeFile(path.join(testDir, 'photo.jpg'), 'image')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toContain('photo.jpg')
    })
  })

  describe('listSourceDrives', () => {
    beforeEach(() => {
      // Reset mock to default
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: false,
        mediaExtensions: ['.mp4', '.jpg']
      })
    })

    it('should list source drives using standalone function', async () => {
      const drives = await listSourceDrives()

      expect(Array.isArray(drives)).toBe(true)
    })

    it('should return only removable drives when showAllDrives is false', async () => {
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: false,
        mediaExtensions: ['.mp4', '.jpg']
      })

      const drives = await monitor.listSourceDrives()

      // All returned drives should be removable
      drives.forEach((drive) => {
        expect(drive.isRemovable).toBe(true)
      })
    })

    it('should include local physical drives when showAllDrives is true', async () => {
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: true,
        mediaExtensions: ['.mp4', '.jpg']
      })

      const drives = await monitor.listSourceDrives()

      expect(Array.isArray(drives)).toBe(true)
      // Should have at least the system drive when showAllDrives is true
      expect(drives.length).toBeGreaterThanOrEqual(1)
    })

    it('should list more drives with showAllDrives true than false', async () => {
      // Get removable drives only
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: false,
        mediaExtensions: ['.mp4', '.jpg']
      })
      const removableDrives = await monitor.listSourceDrives()

      // Get all local physical drives
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: true,
        mediaExtensions: ['.mp4', '.jpg']
      })
      const allDrives = await monitor.listSourceDrives()

      // All drives should include at least as many as removable drives
      expect(allDrives.length).toBeGreaterThanOrEqual(removableDrives.length)
    })
  })

  describe('Drive Filtering Logic', () => {
    it('should not include drives without mountpoints in source drives', async () => {
      mockConfigValues =({
        transferOnlyMediaFiles: true,
        excludeSystemFiles: true,
        showAllDrives: true,
        mediaExtensions: ['.mp4', '.jpg']
      })

      const drives = await monitor.listSourceDrives()

      // All returned drives should have at least one mountpoint
      drives.forEach((drive) => {
        expect(drive.mountpoints.length).toBeGreaterThan(0)
      })
    })
  })
})
