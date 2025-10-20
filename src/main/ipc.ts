/**
 * IPC Communication Setup
 * Handles communication between main and renderer processes
 */

import { ipcMain, dialog } from 'electron'
import { stat } from 'fs/promises'
import { IPC_CHANNELS, PathValidationRequest, TransferStartRequest } from '../shared/types'
import { validatePath, hasEnoughSpace, checkDiskSpace } from './pathValidator'
import { getConfig, updateConfig, resetConfig, forceMigration } from './configManager'
import { DriveMonitor } from './driveMonitor'
import { FileTransferEngine } from './fileTransfer'
import { getDatabaseManager } from './databaseManager'
import { getLogger } from './logger'
import { createPathProcessor, type PathProcessor } from './pathProcessor'

// Global instances
let driveMonitor: DriveMonitor | null = null
let transferEngine: FileTransferEngine | null = null
let pathProcessor: PathProcessor | null = null
let mainWindow: Electron.BrowserWindow | null = null

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

  ipcMain.handle(IPC_CHANNELS.CONFIG_MIGRATE, async () => {
    return forceMigration()
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

    // Retry mechanism for drives that are detected but not yet mounted
    const MAX_RETRIES = 5
    const RETRY_DELAY_MS = 500
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Find the drive and scan it
        const drives = await driveMonitor.listRemovableDrives()
        const drive = drives.find((d) => d.device === device)

        if (!drive) {
          throw new Error('Drive not found')
        }

        if (drive.mountpoints.length === 0) {
          throw new Error('Drive not mounted yet')
        }

        const config = getConfig()
        console.log('[IPC] Scanning drive with mediaExtensions:', config.mediaExtensions)
        const result = await driveMonitor.scanForMedia(drive.mountpoints[0])
        console.log('[IPC] Scan complete. Found files:', result.fileCount)

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
          console.log(
            `[IPC] Drive not mounted yet, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          )
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        // Other errors or out of retries
        throw lastError
      }
    }

    throw lastError || new Error('Drive scan failed')
  })

  ipcMain.handle(IPC_CHANNELS.DRIVE_UNMOUNT, async (_, device: string) => {
    getLogger().info('Drive unmount requested', { device })

    try {
      const success = (await driveMonitor?.unmountDrive(device)) || false

      if (success) {
        getLogger().info('Drive unmounted successfully', { device })

        // Notify renderer that drive was unmounted
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('[IPC] Sending DRIVE_UNMOUNTED event for device:', device)
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_UNMOUNTED, device)
        } else {
          console.warn('[IPC] Cannot send DRIVE_UNMOUNTED - mainWindow not available')
        }
      } else {
        getLogger().warn('Failed to unmount drive', { device })
      }

      return success
    } catch (error) {
      getLogger().error('Error unmounting drive', {
        device,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  })

  // Transfer operations handlers
  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, request: TransferStartRequest) => {
    if (!transferEngine) {
      transferEngine = new FileTransferEngine()
    } else {
      transferEngine.reset()
    }

    // Initialize path processor with current config
    const config = getConfig()
    pathProcessor = createPathProcessor(config)

    const db = getDatabaseManager()
    const logger = getLogger()

    // Filter files based on media extensions if enabled
    const filteredFiles = request.files.filter((file) => pathProcessor!.shouldTransferFile(file))

    // Process file paths using configuration
    const transferFiles = await Promise.all(
      filteredFiles.map(async (sourcePath) => {
        try {
          console.log(`[IPC] Processing path: ${sourcePath}`)
          const processedPath = await pathProcessor!.processFilePath(
            sourcePath,
            request.destinationRoot,
            request.driveInfo.displayName
          )
          console.log(`[IPC] Processed path result: ${processedPath.destinationPath}`)
          return { source: sourcePath, dest: processedPath.destinationPath }
        } catch (error) {
          console.error(`Failed to process path for ${sourcePath}:`, error)
          // Fallback to simple filename if processing fails
          const fileName = sourcePath.split('/').pop() || 'file'
          const destPath = `${request.destinationRoot}/${fileName}`
          console.log(`[IPC] Using fallback path: ${destPath}`)
          return { source: sourcePath, dest: destPath }
        }
      })
    )

    // Get all file sizes upfront for accurate overall progress
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

    const totalBytes = fileSizes.reduce((sum, size) => sum + size, 0)

    // Validate sufficient disk space
    const hasSpace = await hasEnoughSpace(request.destinationRoot, totalBytes)
    if (!hasSpace) {
      const spaceInfo = await checkDiskSpace(request.destinationRoot)
      const errorMessage = `Insufficient disk space. Required: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB, Available: ${(spaceInfo.freeSpace / (1024 * 1024 * 1024)).toFixed(2)} GB`
      getLogger().error('Pre-transfer validation failed - insufficient space', {
        required: totalBytes,
        available: spaceInfo.freeSpace,
        destination: request.destinationRoot
      })
      throw new Error(errorMessage)
    }

    // Create transfer session
    const sessionId = db.createTransferSession({
      driveId: request.driveInfo.device,
      driveName: request.driveInfo.displayName,
      sourceRoot: request.sourceRoot,
      destinationRoot: request.destinationRoot,
      startTime: Date.now(),
      endTime: null,
      status: 'transferring',
      fileCount: filteredFiles.length,
      totalBytes: totalBytes,
      files: []
    })

    logger.logTransferStart(
      sessionId,
      request.driveInfo.device,
      request.sourceRoot,
      request.destinationRoot
    )

    // Track overall progress
    const startTime = Date.now()
    let currentFileIndex = 0
    const totalFiles = transferFiles.length

    // Track current file state
    let currentFilePhase: 'transferring' | 'verifying' = 'transferring'

    // Add all files to database initially as pending
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
        startTime: Date.now()
      })
    })

    // Track completed file results for real-time database updates
    const completedFileResults = new Map<
      number,
      { success: boolean; checksum?: string; error?: string }
    >()

    // Transfer files with progress updates
    transferEngine
      .transferFiles(transferFiles, {
        verifyChecksum: getConfig().verifyChecksums,
        onProgress: (progress) => {
          // This is now enhanced progress with individual file information
          currentFilePhase = 'transferring'

          // Use the progress values directly from the file transfer engine
          // The progress object already contains aggregated values from all active transfers
          const overallBytesTransferred = progress.bytesTransferred
          const overallPercentage = progress.percentage

          // Calculate speeds and ETA
          const elapsedTime = (Date.now() - startTime) / 1000 // seconds
          const averageSpeed = elapsedTime > 0 ? overallBytesTransferred / elapsedTime : 0
          const remainingBytes = totalBytes - overallBytesTransferred
          const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0

          // Calculate total estimated duration
          const totalDuration = averageSpeed > 0 ? totalBytes / averageSpeed : 0

          // Convert activeFiles from the enhanced progress to the format expected by the UI
          const enhancedProgress = progress as {
            activeFiles?: Array<{
              index: number
              fileName: string
              fileSize: number
              bytesTransferred: number
              percentage: number
              speed: number
              status: string
              startTime?: number
              duration?: number
              remainingTime?: number
            }>
          }
          const activeFiles =
            enhancedProgress.activeFiles?.map((file) => ({
              sourcePath: transferFiles[file.index]?.source || '',
              destinationPath: transferFiles[file.index]?.dest || '',
              fileName: file.fileName,
              fileSize: file.fileSize,
              bytesTransferred: file.bytesTransferred,
              percentage: file.percentage,
              speed: file.speed,
              status: file.status,
              startTime: file.startTime,
              duration: file.duration,
              remainingTime: file.remainingTime
            })) || []

          // Get completed files from database
          const completedFiles = db.getFilesByStatus(sessionId, 'complete')
          const failedFilesList = db.getFilesByStatus(sessionId, 'error')

          // Send enhanced progress with individual file information
          event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
            status: 'transferring',
            totalFiles,
            completedFilesCount: currentFileIndex,
            failedFiles: failedFilesList.length,
            skippedFiles: 0,
            totalBytes,
            transferredBytes: overallBytesTransferred,
            overallPercentage,
            activeFiles, // Array of currently active files with individual progress
            completedFiles: [...completedFiles, ...failedFilesList],
            currentFile:
              activeFiles.length > 0
                ? activeFiles[0]
                : {
                    sourcePath: transferFiles[currentFileIndex]?.source || '',
                    destinationPath: transferFiles[currentFileIndex]?.dest || '',
                    fileName: transferFiles[currentFileIndex]?.source.split('/').pop() || '',
                    fileSize: 0,
                    bytesTransferred: 0,
                    percentage: 0,
                    status: currentFilePhase,
                    startTime
                  },
            transferSpeed: progress.speed,
            averageSpeed,
            eta,
            elapsedTime,
            totalDuration,
            startTime,
            endTime: null,
            errorCount: failedFilesList.length
          })
        },
        onChecksumProgress: () => {
          // Simple checksum progress - just update phase
          currentFilePhase = 'verifying'
        },
        onBatchProgress: (completed) => {
          currentFileIndex = completed
        },
        onFileComplete: (fileIndex, result) => {
          // NEW: Real-time database update when each file completes
          const file = transferFiles[fileIndex]
          const status = result.success ? 'complete' : 'error'
          const checksum = result.success ? result.sourceChecksum : undefined

          // Track this completion
          completedFileResults.set(fileIndex, {
            success: result.success,
            checksum,
            error: result.error
          })

          // Update database immediately
          db.updateFileStatus(sessionId, file.source, {
            status,
            checksum,
            bytesTransferred: result.bytesTransferred,
            percentage: 100,
            endTime: Date.now(),
            duration: result.duration / 1000, // Convert from milliseconds to seconds
            error: result.success ? undefined : result.error
          })

          // Trigger a progress update to refresh the UI with new completedFiles
          const completedFiles = db.getFilesByStatus(sessionId, 'complete')
          const failedFilesList = db.getFilesByStatus(sessionId, 'error')

          const bytesCompletedPreviously = fileSizes
            .slice(0, fileIndex + 1)
            .reduce((sum, size) => sum + size, 0)
          const overallBytesTransferred = bytesCompletedPreviously
          const overallPercentage =
            totalBytes > 0 ? (overallBytesTransferred / totalBytes) * 100 : 0

          const elapsedTime = (Date.now() - startTime) / 1000
          const averageSpeed = elapsedTime > 0 ? overallBytesTransferred / elapsedTime : 0
          const remainingBytes = totalBytes - overallBytesTransferred
          const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0

          event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
            status: 'transferring',
            totalFiles,
            completedFilesCount: completedFileResults.size,
            failedFiles: failedFilesList.length,
            skippedFiles: 0,
            totalBytes,
            transferredBytes: overallBytesTransferred,
            overallPercentage,
            activeFiles: [],
            completedFiles: [...completedFiles, ...failedFilesList],
            currentFile: null,
            transferSpeed: 0,
            averageSpeed,
            eta,
            elapsedTime,
            startTime,
            endTime: null,
            errorCount: failedFilesList.length
          })
        }
      })
      .then((results) => {
        const completedCount = results.filter((r) => r.success).length
        const failedCount = results.filter((r) => !r.success).length

        // Update individual file statuses in database
        results.forEach((result) => {
          const status = result.success ? 'complete' : 'error'
          const checksum = result.success ? result.sourceChecksum : undefined

          db.updateFileStatus(sessionId, result.sourcePath, {
            status,
            checksum,
            bytesTransferred: result.bytesTransferred,
            percentage: 100,
            endTime: Date.now(),
            error: result.success ? undefined : result.error
          })
        })

        // Update session
        db.updateTransferSession(sessionId, {
          status: failedCount > 0 ? 'error' : 'complete',
          endTime: Date.now()
        })

        logger.logTransferComplete(sessionId, completedCount, 0)

        // Automatically unmount the drive after successful transfer
        if (failedCount === 0 && request.driveInfo.device) {
          // Run unmount asynchronously without blocking the completion event
          setImmediate(async () => {
            try {
              logger.info('Auto-unmounting drive after successful transfer', {
                device: request.driveInfo.device,
                sessionId
              })

              const unmountSuccess = await driveMonitor?.unmountDrive(request.driveInfo.device)

              if (unmountSuccess) {
                logger.info('Drive auto-unmounted successfully', {
                  device: request.driveInfo.device,
                  sessionId
                })

                // Notify renderer that drive was unmounted
                if (mainWindow && !mainWindow.isDestroyed()) {
                  console.log(
                    '[IPC] Sending DRIVE_UNMOUNTED event for auto-unmounted device:',
                    request.driveInfo.device
                  )
                  mainWindow.webContents.send(
                    IPC_CHANNELS.DRIVE_UNMOUNTED,
                    request.driveInfo.device
                  )
                } else {
                  console.warn('[IPC] Cannot send DRIVE_UNMOUNTED - mainWindow not available')
                }
              } else {
                logger.warn('Failed to auto-unmount drive', {
                  device: request.driveInfo.device,
                  sessionId
                })
              }
            } catch (unmountError) {
              logger.error('Error during auto-unmount', {
                device: request.driveInfo.device,
                sessionId,
                error: unmountError instanceof Error ? unmountError.message : String(unmountError)
              })
            }
          })
        }

        // Send final progress update with all completed files
        const completedFiles = db.getFilesByStatus(sessionId, 'complete')
        const failedFiles = db.getFilesByStatus(sessionId, 'error')

        event.sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
          status: failedCount > 0 ? 'error' : 'complete',
          totalFiles,
          completedFilesCount: completedCount,
          failedFiles: failedCount,
          skippedFiles: 0,
          totalBytes,
          transferredBytes: totalBytes,
          overallPercentage: 100,
          currentFile: null,
          activeFiles: [],
          completedFiles: [...completedFiles, ...failedFiles],
          transferSpeed: 0,
          averageSpeed: 0,
          eta: 0,
          elapsedTime: (Date.now() - startTime) / 1000,
          startTime,
          endTime: Date.now(),
          errorCount: failedCount
        })

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
      await transferEngine.stop()
      getLogger().info('Transfer stopped by user')
    }
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER_STATUS, async () => {
    return {
      isTransferring: transferEngine ? transferEngine.isTransferring() : false
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
    try {
      const db = getDatabaseManager()
      const deletedCount = db.clearTransferSessions()
      getLogger().info('Transfer history cleared', { deletedCount })
      return { success: true, deletedCount }
    } catch (error) {
      getLogger().error('Failed to clear transfer history', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
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
    const { app } = await import('electron')
    app.quit()
  })

  // App version handler
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, async () => {
    const { app } = await import('electron')
    return app.getVersion()
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

  // Store window reference for unmount events
  mainWindow = window

  driveMonitor
    .start({
      pollingInterval: 2000,
      onDriveAdded: (drive) => {
        getLogger().logDriveDetected(drive.device, drive.displayName)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_DETECTED, drive)
        }
      },
      onDriveRemoved: (device) => {
        getLogger().logDriveRemoved(device)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, device)
        }
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
    try {
      driveMonitor.stop()
    } catch (error) {
      getLogger().warn('Error stopping drive monitor', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    driveMonitor = null
  }
}

/**
 * Check if transfers are currently in progress
 */
export function isTransferInProgress(): boolean {
  return transferEngine ? transferEngine.isTransferring() : false
}

/**
 * Cleanup IPC handlers
 * Call this when the app is closing
 */
export async function cleanupIpc(): Promise<void> {
  stopDriveMonitoring()

  if (transferEngine) {
    await transferEngine.stop()
    transferEngine = null
  }

  // Remove all handlers
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel)
  })
}
