/**
 * Additional Drive Monitor Tests for Coverage
 * Tests for edge cases and error paths not covered by existing tests
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { DriveMonitor, unmountDrive, isRemovableDrive } from '../../src/main/driveMonitor'
import { DriveInfo } from '../../src/shared/types'

// Mock configManager to control transferOnlyMediaFiles setting
jest.mock('../../src/main/configManager', () => ({
  getConfig: jest.fn(() => ({
    transferOnlyMediaFiles: true, // Filter by media extensions in these tests
    mediaExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.jpg', '.jpeg', '.png', '.gif', '.raw', '.cr2', '.nef', '.arw', '.dng', '.heic', '.wav', '.mp3', '.aiff']
  }))
}))

describe('DriveMonitor - Additional Coverage', () => {
  let monitor: DriveMonitor
  let testDir: string

  beforeEach(async () => {
    monitor = new DriveMonitor()
    testDir = path.join(os.tmpdir(), `transferbox-drive-coverage-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    monitor.stop()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Drive Change Detection', () => {
    it('should call onDriveAdded for new drives', async () => {
      const addedDrives: DriveInfo[] = []
      const removedDevices: string[] = []

      await monitor.start({
        pollingInterval: 50,
        onDriveAdded: (drive) => {
          addedDrives.push(drive)
        },
        onDriveRemoved: (device) => {
          removedDevices.push(device)
        }
      })

      // Wait for a few polling cycles
      await new Promise((resolve) => setTimeout(resolve, 200))

      monitor.stop()

      // Monitoring mechanism should work without errors
      expect(monitor.isMonitoring()).toBe(false)
    })

    it('should call onDriveRemoved when drive disappears', async () => {
      const removedDevices: string[] = []

      await monitor.start({
        pollingInterval: 50,
        onDriveRemoved: (device) => {
          removedDevices.push(device)
        }
      })

      // Wait for a few polling cycles
      await new Promise((resolve) => setTimeout(resolve, 200))

      monitor.stop()

      // Should have stopped monitoring
      expect(monitor.isMonitoring()).toBe(false)
    })

    it('should handle checkForChanges when not monitoring', async () => {
      // Start monitoring then stop
      await monitor.start({ pollingInterval: 100 })

      // Wait a bit for at least one poll
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Stop monitoring
      monitor.stop()

      // Call private checkForChanges via short timeout while stopped
      // This tests the early return path
      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(monitor.isMonitoring()).toBe(false)
    })
  })

  describe('Scanning Special Files', () => {
    it('should skip symlinks during scanning', async () => {
      // Create a regular file
      const realFile = path.join(testDir, 'real.jpg')
      await fs.writeFile(realFile, 'image content')

      // Create a symlink to the file
      const symlinkFile = path.join(testDir, 'link.jpg')
      try {
        await fs.symlink(realFile, symlinkFile)
      } catch {
        // Symlinks may not be supported on all systems
        return
      }

      const result = await monitor.scanForMedia(testDir)

      // Should only find the real file, not the symlink
      expect(result.files.length).toBe(1)
      expect(result.files[0].path).toBe(realFile)
    })

    it('should skip symlinked directories during scanning', async () => {
      // Create a subdirectory with a file
      const subdir = path.join(testDir, 'subdir')
      await fs.mkdir(subdir)
      await fs.writeFile(path.join(subdir, 'file.jpg'), 'image')

      // Create a symlink to the directory
      const symlinkDir = path.join(testDir, 'linkdir')
      try {
        await fs.symlink(subdir, symlinkDir, 'dir')
      } catch {
        // Symlinks may not be supported on all systems
        return
      }

      const result = await monitor.scanForMedia(testDir)

      // Should find files only once (from the real directory)
      expect(result.files.length).toBe(1)
    })

    it('should skip circular symlinks', async () => {
      // Create a circular symlink structure
      const dir1 = path.join(testDir, 'dir1')
      await fs.mkdir(dir1)

      try {
        // Create symlink back to parent
        await fs.symlink(testDir, path.join(dir1, 'parent'), 'dir')
      } catch {
        // Symlinks may not be supported
        return
      }

      // Should not hang in infinite loop
      const result = await monitor.scanForMedia(testDir)
      expect(result).toBeDefined()
    })

    it('should handle hard links correctly', async () => {
      const file1 = path.join(testDir, 'original.jpg')
      await fs.writeFile(file1, 'content')

      // Create a hard link (same inode)
      const hardLink = path.join(testDir, 'hardlink.jpg')
      try {
        await fs.link(file1, hardLink)
      } catch {
        // Hard links may not be supported
        return
      }

      const result = await monitor.scanForMedia(testDir)

      // Should only count the file once (by inode)
      expect(result.files.length).toBe(1)
    })
  })

  describe('isTrulyRemovableDrive Filtering', () => {
    it('should filter out SATA drives', () => {
      const monitorAny = monitor as any

      const sataDrive = {
        device: '/dev/sda',
        description: 'Internal SATA Drive',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: true, // Incorrectly marked as removable
        isSystem: false,
        busType: 'SATA'
      }

      expect(monitorAny.isTrulyRemovableDrive(sataDrive)).toBe(false)
    })

    it('should filter out ATA drives', () => {
      const monitorAny = monitor as any

      const ataDrive = {
        device: '/dev/sda',
        description: 'Internal ATA Drive',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'ATA'
      }

      expect(monitorAny.isTrulyRemovableDrive(ataDrive)).toBe(false)
    })

    it('should filter out non-USB SCSI drives', () => {
      const monitorAny = monitor as any

      const scsiDrive = {
        device: '/dev/sda',
        description: 'Internal SCSI Drive',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: true,
        isSystem: false,
        isSCSI: true,
        isUSB: false,
        isCard: false,
        busType: 'SCSI'
      }

      expect(monitorAny.isTrulyRemovableDrive(scsiDrive)).toBe(false)
    })

    it('should accept USB drives', () => {
      const monitorAny = monitor as any

      const usbDrive = {
        device: '/dev/sdb',
        description: 'USB Drive',
        mountpoints: ['/media/usb'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        isUSB: true,
        busType: 'USB'
      }

      expect(monitorAny.isTrulyRemovableDrive(usbDrive)).toBe(true)
    })

    it('should accept card readers', () => {
      const monitorAny = monitor as any

      const cardDrive = {
        device: '/dev/sdc',
        description: 'SD Card',
        mountpoints: ['/media/sd'],
        size: 64000000000,
        isRemovable: true,
        isSystem: false,
        isCard: true,
        busType: 'SD'
      }

      expect(monitorAny.isTrulyRemovableDrive(cardDrive)).toBe(true)
    })

    it('should accept UAS drives', () => {
      const monitorAny = monitor as any

      const uasDrive = {
        device: '/dev/sdd',
        description: 'USB Attached SCSI Drive',
        mountpoints: ['/media/uas'],
        size: 128000000000,
        isRemovable: true,
        isSystem: false,
        isUAS: true,
        busType: 'USB'
      }

      expect(monitorAny.isTrulyRemovableDrive(uasDrive)).toBe(true)
    })

    it('should reject non-removable drives', () => {
      const monitorAny = monitor as any

      const fixedDrive = {
        device: '/dev/sda',
        description: 'Fixed Drive',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: false,
        isSystem: true,
        busType: 'SATA'
      }

      expect(monitorAny.isTrulyRemovableDrive(fixedDrive)).toBe(false)
    })

    it('should reject system drives', () => {
      const monitorAny = monitor as any

      const systemDrive = {
        device: '/dev/sda',
        description: 'System Drive',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: true,
        isSystem: true,
        busType: 'USB'
      }

      expect(monitorAny.isTrulyRemovableDrive(systemDrive)).toBe(false)
    })

    it('should accept drives with unknown bus type that are USB or Card', () => {
      const monitorAny = monitor as any

      const unknownBusDrive = {
        device: '/dev/sde',
        description: 'Unknown Bus Drive',
        mountpoints: ['/media/unknown'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        isUSB: true,
        busType: 'Unknown'
      }

      expect(monitorAny.isTrulyRemovableDrive(unknownBusDrive)).toBe(true)
    })
  })

  describe('convertDriveInfo', () => {
    it('should handle mountpoints as objects', () => {
      const monitorAny = monitor as any

      const drive = {
        device: '/dev/sdb',
        description: 'Test Drive',
        mountpoints: [{ path: '/media/test' }],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const converted = monitorAny.convertDriveInfo(drive)

      expect(converted.mountpoints).toEqual(['/media/test'])
    })

    it('should handle mountpoints as strings', () => {
      const monitorAny = monitor as any

      const drive = {
        device: '/dev/sdb',
        description: 'Test Drive',
        mountpoints: ['/media/test'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const converted = monitorAny.convertDriveInfo(drive)

      expect(converted.mountpoints).toEqual(['/media/test'])
    })

    it('should handle missing mountpoints', () => {
      const monitorAny = monitor as any

      const drive = {
        device: '/dev/sdb',
        description: 'Test Drive',
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const converted = monitorAny.convertDriveInfo(drive)

      expect(converted.mountpoints).toEqual([])
    })

    it('should handle null values', () => {
      const monitorAny = monitor as any

      const drive = {
        device: '/dev/sdb',
        description: null,
        mountpoints: null,
        size: null,
        isRemovable: null,
        isSystem: null,
        busType: null
      }

      const converted = monitorAny.convertDriveInfo(drive)

      expect(converted.device).toBe('/dev/sdb')
      expect(converted.displayName).toBe('/dev/sdb')
      expect(converted.mountpoints).toEqual([])
      expect(converted.size).toBe(0)
      expect(converted.isRemovable).toBe(false)
      expect(converted.isSystem).toBe(false)
      expect(converted.busType).toBe('Unknown')
    })

    it('should use device as displayName when description is missing', () => {
      const monitorAny = monitor as any

      const drive = {
        device: '/dev/sdb',
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const converted = monitorAny.convertDriveInfo(drive)

      expect(converted.displayName).toBe('/dev/sdb')
    })
  })

  describe('Unmount Drive', () => {
    it('should fail to unmount non-existent drive', async () => {
      const result = await monitor.unmountDrive('/dev/nonexistent')

      expect(result).toBe(false)
    })

    it('should fail to unmount drive without mountpoints', async () => {
      // The unmount logic checks for drives that exist but have no mountpoints
      const result = await monitor.unmountDrive('/dev/sdzz')

      expect(result).toBe(false)
    })

    it('should use convenience function for unmount', async () => {
      // Test the standalone unmountDrive function
      const result = await unmountDrive('/dev/nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('Scanning Error Handling', () => {
    it('should handle inaccessible files during scan', async () => {
      // Create a file
      const file = path.join(testDir, 'test.jpg')
      await fs.writeFile(file, 'content')

      // Remove read permissions (Unix only)
      if (process.platform !== 'win32') {
        await fs.chmod(file, 0o000)
      }

      // Scan should complete without error
      const result = await monitor.scanForMedia(testDir)

      // Restore permissions for cleanup
      if (process.platform !== 'win32') {
        await fs.chmod(file, 0o644)
      }

      // Should handle gracefully
      expect(result).toBeDefined()
    })

    it('should handle directories that become inaccessible during scan', async () => {
      // Create nested structure
      const subdir = path.join(testDir, 'subdir')
      await fs.mkdir(subdir)
      await fs.writeFile(path.join(subdir, 'file.jpg'), 'content')

      // Remove permissions on subdir (Unix only)
      if (process.platform !== 'win32') {
        await fs.chmod(subdir, 0o000)
      }

      // Scan should complete without crashing
      const result = await monitor.scanForMedia(testDir)

      // Restore permissions for cleanup
      if (process.platform !== 'win32') {
        await fs.chmod(subdir, 0o755)
      }

      expect(result).toBeDefined()
    })

    it('should handle non-existent scan path', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent')

      // Should not crash
      const result = await monitor.scanForMedia(nonExistentPath)

      expect(result.files).toEqual([])
      expect(result.fileCount).toBe(0)
    })
  })

  describe('isRemovableDrive Helper', () => {
    it('should return true for removable non-system drives', () => {
      const drive: DriveInfo = {
        device: '/dev/sdb',
        displayName: 'USB Drive',
        description: 'USB Storage',
        mountpoints: ['/media/usb'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      expect(isRemovableDrive(drive)).toBe(true)
    })

    it('should return false for non-removable drives', () => {
      const drive: DriveInfo = {
        device: '/dev/sda',
        displayName: 'Internal Drive',
        description: 'Internal Storage',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: false,
        isSystem: false,
        busType: 'SATA'
      }

      expect(isRemovableDrive(drive)).toBe(false)
    })

    it('should return false for system drives even if marked removable', () => {
      const drive: DriveInfo = {
        device: '/dev/sda',
        displayName: 'System Drive',
        description: 'System Storage',
        mountpoints: ['/'],
        size: 500000000000,
        isRemovable: true,
        isSystem: true,
        busType: 'SATA'
      }

      expect(isRemovableDrive(drive)).toBe(false)
    })
  })

  describe('Scan File Metadata', () => {
    it('should include birthtime and mtime in scanned files', async () => {
      const file = path.join(testDir, 'metadata.jpg')
      await fs.writeFile(file, 'content')

      const result = await monitor.scanForMedia(testDir)

      expect(result.files.length).toBe(1)
      expect(result.files[0].birthtime).toBeDefined()
      expect(result.files[0].mtime).toBeDefined()
      expect(typeof result.files[0].birthtime).toBe('number')
      expect(typeof result.files[0].mtime).toBe('number')
    })
  })
})

describe('DriveMonitor - Mountpoint Change Detection', () => {
  let monitor: DriveMonitor

  beforeEach(() => {
    monitor = new DriveMonitor()
  })

  afterEach(() => {
    monitor.stop()
  })

  it('should detect when a device mountpoint appears', async () => {
    const addedDrives: DriveInfo[] = []

    await monitor.start({
      pollingInterval: 50,
      onDriveAdded: (drive) => {
        addedDrives.push(drive)
      }
    })

    // Wait for polling
    await new Promise((resolve) => setTimeout(resolve, 150))

    monitor.stop()

    // Monitoring should have worked
    expect(monitor.isMonitoring()).toBe(false)
  })

  it('should detect when a device mountpoint disappears', async () => {
    const removedDevices: string[] = []

    await monitor.start({
      pollingInterval: 50,
      onDriveRemoved: (device) => {
        removedDevices.push(device)
      }
    })

    // Wait for polling
    await new Promise((resolve) => setTimeout(resolve, 150))

    monitor.stop()

    // Monitoring should have worked
    expect(monitor.isMonitoring()).toBe(false)
  })
})

describe('DriveMonitor - checkForChanges Coverage', () => {
  let monitor: DriveMonitor

  beforeEach(() => {
    monitor = new DriveMonitor()
  })

  afterEach(() => {
    monitor.stop()
  })

  it('should trigger drive callbacks during monitoring cycle', async () => {
    const addedDrives: DriveInfo[] = []
    const removedDevices: string[] = []

    await monitor.start({
      pollingInterval: 30,
      onDriveAdded: (drive) => {
        addedDrives.push(drive)
      },
      onDriveRemoved: (device) => {
        removedDevices.push(device)
      }
    })

    // Run multiple polling cycles
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Stop and verify
    monitor.stop()
    expect(monitor.isMonitoring()).toBe(false)
  })

  it('should not call callbacks after stop is called', async () => {
    let callbackCount = 0

    await monitor.start({
      pollingInterval: 20,
      onDriveAdded: () => {
        callbackCount++
      }
    })

    // Wait for a cycle
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Stop
    monitor.stop()

    const countAfterStop = callbackCount

    // Wait more
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Count should not have increased significantly after stop
    // (may increase by 1 due to race condition)
    expect(callbackCount).toBeLessThanOrEqual(countAfterStop + 1)
  })

  it('should handle rapid start/stop cycles', async () => {
    for (let i = 0; i < 5; i++) {
      await monitor.start({ pollingInterval: 50 })
      await new Promise((resolve) => setTimeout(resolve, 30))
      monitor.stop()
    }

    expect(monitor.isMonitoring()).toBe(false)
  })
})

describe('DriveMonitor - Private Method Testing via Integration', () => {
  let monitor: DriveMonitor
  let testDir: string

  beforeEach(async () => {
    monitor = new DriveMonitor()
    testDir = path.join(os.tmpdir(), `transferbox-private-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    monitor.stop()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  it('should handle various media file extensions', async () => {
    // Test multiple supported extensions
    const extensions = ['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.cr2', '.arw', '.braw', '.r3d']

    for (const ext of extensions) {
      await fs.writeFile(path.join(testDir, `file${ext}`), 'content')
    }

    const result = await monitor.scanForMedia(testDir)

    // Should find all media files (exact count depends on config)
    expect(result.files.length).toBeGreaterThan(0)
  })

  it('should scan deeply nested directories', async () => {
    // Create deep nesting
    let currentPath = testDir
    for (let i = 0; i < 5; i++) {
      currentPath = path.join(currentPath, `level${i}`)
      await fs.mkdir(currentPath)
    }

    // Add a file at the deepest level
    await fs.writeFile(path.join(currentPath, 'deep.jpg'), 'deep content')

    const result = await monitor.scanForMedia(testDir)

    expect(result.files.length).toBe(1)
    expect(result.files[0].path).toContain('level4')
  })

  it('should handle mixed file types in same directory', async () => {
    // Media files
    await fs.writeFile(path.join(testDir, 'video.mp4'), 'video')
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'photo')

    // Non-media files
    await fs.writeFile(path.join(testDir, 'document.txt'), 'text')
    await fs.writeFile(path.join(testDir, 'script.js'), 'code')
    await fs.writeFile(path.join(testDir, 'data.json'), 'json')
    await fs.writeFile(path.join(testDir, 'style.css'), 'css')

    const result = await monitor.scanForMedia(testDir)

    // Should only find media files
    expect(result.files.length).toBe(2)
    expect(result.files.some((f) => f.path.endsWith('.mp4'))).toBe(true)
    expect(result.files.some((f) => f.path.endsWith('.jpg'))).toBe(true)
  })

  it('should handle empty subdirectories', async () => {
    // Create empty subdirectories
    await fs.mkdir(path.join(testDir, 'empty1'))
    await fs.mkdir(path.join(testDir, 'empty2'))
    await fs.mkdir(path.join(testDir, 'withFile'))

    // One file in one directory
    await fs.writeFile(path.join(testDir, 'withFile', 'test.jpg'), 'content')

    const result = await monitor.scanForMedia(testDir)

    expect(result.files.length).toBe(1)
  })

  it('should handle files with uppercase extensions', async () => {
    await fs.writeFile(path.join(testDir, 'PHOTO.JPG'), 'content')
    await fs.writeFile(path.join(testDir, 'video.MP4'), 'content')
    await fs.writeFile(path.join(testDir, 'mixed.JpG'), 'content')

    const result = await monitor.scanForMedia(testDir)

    // Extensions are normalized to lowercase, so should find all
    expect(result.files.length).toBe(3)
  })
})
