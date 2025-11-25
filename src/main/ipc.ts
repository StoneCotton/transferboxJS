/**
 * IPC Communication Setup
 * Handles communication between main and renderer processes
 */

import { ipcMain, dialog } from 'electron'
import { stat } from 'fs/promises'
import { IPC_CHANNELS } from '../shared/types'
import { validatePath, hasEnoughSpace, checkDiskSpace } from './pathValidator'
import { validateTransfer, type TransferValidationOptions } from './transferValidator'
import { FilenameUtils } from './utils/filenameUtils'
import {
  validateTransferStartRequest,
  validatePathValidationRequest,
  validateDeviceId,
  validateSessionId,
  validateLimit,
  validateLogLevel
} from './utils/ipcValidator'
import { safeSum } from './utils/fileSizeUtils'
import { BYTES_PER_GB } from './constants/fileConstants'
import {
  getConfig,
  updateConfig,
  resetConfig,
  forceMigration,
  getVersionInfo,
  getNewerConfigWarning,
  handleNewerConfigChoice,
  clearNewerConfigWarning
} from './configManager'
import { DriveMonitor } from './driveMonitor'
import { FileTransferEngine } from './fileTransfer'
import { getDatabaseManager } from './databaseManager'
import { getLogger, onLogEntry } from './logger'
import { createPathProcessor, type PathProcessor } from './pathProcessor'
import { updateMenuForTransferState } from './menu'
import { checkForUpdates, getReleasesUrl } from './updateChecker'

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

  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, async (_, config: unknown) => {
    // Basic validation - configManager will do more detailed validation
    if (!config || typeof config !== 'object') {
      throw new Error('Config must be an object')
    }
    const configObj = config as Record<string, unknown>
    const updated = updateConfig(configObj as Partial<typeof configObj>)
    // If logLevel changed, apply to logger immediately
    if (configObj && 'logLevel' in configObj && configObj.logLevel) {
      const validatedLogLevel = validateLogLevel(configObj.logLevel)
      const logger = getLogger()
      const previous = logger.getLevel()
      logger.setLevel(validatedLogLevel)
      if (previous !== validatedLogLevel) {
        logger.info('Log level set', { from: previous, to: validatedLogLevel })
      }
    }
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async () => {
    return resetConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_MIGRATE, async () => {
    return forceMigration()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_VERSION_INFO, async () => {
    return getVersionInfo()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_NEWER_WARNING, async () => {
    return getNewerConfigWarning()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_HANDLE_NEWER, async (_, choice: unknown) => {
    if (choice !== 'continue' && choice !== 'reset') {
      throw new Error('Invalid choice. Must be "continue" or "reset"')
    }
    return handleNewerConfigChoice(choice)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING, async () => {
    clearNewerConfigWarning()
  })

  // Path validation handlers
  ipcMain.handle(IPC_CHANNELS.PATH_VALIDATE, async (_, request: unknown) => {
    const validatedPath = validatePathValidationRequest(request)
    return validatePath(validatedPath)
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

  ipcMain.handle(IPC_CHANNELS.DRIVE_SCAN, async (_, device: unknown) => {
    const validatedDevice = validateDeviceId(device)
    if (!driveMonitor) {
      driveMonitor = new DriveMonitor()
    }

    // Retry mechanism for drives that are detected but not yet mounted
    // Increased to accommodate slower mounting drives and reconnection scenarios
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 1000
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Find the drive and scan it
        const drives = await driveMonitor.listRemovableDrives()
        const drive = drives.find((d) => d.device === validatedDevice)

        if (!drive) {
          throw new Error('Drive not found')
        }

        if (drive.mountpoints.length === 0) {
          throw new Error('Drive not mounted yet')
        }

        const config = getConfig()
        getLogger().debug('[IPC] Scanning drive', { mediaExtensions: config.mediaExtensions })
        const result = await driveMonitor.scanForMedia(drive.mountpoints[0])
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
      const success = (await driveMonitor?.unmountDrive(validatedDevice)) || false

      if (success) {
        getLogger().info('Drive unmounted successfully', { device: validatedDevice })

        // Notify renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (process.platform === 'win32') {
            // On Windows, treat successful eject as removed so UI clears the device fully
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

  // Transfer operations handlers

  // Pre-transfer validation handler
  ipcMain.handle(IPC_CHANNELS.TRANSFER_VALIDATE, async (_, request: unknown) => {
    const logger = getLogger()

    // Validate request structure
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

    // Initialize path processor for destination path calculation
    const config = getConfig()
    const processor = createPathProcessor(config)

    // Get drive info for device name
    const driveInfo = reqObj.driveInfo as Record<string, unknown> | undefined
    const deviceName = (driveInfo?.displayName as string) || 'Unknown Device'

    // Process file paths to get source -> dest mapping
    const processedFiles = await Promise.all(
      (reqObj.files as string[]).map(async (sourcePath) => {
        try {
          const processed = await processor.processFilePath(
            sourcePath,
            reqObj.destinationRoot as string,
            deviceName
          )
          return {
            source: sourcePath,
            dest: processed.destinationPath
          }
        } catch {
          // Fallback to simple filename if processing fails
          const fileName = sourcePath.split('/').pop() || 'file'
          return {
            source: sourcePath,
            dest: `${reqObj.destinationRoot}/${fileName}`
          }
        }
      })
    )

    // Run validation
    const validationOptions: TransferValidationOptions = {
      sourceRoot: reqObj.sourceRoot as string,
      destinationRoot: reqObj.destinationRoot as string,
      files: processedFiles,
      conflictResolution: config.conflictResolution
    }

    const result = await validateTransfer(validationOptions)

    logger.info('[IPC] Transfer validation complete', {
      isValid: result.isValid,
      canProceed: result.canProceed,
      requiresConfirmation: result.requiresConfirmation,
      warningCount: result.warnings.length,
      conflictCount: result.conflicts.length
    })

    return result
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, request: unknown) => {
    const logger = getLogger()

    // Prevent concurrent transfers
    if (transferEngine && transferEngine.isTransferring()) {
      const errorMessage =
        'A transfer is already in progress. Please wait for it to complete or cancel it first.'
      logger.warn('Transfer start blocked - transfer already in progress')
      throw new Error(errorMessage)
    }

    // Log incoming request for debugging
    logger.debug('[IPC] Transfer start requested', {
      hasRequest: !!request,
      requestType: typeof request
    })

    // Validate and sanitize request
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
    if (!transferEngine) {
      transferEngine = new FileTransferEngine()
    } else {
      transferEngine.reset()
    }

    // Initialize path processor with current config
    const config = getConfig()
    pathProcessor = createPathProcessor(config)

    const db = getDatabaseManager()
    // logger already declared above

    // Filter files based on media extensions if enabled
    const filteredFiles = validatedRequest.files.filter((file) =>
      pathProcessor!.shouldTransferFile(file)
    )

    // Get conflict resolutions from request (if provided)
    const conflictResolutions = (validatedRequest as Record<string, unknown>)
      .conflictResolutions as Record<string, 'skip' | 'rename' | 'overwrite'> | undefined

    // Initialize FilenameUtils for conflict resolution
    const filenameUtils = new FilenameUtils()

    // Process file paths using configuration and apply conflict resolution
    const transferFilesRaw = await Promise.all(
      filteredFiles.map(async (sourcePath) => {
        try {
          getLogger().debug('[IPC] Processing source path', { sourcePath })
          const processedPath = await pathProcessor!.processFilePath(
            sourcePath,
            validatedRequest.destinationRoot,
            validatedRequest.driveInfo.displayName
          )

          let destPath = processedPath.destinationPath
          let shouldSkip = false

          // Apply conflict resolution if specified for this file
          const resolution = conflictResolutions?.[sourcePath]
          if (resolution) {
            if (resolution === 'skip') {
              shouldSkip = true
              getLogger().debug('[IPC] Skipping file due to conflict resolution', { sourcePath })
            } else if (resolution === 'rename') {
              // Use FilenameUtils to generate a unique name
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'rename' })
              destPath = resolved.path
              getLogger().debug('[IPC] Renamed file for conflict resolution', {
                sourcePath,
                originalDest: processedPath.destinationPath,
                newDest: destPath
              })
            }
            // 'overwrite' doesn't change the path, just allows overwriting
          } else if (config.conflictResolution !== 'ask') {
            // Apply default config resolution for files without explicit resolution
            if (config.conflictResolution === 'skip') {
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'skip' })
              if (resolved.action === 'skip') {
                shouldSkip = true
                getLogger().debug('[IPC] Skipping file due to config conflict resolution', {
                  sourcePath
                })
              }
            } else if (config.conflictResolution === 'rename') {
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'rename' })
              destPath = resolved.path
            }
            // 'overwrite' doesn't change the path
          }

          getLogger().debug('[IPC] Processed path result', {
            destinationPath: destPath,
            skipped: shouldSkip
          })
          return { source: sourcePath, dest: destPath, skip: shouldSkip }
        } catch (error) {
          getLogger().warn('Failed to process path', {
            sourcePath,
            error: error instanceof Error ? error.message : String(error)
          })
          // Fallback to simple filename if processing fails
          const fileName = sourcePath.split('/').pop() || 'file'
          const destPath = `${validatedRequest.destinationRoot}/${fileName}`
          getLogger().info('[IPC] Using fallback destination path', { destPath })
          return { source: sourcePath, dest: destPath, skip: false }
        }
      })
    )

    // Filter out skipped files
    const transferFiles = transferFilesRaw
      .filter((f) => !f.skip)
      .map(({ source, dest }) => ({ source, dest }))

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

    const totalBytes = safeSum(fileSizes)

    // Validate sufficient disk space
    const hasSpace = await hasEnoughSpace(validatedRequest.destinationRoot, totalBytes)
    if (!hasSpace) {
      const spaceInfo = await checkDiskSpace(validatedRequest.destinationRoot)
      const errorMessage = `Insufficient disk space. Required: ${(totalBytes / BYTES_PER_GB).toFixed(2)} GB, Available: ${(spaceInfo.freeSpace / BYTES_PER_GB).toFixed(2)} GB`
      getLogger().error('Pre-transfer validation failed - insufficient space', {
        required: totalBytes,
        available: spaceInfo.freeSpace,
        destination: validatedRequest.destinationRoot
      })
      throw new Error(errorMessage)
    }

    // Create transfer session
    const sessionId = db.createTransferSession({
      driveId: validatedRequest.driveInfo.device,
      driveName: validatedRequest.driveInfo.displayName,
      sourceRoot: validatedRequest.sourceRoot,
      destinationRoot: validatedRequest.destinationRoot,
      startTime: Date.now(),
      endTime: null,
      status: 'transferring',
      fileCount: filteredFiles.length,
      totalBytes: totalBytes,
      files: []
    })

    logger.logTransferStart(
      sessionId,
      validatedRequest.driveInfo.device,
      validatedRequest.sourceRoot,
      validatedRequest.destinationRoot
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

    // Update menu to enable Cancel Transfer option
    updateMenuForTransferState(true)

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

          // Log per-file completion with context
          if (result.success) {
            logger.info('File transfer completed', {
              sourcePath: file.source,
              destPath: file.dest,
              bytesTransferred: result.bytesTransferred,
              checksumVerified: result.checksumVerified,
              checksum: result.sourceChecksum,
              durationMs: result.duration
            })
          } else {
            logger.error('File transfer failed', {
              sourcePath: file.source,
              destPath: file.dest,
              error: result.error,
              errorType: result.errorType,
              durationMs: result.duration
            })
          }

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
        if (failedCount === 0 && validatedRequest.driveInfo.device) {
          // Run unmount asynchronously without blocking the completion event
          setImmediate(async () => {
            try {
              logger.info('Auto-unmounting drive after successful transfer', {
                device: validatedRequest.driveInfo.device,
                sessionId
              })

              const unmountSuccess = await driveMonitor?.unmountDrive(
                validatedRequest.driveInfo.device
              )

              if (unmountSuccess) {
                logger.info('Drive auto-unmounted successfully', {
                  device: validatedRequest.driveInfo.device,
                  sessionId
                })

                // Notify renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                  if (process.platform === 'win32') {
                    getLogger().debug('[IPC] Sending DRIVE_REMOVED event (auto, win32)', {
                      device: validatedRequest.driveInfo.device
                    })
                    mainWindow.webContents.send(
                      IPC_CHANNELS.DRIVE_REMOVED,
                      validatedRequest.driveInfo.device
                    )
                  } else {
                    getLogger().debug('[IPC] Sending DRIVE_UNMOUNTED event (auto)', {
                      device: validatedRequest.driveInfo.device
                    })
                    mainWindow.webContents.send(
                      IPC_CHANNELS.DRIVE_UNMOUNTED,
                      validatedRequest.driveInfo.device
                    )
                  }
                } else {
                  getLogger().warn('[IPC] Cannot send drive event - mainWindow not available')
                }
              } else {
                logger.warn('Failed to auto-unmount drive', {
                  device: validatedRequest.driveInfo.device,
                  sessionId
                })
              }
            } catch (unmountError) {
              logger.error('Error during auto-unmount', {
                device: validatedRequest.driveInfo.device,
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

        // Update menu to disable Cancel Transfer option
        updateMenuForTransferState(false)
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

        // Update menu to disable Cancel Transfer option
        updateMenuForTransferState(false)
      })
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER_STOP, async () => {
    if (transferEngine) {
      await transferEngine.stop()
      getLogger().info('Transfer stopped by user')
      // Update menu to disable Cancel Transfer option
      updateMenuForTransferState(false)
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

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_BY_ID, async (_, id: unknown) => {
    const validatedId = validateSessionId(id)
    const db = getDatabaseManager()
    return db.getTransferSession(validatedId)
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
  ipcMain.handle(IPC_CHANNELS.LOG_GET_RECENT, async (_, limit?: unknown) => {
    const validatedLimit = validateLimit(limit, 10000)
    return getLogger().getRecent(validatedLimit)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, async () => {
    getLogger().clear()
  })

  // Log range export handler
  ipcMain.handle('log:get-range', async (_e, args: unknown) => {
    const logger = getLogger()
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments')
    }
    const argObj = args as Record<string, unknown>
    const startTime = argObj.startTime
    const endTime = argObj.endTime
    const level = argObj.level

    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
      throw new Error('Invalid date range')
    }

    // Validate date range values
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
      throw new Error('Invalid date range values')
    }

    if (level !== undefined) {
      const validatedLevel = validateLogLevel(level)
      // Filter by level within range
      const range = logger.getByDateRange(startTime, endTime)
      return range.filter((l) => l.level === validatedLevel)
    }
    return logger.getByDateRange(startTime, endTime)
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

  // Menu action handlers
  ipcMain.handle(IPC_CHANNELS.MENU_OPEN_DESTINATION, async () => {
    const config = getConfig()
    if (config.defaultDestination) {
      const { shell } = await import('electron')
      await shell.openPath(config.defaultDestination)
    }
  })

  ipcMain.handle(IPC_CHANNELS.MENU_CANCEL_TRANSFER, async () => {
    if (transferEngine) {
      await transferEngine.stop()
      getLogger().info('Transfer cancelled by user via menu')
      // Update menu to disable Cancel Transfer option
      updateMenuForTransferState(false)
    }
  })

  ipcMain.handle(IPC_CHANNELS.MENU_CHECK_UPDATES, async () => {
    const { dialog, shell } = await import('electron')
    const currentVersion = (await import('electron')).app.getVersion()

    // Show a simple dialog for now - can be enhanced with actual update checking
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Check for Updates',
      message: 'Check for Updates',
      detail: `Current version: ${currentVersion}\n\nVisit the releases page to check for updates?`,
      buttons: ['Visit Releases', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      await shell.openExternal('https://github.com/tylersaari/transferbox/releases')
    }
  })

  // Update checking handlers
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return checkForUpdates()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_OPEN_RELEASES, async () => {
    const { shell } = await import('electron')
    await shell.openExternal(getReleasesUrl())
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

  // Stream log entries to renderer
  try {
    const unsubscribe = onLogEntry((entry) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry)
      }
    })
    // Ensure we clean up when window is destroyed
    mainWindow.once('closed', () => unsubscribe())
  } catch {
    // No-op if streaming setup fails
  }

  // Check for updates on startup and notify renderer if available
  checkForUpdates()
    .then((result) => {
      if (result.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        getLogger().info('Update available', {
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        })
        mainWindow.webContents.send(IPC_CHANNELS.UPDATE_AVAILABLE, result)
      }
    })
    .catch((error) => {
      getLogger().warn('Startup update check failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    })

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
 * Cancel the current transfer (for use by menu or other main process code)
 */
export async function cancelCurrentTransfer(): Promise<void> {
  if (transferEngine) {
    await transferEngine.stop()
    getLogger().info('Transfer cancelled by user via menu')
    updateMenuForTransferState(false)
  }
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
