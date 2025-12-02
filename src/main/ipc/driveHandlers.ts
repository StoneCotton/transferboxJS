/**
 * Drive IPC Handlers
 * Handles all DRIVE_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { DriveMonitor } from '../driveMonitor'
import { getConfig } from '../configManager'
import { getLogger } from '../logger'
import { validateDeviceId } from '../utils/ipcValidator'
import { getDriveMonitor, setDriveMonitor, getMainWindow } from './state'

/**
 * Ensure drive monitor instance exists
 */
function ensureDriveMonitor(): DriveMonitor {
  let monitor = getDriveMonitor()
  if (!monitor) {
    monitor = new DriveMonitor()
    setDriveMonitor(monitor)
  }
  return monitor
}

/**
 * Setup all drive-related IPC handlers
 */
export function setupDriveHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DRIVE_LIST, async () => {
    const monitor = ensureDriveMonitor()
    return monitor.listRemovableDrives()
  })

  ipcMain.handle(IPC_CHANNELS.DRIVE_SCAN, async (_, device: unknown) => {
    const validatedDevice = validateDeviceId(device)
    const monitor = ensureDriveMonitor()

    // Retry mechanism for drives that are detected but not yet mounted
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 1000
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const drives = await monitor.listRemovableDrives()
        const drive = drives.find((d) => d.device === validatedDevice)

        if (!drive) {
          throw new Error('Drive not found')
        }

        if (drive.mountpoints.length === 0) {
          throw new Error('Drive not mounted yet')
        }

        const config = getConfig()
        getLogger().debug('[IPC] Scanning drive', { mediaExtensions: config.mediaExtensions })
        const result = await monitor.scanForMedia(drive.mountpoints[0])
        getLogger().info('[IPC] Scan complete', { fileCount: result.fileCount })

        return {
          driveInfo: drive,
          ...result
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // If drive not found (disconnected), don't retry
        if (lastError.message.includes('Drive not found')) {
          throw lastError
        }

        // If not mounted yet and we have retries left, wait and retry
        if (attempt < MAX_RETRIES - 1 && lastError.message.includes('not mounted')) {
          getLogger().info('[IPC] Drive detected but not mounted yet, waiting for OS to mount', {
            device: validatedDevice,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            retryDelayMs: RETRY_DELAY_MS,
            remainingTime: `${((MAX_RETRIES - attempt - 1) * RETRY_DELAY_MS) / 1000}s`
          })
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        // Other errors or out of retries
        if (lastError.message.includes('not mounted')) {
          getLogger().error('[IPC] Drive mount timeout - drive not mounted within retry window', {
            device: validatedDevice,
            attemptsUsed: MAX_RETRIES,
            totalTimeWaited: `${(MAX_RETRIES * RETRY_DELAY_MS) / 1000}s`,
            suggestion: 'Drive may need more time to mount or there may be a hardware issue'
          })
        }
        throw lastError
      }
    }

    throw lastError || new Error('Drive scan failed after all retry attempts')
  })

  ipcMain.handle(IPC_CHANNELS.DRIVE_UNMOUNT, async (_, device: unknown) => {
    const validatedDevice = validateDeviceId(device)
    getLogger().info('Drive unmount requested', { device: validatedDevice })

    try {
      const monitor = getDriveMonitor()
      const success = (await monitor?.unmountDrive(validatedDevice)) || false

      if (success) {
        getLogger().info('Drive unmounted successfully', { device: validatedDevice })

        // Notify renderer
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (process.platform === 'win32') {
            getLogger().debug('[IPC] Sending DRIVE_REMOVED event (win32)', {
              device: validatedDevice
            })
            mainWindow.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, validatedDevice)
          } else {
            getLogger().debug('[IPC] Sending DRIVE_UNMOUNTED event', { device: validatedDevice })
            mainWindow.webContents.send(IPC_CHANNELS.DRIVE_UNMOUNTED, validatedDevice)
          }
        } else {
          getLogger().warn('[IPC] Cannot send drive event - mainWindow not available')
        }
      } else {
        getLogger().warn('Failed to unmount drive', { device: validatedDevice })
      }

      return success
    } catch (error) {
      getLogger().error('Error unmounting drive', {
        device: validatedDevice,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  })
}
