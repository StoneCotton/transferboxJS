/**
 * Transfer IPC Handlers
 * Handles all TRANSFER_* IPC channels using TransferService
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS, DriveInfo } from '../../shared/types'
import { getConfig } from '../configManager'
import { getDatabaseManager } from '../databaseManager'
import { getLogger } from '../logger'
import { validateTransferStartRequest } from '../utils/ipcValidator'
import { getTransferService, TransferProgressData } from '../services/transferService'
import { getDriveMonitor, getMainWindow } from './state'

/**
 * Auto-unmount drive after successful transfer
 */
async function autoUnmountDrive(driveDevice: string, sessionId: string): Promise<void> {
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
          logger.debug('[IPC] Sending DRIVE_REMOVED event (auto, win32)', {
            device: driveDevice
          })
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, driveDevice)
        } else {
          logger.debug('[IPC] Sending DRIVE_UNMOUNTED event (auto)', {
            device: driveDevice
          })
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_UNMOUNTED, driveDevice)
        }
      } else {
        logger.warn('[IPC] Cannot send drive event - mainWindow not available')
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

/**
 * Send final progress update on completion
 */
function sendCompletionProgress(
  sender: Electron.WebContents,
  context: {
    totalFiles: number
    totalBytes: number
    startTime: number
    sessionId: string
    completedCount: number
    failedCount: number
  }
): void {
  const db = getDatabaseManager()
  const completedFiles = db.getFilesByStatus(context.sessionId, 'complete')
  const failedFiles = db.getFilesByStatus(context.sessionId, 'error')

  const progressData: TransferProgressData = {
    status: context.failedCount > 0 ? 'error' : 'complete',
    totalFiles: context.totalFiles,
    completedFilesCount: context.completedCount,
    failedFiles: context.failedCount,
    skippedFiles: 0,
    totalBytes: context.totalBytes,
    transferredBytes: context.totalBytes,
    overallPercentage: 100,
    currentFile: null,
    activeFiles: [],
    completedFiles: [...completedFiles, ...failedFiles].map((f) => ({
      sourcePath: f.sourcePath,
      destinationPath: f.destinationPath,
      fileName: f.fileName,
      fileSize: f.fileSize,
      bytesTransferred: f.bytesTransferred,
      percentage: f.percentage,
      status: f.status as 'complete' | 'error' | 'skipped',
      error: f.error,
      checksum: f.checksum
    })),
    transferSpeed: 0,
    averageSpeed: 0,
    eta: 0,
    elapsedTime: (Date.now() - context.startTime) / 1000,
    startTime: context.startTime,
    endTime: Date.now(),
    errorCount: context.failedCount
  }

  sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, progressData)
}

/**
 * Setup all transfer-related IPC handlers
 */
export function setupTransferHandlers(): void {
  const logger = getLogger()

  // Pre-transfer validation handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_VALIDATE, async (_, request: unknown) => {
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid validation request')
    }

    const reqObj = request as Record<string, unknown>
    if (!reqObj.sourceRoot || typeof reqObj.sourceRoot !== 'string') {
      throw new Error('sourceRoot is required and must be a string')
    }
    if (!reqObj.destinationRoot || typeof reqObj.destinationRoot !== 'string') {
      throw new Error('destinationRoot is required and must be a string')
    }
    if (!Array.isArray(reqObj.files)) {
      throw new Error('files must be an array')
    }

    logger.debug('[IPC] Transfer validation requested', {
      sourceRoot: reqObj.sourceRoot,
      destinationRoot: reqObj.destinationRoot,
      fileCount: reqObj.files.length
    })

    const driveInfo = reqObj.driveInfo as DriveInfo | undefined
    const transferService = getTransferService()

    return transferService.validateTransferRequest(
      reqObj.sourceRoot as string,
      reqObj.destinationRoot as string,
      reqObj.files as string[],
      driveInfo
    )
  })

  // Main transfer start handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, request: unknown) => {
    const transferService = getTransferService()

    // Prevent concurrent transfers
    if (transferService.isTransferring()) {
      const errorMessage =
        'A transfer is already in progress. Please wait for it to complete or cancel it first.'
      logger.warn('Transfer start blocked - transfer already in progress')
      throw new Error(errorMessage)
    }

    logger.debug('[IPC] Transfer start requested', {
      hasRequest: !!request,
      requestType: typeof request
    })

    // Validate request
    let validatedRequest
    try {
      validatedRequest = validateTransferStartRequest(request)
      logger.debug('[IPC] Transfer request validated successfully', {
        sourceRoot: validatedRequest.sourceRoot,
        destinationRoot: validatedRequest.destinationRoot,
        fileCount: validatedRequest.files.length,
        driveDevice: validatedRequest.driveInfo.device
      })
    } catch (error) {
      logger.error('[IPC] Transfer request validation failed', {
        error: error instanceof Error ? error.message : String(error),
        requestData: request ? JSON.stringify(request, null, 2) : 'null'
      })
      throw error
    }

    // Reset transfer engine
    transferService.reset()

    // Get conflict resolutions from request
    const conflictResolutions = (validatedRequest as Record<string, unknown>)
      .conflictResolutions as Record<string, 'skip' | 'rename' | 'overwrite'> | undefined

    // Prepare files for transfer
    const { transferFiles, fileSizes, totalBytes, skippedCount } =
      await transferService.prepareTransferFiles({
        sourceRoot: validatedRequest.sourceRoot,
        destinationRoot: validatedRequest.destinationRoot,
        files: validatedRequest.files,
        driveInfo: validatedRequest.driveInfo,
        conflictResolutions
      })

    // Validate disk space
    await transferService.validateDiskSpace(validatedRequest.destinationRoot, totalBytes)

    // Create session
    const sessionId = transferService.createSession(
      {
        sourceRoot: validatedRequest.sourceRoot,
        destinationRoot: validatedRequest.destinationRoot,
        files: validatedRequest.files,
        driveInfo: validatedRequest.driveInfo
      },
      transferFiles.length,
      totalBytes
    )

    // Add files to session
    transferService.addFilesToSession(sessionId, transferFiles, fileSizes)

    const startTime = Date.now()
    const totalFiles = transferFiles.length

    // Execute transfer
    transferService.executeTransfer(
      {
        sessionId,
        totalFiles,
        totalBytes,
        startTime,
        fileSizes,
        transferFiles
      },
      // Progress callback
      (progress) => {
        event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, progress)
      },
      // Complete callback
      (results) => {
        const { completedCount, failedCount } = transferService.updateSessionCompletion(
          sessionId,
          results,
          startTime
        )

        // Auto-unmount on success
        if (failedCount === 0 && validatedRequest.driveInfo.device) {
          setImmediate(() => {
            autoUnmountDrive(validatedRequest.driveInfo.device, sessionId)
          })
        }

        // Send final progress
        sendCompletionProgress(event.sender, {
          totalFiles,
          totalBytes,
          startTime,
          sessionId,
          completedCount,
          failedCount
        })

        // Send completion event
        event.sender.send(IPC_CHANNELS.TRANSFER_COMPLETE, {
          id: sessionId,
          status: failedCount > 0 ? 'error' : 'complete'
        })
      },
      // Error callback
      (error) => {
        transferService.updateSessionError(sessionId, error.message)
        event.sender.send(IPC_CHANNELS.TRANSFER_ERROR, error.message)
      }
    )
  })

  // Stop transfer handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_STOP, async () => {
    const transferService = getTransferService()
    await transferService.stop()
    logger.info('Transfer stopped by user')
  })

  // Transfer status handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_STATUS, async () => {
    const transferService = getTransferService()
    return {
      isTransferring: transferService.isTransferring()
    }
  })

  // Retry failed files handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_RETRY, async (event, request: unknown) => {
    const transferService = getTransferService()

    // Prevent concurrent transfers
    if (transferService.isTransferring()) {
      const errorMessage =
        'A transfer is already in progress. Please wait for it to complete or cancel it first.'
      logger.warn('Retry blocked - transfer already in progress')
      throw new Error(errorMessage)
    }

    // Validate request structure
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid retry request')
    }
    const reqObj = request as Record<string, unknown>
    if (!Array.isArray(reqObj.files) || reqObj.files.length === 0) {
      throw new Error('No files to retry')
    }
    if (!reqObj.driveInfo || typeof reqObj.driveInfo !== 'object') {
      throw new Error('Invalid drive info for retry')
    }

    const files = reqObj.files as Array<{ sourcePath: string; destinationPath: string }>
    const driveInfo = reqObj.driveInfo as {
      device: string
      displayName: string
      mountpoints?: string[]
    }

    logger.info('Starting retry of failed files', {
      fileCount: files.length,
      driveDevice: driveInfo.device
    })

    // Reset and prepare
    transferService.reset()

    const transferFiles = files.map((f) => ({
      source: f.sourcePath,
      dest: f.destinationPath
    }))

    // Get file sizes
    const { stat } = await import('fs/promises')
    const fileSizes = await Promise.all(
      transferFiles.map(async (f) => {
        try {
          const stats = await stat(f.source)
          return stats.size
        } catch {
          return 0
        }
      })
    )

    const { safeSum } = await import('../utils/fileSizeUtils')
    const totalBytes = safeSum(fileSizes)
    const totalFiles = transferFiles.length
    const startTime = Date.now()

    // Determine roots from file paths
    const sourceRoot =
      transferFiles[0]?.source.substring(0, transferFiles[0].source.lastIndexOf('/')) || ''
    const destRoot =
      transferFiles[0]?.dest.substring(0, transferFiles[0].dest.lastIndexOf('/')) || ''

    // Create session for retry
    const db = getDatabaseManager()
    const sessionId = db.createTransferSession({
      driveId: driveInfo.device,
      driveName: driveInfo.displayName,
      sourceRoot,
      destinationRoot: destRoot,
      status: 'transferring',
      startTime,
      endTime: null,
      fileCount: totalFiles,
      totalBytes,
      files: []
    })

    logger.info('Retry session created', {
      sessionId,
      fileCount: totalFiles,
      totalBytes
    })

    // Add files to session
    transferFiles.forEach((file, index) => {
      const fileName = file.source.split('/').pop() || 'file'
      const fileSize = fileSizes[index]

      db.addFileToSession(sessionId, {
        sourcePath: file.source,
        destinationPath: file.dest,
        fileName,
        fileSize,
        bytesTransferred: 0,
        percentage: 0,
        status: 'pending',
        startTime: Date.now(),
        retryCount: 1
      })
    })

    // Execute transfer
    transferService.executeTransfer(
      {
        sessionId,
        totalFiles,
        totalBytes,
        startTime,
        fileSizes,
        transferFiles
      },
      // Progress callback
      (progress) => {
        event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, progress)
      },
      // Complete callback
      (results) => {
        const { completedCount, failedCount } = transferService.updateSessionCompletion(
          sessionId,
          results,
          startTime
        )

        // Send completion event
        event.sender.send(IPC_CHANNELS.TRANSFER_COMPLETE, {
          id: sessionId,
          status: failedCount > 0 ? 'error' : 'complete',
          driveId: driveInfo.device,
          driveName: driveInfo.displayName,
          sourceRoot,
          destinationRoot: destRoot,
          fileCount: totalFiles,
          totalBytes,
          startTime,
          endTime: Date.now(),
          errorMessage: failedCount > 0 ? `${failedCount} file(s) failed during retry` : undefined
        })
      },
      // Error callback
      (error) => {
        transferService.updateSessionError(sessionId, error.message)
        event.sender.send(IPC_CHANNELS.TRANSFER_ERROR, error.message)
      }
    )
  })
}
