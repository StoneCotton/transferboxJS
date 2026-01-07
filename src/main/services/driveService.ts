/**
 * Drive Service
 * Business logic for drive operations
 */

import { IPC_CHANNELS } from '../../shared/types'
import { getLogger } from '../logger'
import { getDriveMonitor, getMainWindow } from '../ipc/state'

/**
 * Auto-unmount drive after successful transfer
 */
export async function autoUnmountDrive(
  driveDevice: string,
  sessionId: string
): Promise<void> {
  const logger = getLogger()
  const driveMonitor = getDriveMonitor()
  const mainWindow = getMainWindow()

  try {
    logger.info('Auto-unmounting drive after successful transfer', {
      device: driveDevice,
      sessionId
    })

    const unmountSuccess = await driveMonitor?.unmountDrive(driveDevice)

    if (unmountSuccess) {
      logger.info('Drive auto-unmounted successfully', {
        device: driveDevice,
        sessionId
      })

      if (mainWindow && !mainWindow.isDestroyed()) {
        if (process.platform === 'win32') {
          logger.debug('[DriveService] Sending DRIVE_REMOVED event (auto, win32)', {
            device: driveDevice
          })
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, driveDevice)
        } else {
          logger.debug('[DriveService] Sending DRIVE_UNMOUNTED event (auto)', {
            device: driveDevice
          })
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_UNMOUNTED, driveDevice)
        }
      } else {
        logger.warn('[DriveService] Cannot send drive event - mainWindow not available')
      }
    } else {
      logger.warn('Failed to auto-unmount drive', {
        device: driveDevice,
        sessionId
      })
    }
  } catch (unmountError) {
    logger.error('Error during auto-unmount', {
      device: driveDevice,
      sessionId,
      error: unmountError instanceof Error ? unmountError.message : String(unmountError)
    })
  }
}
