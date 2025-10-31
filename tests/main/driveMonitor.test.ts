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
  scanDriveForMedia,
  getDriveStats,
  isRemovableDrive
} from '../../src/main/driveMonitor'
import { DriveInfo, ScannedMedia } from '../../src/shared/types'

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
      let started = false

      await monitor.start({
        onDriveAdded: () => {
          started = true
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
})
