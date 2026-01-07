/**
 * Transfer IPC Handlers
 * Handles all TRANSFER_* IPC channels using TransferService
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS, DriveInfo, TransferErrorInfo } from '../../shared/types'
import { TransferErrorType } from '../../shared/types/transfer'
import { getDatabaseManager } from '../databaseManager'
import { getLogger } from '../logger'
import { validateTransferStartRequest } from '../utils/ipcValidator'
import { getTransferService } from '../services/transferService'
import { autoUnmountDrive } from '../services/driveService'
import { sendCompletionProgress } from '../services/progressService'
import { TransferError } from '../errors/TransferError'

/**
 * Create structured error info from an error object
 */
function createTransferErrorInfo(error: Error): TransferErrorInfo {
  if (error instanceof TransferError) {
    return {
      message: error.message,
      type: error.errorType
    }
  }
  return {
    message: error.message,
    type: TransferErrorType.UNKNOWN
  }
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
    const { transferFiles, fileSizes, totalBytes } = await transferService.prepareTransferFiles({
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
          startTime,
          validatedRequest.destinationRoot
        )

        // Auto-unmount on success
        if (failedCount === 0 && validatedRequest.driveInfo.device) {
          setImmediate(() => {
            autoUnmountDrive(validatedRequest.driveInfo.device, sessionId).catch((error) => {
              logger.error('Failed to auto-unmount drive after transfer', {
                device: validatedRequest.driveInfo.device,
                sessionId,
                error: error instanceof Error ? error.message : String(error)
              })
            })
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
        event.sender.send(IPC_CHANNELS.TRANSFER_ERROR, createTransferErrorInfo(error))
      }
    )
  })

  // Stop transfer handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_STOP, async () => {
    const transferService = getTransferService()
    await transferService.stop()
    logger.info('Transfer stopped by user')
  })

  // Pause transfer handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_PAUSE, async (event) => {
    const transferService = getTransferService()
    transferService.pause()
    logger.info('Transfer paused by user')
    // Notify renderer of pause
    event.sender.send(IPC_CHANNELS.TRANSFER_PAUSED)
  })

  // Resume transfer handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_RESUME, async (event) => {
    const transferService = getTransferService()
    transferService.resume()
    logger.info('Transfer resumed by user')
    // Notify renderer of resume
    event.sender.send(IPC_CHANNELS.TRANSFER_RESUMED)
  })

  // Transfer status handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_STATUS, async () => {
    const transferService = getTransferService()
    return {
      isTransferring: transferService.isTransferring(),
      isPaused: transferService.isPaused()
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
        const { completedCount: _completedCount, failedCount } =
          transferService.updateSessionCompletion(sessionId, results, startTime, destRoot)

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
        event.sender.send(IPC_CHANNELS.TRANSFER_ERROR, createTransferErrorInfo(error))
      }
    )
  })
}
