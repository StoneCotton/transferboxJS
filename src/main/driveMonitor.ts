/**
 * Drive Monitor Module
 * Detects and monitors removable storage devices (SD cards, USB drives).
 * Scans drives for files based on transferOnlyMediaFiles config:
 * - When true: Only returns files matching mediaExtensions
 * - When false: Returns all files on the drive
 */

import * as drivelist from 'drivelist'
import { readdir, lstat } from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { DriveInfo, DriveStats, ScannedMedia, ScannedFile } from '../shared/types'
import { getConfig } from './configManager'
import { checkDiskSpace } from './pathValidator'
import { getLogger } from './logger'
import { validatePathForShellExecution } from './utils/securityValidation'

const execFileAsync = promisify(execFile)

/**
 * Type for drivelist drive objects - compatible with both drivelist.Drive and DriveInfo
 */
interface DrivelistDrive {
  device: string
  description?: string | null
  mountpoints?: Array<{ path: string; label?: string | null }> | string[]
  size?: number | null
  isRemovable?: boolean | null
  isSystem?: boolean | null
  busType?: string | null
  isUSB?: boolean | null
  isCard?: boolean | null
  isUAS?: boolean | null
  isSCSI?: boolean | null
}

export interface DriveMonitorOptions {
  pollingInterval?: number // Milliseconds between checks (default: 2000)
  onDriveAdded?: (drive: DriveInfo) => void
  onDriveRemoved?: (devicePath: string) => void
}

/**
 * Drive Monitor Class
 * Monitors for drive changes and scans for media files
 */
export class DriveMonitor {
  private monitoring = false
  private pollingInterval: number = 2000
  private intervalHandle: NodeJS.Timeout | null = null
  private lastDrives: Map<string, DriveInfo> = new Map()
  private onDriveAdded?: (drive: DriveInfo) => void
  private onDriveRemoved?: (devicePath: string) => void

  /**
   * List all drives
   */
  async listDrives(): Promise<DriveInfo[]> {
    const drives = await drivelist.list()

    const converted = drives.map((drive) => this.convertDriveInfo(drive))

    // Fallback for environments where drivelist returns no drives (e.g., CI/sandbox)
    if (converted.length === 0) {
      const root = path.parse(process.cwd()).root || '/'
      return [
        {
          device: 'system-root',
          displayName: 'System Root',
          description: 'System Root',
          mountpoints: [root],
          size: 0,
          isRemovable: false,
          isSystem: true,
          busType: 'Unknown'
        }
      ]
    }

    return converted
  }

  /**
   * List only removable drives
   */
  async listRemovableDrives(): Promise<DriveInfo[]> {
    const allDrives = await this.listDrives()

    return allDrives.filter((drive) => this.isTrulyRemovableDrive(drive))
  }

  /**
   * Start monitoring for drive changes
   */
  async start(options?: DriveMonitorOptions): Promise<void> {
    if (this.monitoring) {
      throw new Error('Already monitoring drives')
    }

    this.pollingInterval = options?.pollingInterval || 2000
    this.onDriveAdded = options?.onDriveAdded
    this.onDriveRemoved = options?.onDriveRemoved

    // Get initial drive list
    const initialDrives = await this.listRemovableDrives()
    initialDrives.forEach((drive) => {
      this.lastDrives.set(drive.device, drive)
    })

    this.monitoring = true

    // Start polling
    this.intervalHandle = setInterval(() => {
      this.checkForChanges()
    }, this.pollingInterval)
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.monitoring = false

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }

    this.lastDrives.clear()
  }

  /**
   * Check if currently monitoring
   */
  isMonitoring(): boolean {
    return this.monitoring
  }

  /**
   * Scan a drive/directory for files
   * When transferOnlyMediaFiles is enabled, only returns media files.
   * When disabled, returns all files on the drive.
   */
  async scanForMedia(drivePath: string): Promise<Omit<ScannedMedia, 'driveInfo'>> {
    const startTime = Date.now()
    const config = getConfig()
    const mediaExtensions = config.mediaExtensions.map((ext) => ext.toLowerCase())
    const filterByMediaExtensions = config.transferOnlyMediaFiles

    getLogger().info('[DriveMonitor] Scanning path', {
      path: drivePath,
      filterByMediaExtensions
    })
    getLogger().debug('[DriveMonitor] Media extensions', { mediaExtensions })

    const files: ScannedFile[] = []
    let totalSize = 0

    // Recursively scan directory
    await this.scanDirectory(drivePath, files, mediaExtensions, filterByMediaExtensions)

    // Calculate total size
    for (const file of files) {
      totalSize += file.size
    }

    const scanTime = Date.now() - startTime

    return {
      files,
      totalSize,
      fileCount: files.length,
      scanTime
    }
  }

  /**
   * Get drive statistics
   */
  async getDriveStats(mountPoint: string): Promise<DriveStats> {
    const spaceInfo = await checkDiskSpace(mountPoint)

    const totalSpace = spaceInfo.totalSpace
    const freeSpace = spaceInfo.freeSpace
    const usedSpace = totalSpace - freeSpace
    const percentUsed = totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0

    return {
      totalSpace,
      freeSpace,
      usedSpace,
      percentUsed
    }
  }

  /**
   * Safely unmount a drive
   */
  async unmountDrive(device: string): Promise<boolean> {
    try {
      // Find the drive to get its mount points
      const drives = await this.listRemovableDrives()
      const drive = drives.find((d) => d.device === device)

      if (!drive || drive.mountpoints.length === 0) {
        throw new Error('Drive not found or not mounted')
      }

      const mountPoint = drive.mountpoints[0]

      // Validate mount point path is safe for shell execution
      validatePathForShellExecution(mountPoint, 'mount point')

      // Platform-specific unmount commands
      switch (process.platform) {
        case 'darwin': // macOS
          // Use execFile with array arguments to prevent command injection
          await execFileAsync('diskutil', ['unmount', mountPoint])
          break
        case 'linux':
          // Use execFile with array arguments to prevent command injection
          await execFileAsync('umount', [mountPoint])
          break
        case 'win32': {
          // Extract drive letter from mount point (e.g., "D:\\" -> "D:")
          const driveLetterMatch = mountPoint.match(/^([A-Z]):[\\/]?$/i)
          if (!driveLetterMatch) {
            throw new Error(`Invalid Windows mount point format: ${mountPoint}`)
          }
          const driveLetter = driveLetterMatch[1].toUpperCase() + ':'

          // Use PowerShell Shell.Application Eject (same as Explorer UI)
          const psCommand = `($obj = New-Object -ComObject Shell.Application).Namespace(17).ParseName("${driveLetter}"); if ($obj) { $obj.InvokeVerb("Eject") }`
          await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            psCommand
          ])
          // Small delay for the OS to process eject
          await new Promise((resolve) => setTimeout(resolve, 800))
          break
        }
        default:
          throw new Error(`Unsupported platform: ${process.platform}`)
      }

      return true
    } catch (error) {
      getLogger().error('Failed to unmount drive', {
        device,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Check for drive changes
   * Protected against race conditions with monitoring flag
   */
  private async checkForChanges(): Promise<void> {
    // Early return if monitoring has been stopped
    // This prevents race conditions where checkForChanges
    // executes after stop() has been called
    if (!this.monitoring) {
      return
    }

    try {
      const currentDrives = await this.listRemovableDrives()

      // Check monitoring flag again after async operation
      if (!this.monitoring) {
        return
      }

      const currentDevices = new Set(currentDrives.map((d) => d.device))
      const previousDevices = new Set(this.lastDrives.keys())

      // Detect mountpoint changes on existing devices (e.g., SD card inserted/removed in a multi-slot reader)
      for (const device of currentDevices) {
        const prev = this.lastDrives.get(device)
        const curr = currentDrives.find((d) => d.device === device)
        if (!prev || !curr) continue

        const prevMounted = (prev.mountpoints || []).length > 0
        const currMounted = (curr.mountpoints || []).length > 0

        // Update cached entry with latest info
        this.lastDrives.set(device, curr)

        if (prevMounted && !currMounted) {
          // Treat as removal so UI clears state for this device
          if (this.onDriveRemoved && this.monitoring) {
            this.onDriveRemoved(device)
          }
        } else if (!prevMounted && currMounted) {
          // Treat as added so UI can select/scan again
          if (this.onDriveAdded && this.monitoring) {
            this.onDriveAdded(curr)
          }
        }
      }

      // Check for added drives
      for (const drive of currentDrives) {
        if (!previousDevices.has(drive.device)) {
          this.lastDrives.set(drive.device, drive)

          if (this.onDriveAdded && this.monitoring) {
            this.onDriveAdded(drive)
          }
        }
      }

      // Check for removed drives
      for (const device of previousDevices) {
        if (!currentDevices.has(device)) {
          this.lastDrives.delete(device)

          if (this.onDriveRemoved && this.monitoring) {
            this.onDriveRemoved(device)
          }
        }
      }
    } catch (error) {
      // Log error but don't stop monitoring (unless already stopped)
      if (this.monitoring) {
        getLogger().warn('Error checking for drive changes', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  /**
   * Recursively scan directory for files
   * Skips symlinks and special files to prevent loops and errors
   * @param filterByMediaExtensions When true, only includes files matching mediaExtensions
   */
  private async scanDirectory(
    dirPath: string,
    files: ScannedFile[],
    mediaExtensions: string[],
    filterByMediaExtensions: boolean,
    visitedInodes = new Set<string>()
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        try {
          // Use lstat to not follow symlinks
          const stats = await lstat(fullPath)

          // Skip symlinks to prevent infinite loops
          if (stats.isSymbolicLink()) {
            getLogger().debug('Skipping symlink during scan', { path: fullPath })
            continue
          }

          // Skip special files (devices, pipes, sockets)
          if (!stats.isFile() && !stats.isDirectory()) {
            getLogger().debug('Skipping special file during scan', {
              path: fullPath,
              type: stats.isBlockDevice()
                ? 'block-device'
                : stats.isCharacterDevice()
                  ? 'char-device'
                  : stats.isFIFO()
                    ? 'pipe'
                    : stats.isSocket()
                      ? 'socket'
                      : 'unknown'
            })
            continue
          }

          // Track visited inodes to prevent loops with hard links
          const inode = `${stats.dev}:${stats.ino}`
          if (visitedInodes.has(inode)) {
            getLogger().debug('Skipping already visited inode', { path: fullPath })
            continue
          }
          visitedInodes.add(inode)

          if (stats.isDirectory()) {
            // Recursively scan subdirectory
            getLogger().debug('[DriveMonitor] Scanning subdirectory', { path: fullPath })
            await this.scanDirectory(
              fullPath,
              files,
              mediaExtensions,
              filterByMediaExtensions,
              visitedInodes
            )
          } else if (stats.isFile()) {
            // Check if file should be included based on filter settings
            const ext = path.extname(entry.name).toLowerCase()
            const shouldInclude = !filterByMediaExtensions || mediaExtensions.includes(ext)

            if (shouldInclude) {
              getLogger().debug('[DriveMonitor] Found file', {
                file: entry.name,
                ext,
                filtered: filterByMediaExtensions
              })
              // Collect file metadata including creation date
              files.push({
                path: fullPath,
                size: stats.size,
                birthtime: stats.birthtime.getTime(), // Convert to milliseconds timestamp
                mtime: stats.mtime.getTime() // Convert to milliseconds timestamp
              })
            }
          }
        } catch (error) {
          // Skip files/directories that can't be accessed
          getLogger().warn('[DriveMonitor] Could not access path', {
            path: fullPath,
            error: error instanceof Error ? error.message : String(error)
          })
          continue
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
      getLogger().warn('[DriveMonitor] Could not read directory', {
        path: dirPath,
        error: error instanceof Error ? error.message : String(error)
      })
      return
    }
  }

  /**
   * Check if a drive is truly removable (not just marked as removable by the OS)
   * This filters out internal SATA drives that are incorrectly marked as removable
   */
  private isTrulyRemovableDrive(drive: DrivelistDrive): boolean {
    // First check basic removable and non-system criteria
    if (!drive.isRemovable || drive.isSystem) {
      return false
    }

    // Additional checks to filter out internal drives incorrectly marked as removable
    // Exclude SATA drives (internal storage)
    if (drive.busType === 'SATA' || drive.busType === 'ATA') {
      return false
    }

    // Exclude SCSI drives that are likely internal
    if (drive.isSCSI && !drive.isUSB && !drive.isCard) {
      return false
    }

    // Only include drives that are explicitly USB, card-based, or have mountable interfaces
    return (
      !!drive.isUSB ||
      !!drive.isCard ||
      !!drive.isUAS ||
      !!(drive.busType && !['SATA', 'ATA', 'SCSI'].includes(drive.busType))
    )
  }

  /**
   * Convert drivelist drive info to our DriveInfo format
   */
  private convertDriveInfo(drive: DrivelistDrive): DriveInfo {
    // Handle mountpoints that could be either { path: string; label?: string }[] or string[]
    const mountpointPaths = (drive.mountpoints || [])
      .map((mp) => {
        if (typeof mp === 'string') return mp
        return mp.path || ''
      })
      .filter(Boolean)

    // Extract first available volume label from mountpoints
    const volumeLabel =
      (drive.mountpoints || [])
        .filter(
          (mp): mp is { path: string; label?: string | null } =>
            typeof mp !== 'string' && !!mp.label
        )
        .map((mp) => mp.label)[0] || null

    return {
      device: drive.device || '',
      displayName: drive.description || drive.device || 'Unknown Drive',
      description: drive.description || '',
      mountpoints: mountpointPaths,
      size: drive.size ?? 0,
      isRemovable: drive.isRemovable || false,
      isSystem: drive.isSystem || false,
      busType: drive.busType || 'Unknown',
      volumeLabel
    }
  }
}

/**
 * Check if a drive is removable and not a system drive
 * Note: This function works with converted DriveInfo objects that may not have
 * the raw drivelist properties, so it uses the basic filtering logic.
 * For more precise filtering, use DriveMonitor.isTrulyRemovableDrive() with raw drive data.
 */
export function isRemovableDrive(drive: DriveInfo): boolean {
  return drive.isRemovable && !drive.isSystem
}

/**
 * List all removable drives (convenience function)
 */
export async function listRemovableDrives(): Promise<DriveInfo[]> {
  const monitor = new DriveMonitor()
  return monitor.listRemovableDrives()
}

/**
 * Scan a drive for media files (convenience function)
 */
export async function scanDriveForMedia(
  drivePath: string
): Promise<Omit<ScannedMedia, 'driveInfo'>> {
  const monitor = new DriveMonitor()
  return monitor.scanForMedia(drivePath)
}

/**
 * Get drive statistics (convenience function)
 */
export async function getDriveStats(mountPoint: string): Promise<DriveStats> {
  const monitor = new DriveMonitor()
  return monitor.getDriveStats(mountPoint)
}

/**
 * Unmount a drive (convenience function)
 */
export async function unmountDrive(device: string): Promise<boolean> {
  const monitor = new DriveMonitor()
  return monitor.unmountDrive(device)
}
