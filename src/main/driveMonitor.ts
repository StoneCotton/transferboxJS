/**
 * Drive Monitor Module
 * Detects and monitors removable storage devices (SD cards, USB drives)
 */

import * as drivelist from 'drivelist'
import { readdir, stat } from 'fs/promises'
import * as path from 'path'
import { DriveInfo, DriveStats, ScannedMedia } from '../shared/types'
import { getConfig } from './configManager'
import { checkDiskSpace } from './pathValidator'

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

    return drives.map((drive) => this.convertDriveInfo(drive))
  }

  /**
   * List only removable drives
   */
  async listRemovableDrives(): Promise<DriveInfo[]> {
    const allDrives = await this.listDrives()

    return allDrives.filter((drive) => drive.isRemovable && !drive.isSystem)
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
   * Scan a drive/directory for media files
   */
  async scanForMedia(drivePath: string): Promise<Omit<ScannedMedia, 'driveInfo'>> {
    const startTime = Date.now()
    const config = getConfig()
    const mediaExtensions = config.mediaExtensions.map((ext) => ext.toLowerCase())

    const files: string[] = []
    let totalSize = 0

    // Recursively scan directory
    await this.scanDirectory(drivePath, files, mediaExtensions)

    // Calculate total size
    for (const file of files) {
      try {
        const stats = await stat(file)
        totalSize += stats.size
      } catch (error) {
        // Skip files that can't be accessed
      }
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
   * Check for drive changes
   */
  private async checkForChanges(): Promise<void> {
    try {
      const currentDrives = await this.listRemovableDrives()
      const currentDevices = new Set(currentDrives.map((d) => d.device))
      const previousDevices = new Set(this.lastDrives.keys())

      // Check for added drives
      for (const drive of currentDrives) {
        if (!previousDevices.has(drive.device)) {
          this.lastDrives.set(drive.device, drive)

          if (this.onDriveAdded) {
            this.onDriveAdded(drive)
          }
        }
      }

      // Check for removed drives
      for (const device of previousDevices) {
        if (!currentDevices.has(device)) {
          this.lastDrives.delete(device)

          if (this.onDriveRemoved) {
            this.onDriveRemoved(device)
          }
        }
      }
    } catch (error) {
      // Log error but don't stop monitoring
      console.error('Error checking for drive changes:', error)
    }
  }

  /**
   * Recursively scan directory for media files
   */
  private async scanDirectory(
    dirPath: string,
    files: string[],
    mediaExtensions: string[]
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        try {
          if (entry.isDirectory()) {
            // Recursively scan subdirectory
            await this.scanDirectory(fullPath, files, mediaExtensions)
          } else if (entry.isFile()) {
            // Check if file has media extension
            const ext = path.extname(entry.name).toLowerCase()
            if (mediaExtensions.includes(ext)) {
              files.push(fullPath)
            }
          }
        } catch (error) {
          // Skip files/directories that can't be accessed
          continue
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
      return
    }
  }

  /**
   * Convert drivelist drive info to our DriveInfo format
   */
  private convertDriveInfo(drive: any): DriveInfo {
    return {
      device: drive.device || '',
      displayName: drive.description || drive.device || 'Unknown Drive',
      description: drive.description || '',
      mountpoints: (drive.mountpoints || []).map((mp: any) => mp.path || mp).filter(Boolean),
      size: drive.size || 0,
      isRemovable: drive.isRemovable || false,
      isSystem: drive.isSystem || false,
      busType: drive.busType || 'Unknown'
    }
  }
}

/**
 * Check if a drive is removable and not a system drive
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
