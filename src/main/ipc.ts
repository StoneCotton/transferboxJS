/**
 * IPC Communication Setup
 * Handles communication between main and renderer processes
 */

import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS, PathValidationRequest, TransferStartRequest } from '../shared/types'
import { validatePath } from './pathValidator'
import { getConfig, updateConfig, resetConfig } from './configManager'
import { DriveMonitor } from './driveMonitor'
import { FileTransferEngine } from './fileTransfer'
import { getDatabaseManager } from './databaseManager'
import { getLogger } from './logger'

// Global instances
let driveMonitor: DriveMonitor | null = null
let transferEngine: FileTransferEngine | null = null

/**
 * Setup all IPC handlers
 * Call this once when the app starts
 */
export function setupIpcHandlers(): void {
  // Configuration handlers
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, async (_, config) => {
    return updateConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async () => {
    return resetConfig()
  })

  // Path validation handlers
  ipcMain.handle(IPC_CHANNELS.PATH_VALIDATE, async (_, request: PathValidationRequest) => {
    return validatePath(request.path)
  })

  ipcMain.handle(IPC_CHANNELS.PATH_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Drive operations handlers
  ipcMain.handle(IPC_CHANNELS.DRIVE_LIST, async () => {
    if (!driveMonitor) {
      driveMonitor = new DriveMonitor()
    }
    return driveMonitor.listRemovableDrives()
  })

  ipcMain.handle(IPC_CHANNELS.DRIVE_SCAN, async (_, device: string) => {
    if (!driveMonitor) {
      driveMonitor = new DriveMonitor()
    }

    // Find the drive and scan it
    const drives = await driveMonitor.listRemovableDrives()
    const drive = drives.find((d) => d.device === device)

    if (!drive || drive.mountpoints.length === 0) {
      throw new Error('Drive not found or not mounted')
    }

    const result = await driveMonitor.scanForMedia(drive.mountpoints[0])

    return {
      driveInfo: drive,
      ...result
    }
  })

  ipcMain.handle(IPC_CHANNELS.DRIVE_UNMOUNT, async (_, device: string) => {
    // Note: Safe unmounting is platform-specific and requires additional implementation
    // For now, return success
    getLogger().info('Drive unmount requested', { device })
    return true
  })

  // Transfer operations handlers
  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, request: TransferStartRequest) => {
    if (!transferEngine) {
      transferEngine = new FileTransferEngine()
    } else {
      transferEngine.reset()
    }

    const db = getDatabaseManager()
    const logger = getLogger()

    // Create transfer session
    const sessionId = db.createTransferSession({
      driveId: request.driveInfo.device,
      driveName: request.driveInfo.displayName,
      sourceRoot: request.sourceRoot,
      destinationRoot: request.destinationRoot,
      startTime: Date.now(),
      endTime: null,
      status: 'transferring',
      fileCount: request.files.length,
      totalBytes: 0,
      files: []
    })

    logger.logTransferStart(
      sessionId,
      request.driveInfo.device,
      request.sourceRoot,
      request.destinationRoot
    )

    // Start transfer in background
    const transferFiles = request.files.map((sourcePath) => {
      // Calculate destination path
      const fileName = sourcePath.split('/').pop() || 'file'
      const destPath = `${request.destinationRoot}/${fileName}`

      return { source: sourcePath, dest: destPath }
    })

    // Transfer files with progress updates
    transferEngine
      .transferFiles(transferFiles, {
        verifyChecksum: getConfig().verifyChecksums,
        onProgress: (progress) => {
          // Send progress to renderer
          event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
            ...progress,
            status: 'transferring'
          })
        }
      })
      .then((results) => {
        const completedCount = results.filter((r) => r.success).length
        const failedCount = results.filter((r) => !r.success).length

        // Update session
        db.updateTransferSession(sessionId, {
          status: failedCount > 0 ? 'error' : 'complete',
          endTime: Date.now()
        })

        logger.logTransferComplete(sessionId, completedCount, 0)

        // Send completion event
        event.sender.send(IPC_CHANNELS.TRANSFER_COMPLETE, {
          id: sessionId,
          status: failedCount > 0 ? 'error' : 'complete'
        })
      })
      .catch((error) => {
        // Update session with error
        db.updateTransferSession(sessionId, {
          status: 'error',
          endTime: Date.now(),
          errorMessage: error.message
        })

        logger.logTransferError(sessionId, error.message)

        // Send error event
        event.sender.send(IPC_CHANNELS.TRANSFER_ERROR, error.message)
      })
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER_STOP, async () => {
    if (transferEngine) {
      transferEngine.stop()
      getLogger().info('Transfer stopped by user')
    }
  })

  // Transfer history handlers
  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_ALL, async () => {
    const db = getDatabaseManager()
    return db.getAllTransferSessions()
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_BY_ID, async (_, id: string) => {
    const db = getDatabaseManager()
    return db.getTransferSession(id)
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async () => {
    // Not implemented for safety - users shouldn't delete transfer history easily
    getLogger().warn('History clear requested but not implemented')
  })

  // Logging handlers
  ipcMain.handle(IPC_CHANNELS.LOG_GET_RECENT, async (_, limit?: number) => {
    return getLogger().getRecent(limit || 100)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, async () => {
    getLogger().clear()
  })

  // System handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_SHUTDOWN, async () => {
    const { app } = require('electron')
    app.quit()
  })
}

/**
 * Start drive monitoring with IPC events
 */
export function startDriveMonitoring(window: Electron.BrowserWindow): void {
  if (driveMonitor) {
    driveMonitor.stop()
  }

  driveMonitor = new DriveMonitor()

  driveMonitor
    .start({
      pollingInterval: 2000,
      onDriveAdded: (drive) => {
        getLogger().logDriveDetected(drive.device, drive.displayName)
        window.webContents.send(IPC_CHANNELS.DRIVE_DETECTED, drive)
      },
      onDriveRemoved: (device) => {
        getLogger().logDriveRemoved(device)
        window.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, device)
      }
    })
    .catch((error) => {
      getLogger().error('Failed to start drive monitoring', { error: error.message })
    })
}

/**
 * Stop drive monitoring
 */
export function stopDriveMonitoring(): void {
  if (driveMonitor) {
    driveMonitor.stop()
    driveMonitor = null
  }
}

/**
 * Cleanup IPC handlers
 * Call this when the app is closing
 */
export function cleanupIpc(): void {
  stopDriveMonitoring()

  if (transferEngine) {
    transferEngine.stop()
    transferEngine = null
  }

  // Remove all handlers
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel)
  })
}
