/**
 * Transfer Service Module
 * Encapsulates file transfer business logic, separating it from IPC handlers
 */

import { stat } from 'fs/promises'
import { IPC_CHANNELS, DriveInfo } from '../../shared/types'
import { FileTransferEngine, TransferResult } from '../fileTransfer'
import { getDatabaseManager } from '../databaseManager'
import { getConfig } from '../configManager'
import { getLogger } from '../logger'
import { createPathProcessor, PathProcessor } from '../pathProcessor'
import { hasEnoughSpace, checkDiskSpace } from '../pathValidator'
import { validateTransfer, type TransferValidationOptions } from '../transferValidator'
import { FilenameUtils } from '../utils/filenameUtils'
import { safeSum } from '../utils/fileSizeUtils'
import { BYTES_PER_GB } from '../constants/fileConstants'
import { updateMenuForTransferState } from '../menu'

/**
 * Transfer request after validation
 */
export interface ValidatedTransferRequest {
  sourceRoot: string
  destinationRoot: string
  files: string[]
  driveInfo: DriveInfo
  conflictResolutions?: Record<string, 'skip' | 'rename' | 'overwrite'>
}

/**
 * Transfer context passed to progress callbacks
 */
export interface TransferContext {
  sessionId: string
  totalFiles: number
  totalBytes: number
  startTime: number
  fileSizes: number[]
  transferFiles: Array<{ source: string; dest: string }>
}

/**
 * Progress callback types
 */
export type ProgressCallback = (data: TransferProgressData) => void

export interface TransferProgressData {
  status: 'transferring' | 'complete' | 'error'
  totalFiles: number
  completedFilesCount: number
  failedFiles: number
  skippedFiles: number
  totalBytes: number
  transferredBytes: number
  overallPercentage: number
  activeFiles: ActiveFileInfo[]
  completedFiles: CompletedFileInfo[]
  currentFile: CurrentFileInfo | null
  transferSpeed: number
  averageSpeed: number
  eta: number
  elapsedTime: number
  totalDuration?: number
  startTime: number
  endTime: number | null
  errorCount: number
}

export interface ActiveFileInfo {
  sourcePath: string
  destinationPath: string
  fileName: string
  fileSize: number
  bytesTransferred: number
  percentage: number
  speed: number
  status: string
  startTime?: number
  duration?: number
  remainingTime?: number
}

export interface CompletedFileInfo {
  sourcePath: string
  destinationPath: string
  fileName: string
  fileSize: number
  bytesTransferred: number
  percentage: number
  status: 'complete' | 'error' | 'skipped'
  error?: string
  errorType?: string
  checksum?: string
}

export interface CurrentFileInfo {
  sourcePath: string
  destinationPath: string
  fileName: string
  fileSize: number
  bytesTransferred: number
  percentage: number
  status: string
  startTime?: number
}

/**
 * Transfer Service Class
 * Manages file transfer operations with proper separation of concerns
 */
export class TransferService {
  private transferEngine: FileTransferEngine | null = null
  private pathProcessor: PathProcessor | null = null

  /**
   * Check if a transfer is currently in progress
   */
  isTransferring(): boolean {
    return this.transferEngine?.isTransferring() ?? false
  }

  /**
   * Stop the current transfer
   */
  async stop(): Promise<void> {
    if (this.transferEngine) {
      await this.transferEngine.stop()
      updateMenuForTransferState(false)
    }
  }

  /**
   * Reset the transfer engine for a new transfer
   */
  reset(): void {
    if (!this.transferEngine) {
      this.transferEngine = new FileTransferEngine()
    } else {
      this.transferEngine.reset()
    }

    const config = getConfig()
    this.pathProcessor = createPathProcessor(config)
  }

  /**
   * Get transfer engine instance
   */
  getEngine(): FileTransferEngine | null {
    return this.transferEngine
  }

  /**
   * Validate a transfer request before execution
   */
  async validateTransferRequest(
    sourceRoot: string,
    destinationRoot: string,
    files: string[],
    driveInfo?: DriveInfo
  ): Promise<{
    isValid: boolean
    canProceed: boolean
    requiresConfirmation: boolean
    warnings: Array<{ type: string; message: string; details?: Record<string, unknown> }>
    conflicts: Array<{
      sourcePath: string
      destinationPath: string
      fileName: string
      sourceSize: number
      sourceModified: number
      existingSize: number
      existingModified: number
    }>
    spaceRequired: number
    spaceAvailable: number
    error?: string
  }> {
    const logger = getLogger()
    const config = getConfig()
    const processor = createPathProcessor(config)
    const deviceName = driveInfo?.displayName || 'Unknown Device'

    // Process file paths to get source -> dest mapping
    const processedFiles = await Promise.all(
      files.map(async (sourcePath) => {
        try {
          const processed = await processor.processFilePath(sourcePath, destinationRoot, deviceName)
          return {
            source: sourcePath,
            dest: processed.destinationPath
          }
        } catch {
          const fileName = sourcePath.split('/').pop() || 'file'
          return {
            source: sourcePath,
            dest: `${destinationRoot}/${fileName}`
          }
        }
      })
    )

    const validationOptions: TransferValidationOptions = {
      sourceRoot,
      destinationRoot,
      files: processedFiles,
      conflictResolution: config.conflictResolution
    }

    const result = await validateTransfer(validationOptions)

    logger.info('[TransferService] Validation complete', {
      isValid: result.isValid,
      canProceed: result.canProceed,
      requiresConfirmation: result.requiresConfirmation,
      warningCount: result.warnings.length,
      conflictCount: result.conflicts.length
    })

    return result
  }

  /**
   * Prepare files for transfer (filter, process paths, resolve conflicts)
   */
  async prepareTransferFiles(request: ValidatedTransferRequest): Promise<{
    transferFiles: Array<{ source: string; dest: string }>
    fileSizes: number[]
    totalBytes: number
    skippedCount: number
  }> {
    const config = getConfig()
    const filenameUtils = new FilenameUtils()

    if (!this.pathProcessor) {
      this.pathProcessor = createPathProcessor(config)
    }

    // Filter files based on media extensions if enabled
    const filteredFiles = request.files.filter((file) =>
      this.pathProcessor!.shouldTransferFile(file)
    )

    // Process file paths and apply conflict resolution
    const transferFilesRaw = await Promise.all(
      filteredFiles.map(async (sourcePath) => {
        try {
          const processedPath = await this.pathProcessor!.processFilePath(
            sourcePath,
            request.destinationRoot,
            request.driveInfo.displayName
          )

          let destPath = processedPath.destinationPath
          let shouldSkip = false

          // Apply conflict resolution if specified for this file
          const resolution = request.conflictResolutions?.[sourcePath]
          if (resolution) {
            if (resolution === 'skip') {
              shouldSkip = true
              getLogger().debug('[TransferService] Skipping file due to conflict resolution', {
                sourcePath
              })
            } else if (resolution === 'rename') {
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'rename' })
              destPath = resolved.path
              getLogger().debug('[TransferService] Renamed file for conflict resolution', {
                sourcePath,
                originalDest: processedPath.destinationPath,
                newDest: destPath
              })
            }
          } else if (config.conflictResolution !== 'ask') {
            if (config.conflictResolution === 'skip') {
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'skip' })
              if (resolved.action === 'skip') {
                shouldSkip = true
              }
            } else if (config.conflictResolution === 'rename') {
              const resolved = await filenameUtils.resolveConflict(destPath, { strategy: 'rename' })
              destPath = resolved.path
            }
          }

          return { source: sourcePath, dest: destPath, skip: shouldSkip }
        } catch (error) {
          getLogger().warn('Failed to process path', {
            sourcePath,
            error: error instanceof Error ? error.message : String(error)
          })
          const fileName = sourcePath.split('/').pop() || 'file'
          const destPath = `${request.destinationRoot}/${fileName}`
          return { source: sourcePath, dest: destPath, skip: false }
        }
      })
    )

    // Filter out skipped files
    const skippedCount = transferFilesRaw.filter((f) => f.skip).length
    const transferFiles = transferFilesRaw
      .filter((f) => !f.skip)
      .map(({ source, dest }) => ({ source, dest }))

    // Get file sizes
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

    return { transferFiles, fileSizes, totalBytes, skippedCount }
  }

  /**
   * Validate disk space for transfer
   */
  async validateDiskSpace(destinationRoot: string, requiredBytes: number): Promise<void> {
    const hasSpace = await hasEnoughSpace(destinationRoot, requiredBytes)
    if (!hasSpace) {
      const spaceInfo = await checkDiskSpace(destinationRoot)
      const errorMessage = `Insufficient disk space. Required: ${(requiredBytes / BYTES_PER_GB).toFixed(2)} GB, Available: ${(spaceInfo.freeSpace / BYTES_PER_GB).toFixed(2)} GB`
      getLogger().error('Pre-transfer validation failed - insufficient space', {
        required: requiredBytes,
        available: spaceInfo.freeSpace,
        destination: destinationRoot
      })
      throw new Error(errorMessage)
    }
  }

  /**
   * Create a transfer session in the database
   */
  createSession(request: ValidatedTransferRequest, totalFiles: number, totalBytes: number): string {
    const db = getDatabaseManager()

    const sessionId = db.createTransferSession({
      driveId: request.driveInfo.device,
      driveName: request.driveInfo.displayName,
      sourceRoot: request.sourceRoot,
      destinationRoot: request.destinationRoot,
      startTime: Date.now(),
      endTime: null,
      status: 'transferring',
      fileCount: totalFiles,
      totalBytes,
      files: []
    })

    getLogger().logTransferStart(
      sessionId,
      request.driveInfo.device,
      request.sourceRoot,
      request.destinationRoot
    )

    return sessionId
  }

  /**
   * Add files to a transfer session
   */
  addFilesToSession(
    sessionId: string,
    transferFiles: Array<{ source: string; dest: string }>,
    fileSizes: number[]
  ): void {
    const db = getDatabaseManager()

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
  }

  /**
   * Execute the file transfer
   */
  async executeTransfer(
    context: TransferContext,
    onProgress: ProgressCallback,
    onComplete: (results: TransferResult[]) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.transferEngine) {
      throw new Error('Transfer engine not initialized')
    }

    const db = getDatabaseManager()
    const logger = getLogger()
    const config = getConfig()

    let currentFileIndex = 0
    let currentFilePhase: 'transferring' | 'verifying' = 'transferring'
    const completedFileResults = new Map<
      number,
      { success: boolean; checksum?: string; error?: string }
    >()
    const fileStartTimes = new Map<number, number>()

    updateMenuForTransferState(true)

    this.transferEngine
      .transferFiles(context.transferFiles, {
        verifyChecksum: config.verifyChecksums,
        onProgress: (progress) => {
          currentFilePhase = 'transferring'

          const overallBytesTransferred = progress.bytesTransferred
          const overallPercentage = progress.percentage

          const elapsedTime = (Date.now() - context.startTime) / 1000
          const averageSpeed = elapsedTime > 0 ? overallBytesTransferred / elapsedTime : 0
          const remainingBytes = context.totalBytes - overallBytesTransferred
          const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0
          const totalDuration = averageSpeed > 0 ? context.totalBytes / averageSpeed : 0

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

          const activeFiles: ActiveFileInfo[] =
            enhancedProgress.activeFiles?.map((file) => ({
              sourcePath: context.transferFiles[file.index]?.source || '',
              destinationPath: context.transferFiles[file.index]?.dest || '',
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

          const completedFiles = db.getFilesByStatus(context.sessionId, 'complete')
          const failedFilesList = db.getFilesByStatus(context.sessionId, 'error')

          onProgress({
            status: 'transferring',
            totalFiles: context.totalFiles,
            completedFilesCount: currentFileIndex,
            failedFiles: failedFilesList.length,
            skippedFiles: 0,
            totalBytes: context.totalBytes,
            transferredBytes: overallBytesTransferred,
            overallPercentage,
            activeFiles,
            completedFiles: [...completedFiles, ...failedFilesList].map((f) => ({
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
            currentFile:
              activeFiles.length > 0
                ? activeFiles[0]
                : {
                    sourcePath: context.transferFiles[currentFileIndex]?.source || '',
                    destinationPath: context.transferFiles[currentFileIndex]?.dest || '',
                    fileName:
                      context.transferFiles[currentFileIndex]?.source.split('/').pop() || '',
                    fileSize: 0,
                    bytesTransferred: 0,
                    percentage: 0,
                    status: currentFilePhase,
                    startTime: context.startTime
                  },
            transferSpeed: progress.speed,
            averageSpeed,
            eta,
            elapsedTime,
            totalDuration,
            startTime: context.startTime,
            endTime: null,
            errorCount: failedFilesList.length
          })
        },
        onBatchProgress: (completed) => {
          currentFileIndex = completed
        },
        onFileComplete: (fileIndex, result) => {
          const file = context.transferFiles[fileIndex]
          const status = result.success ? 'complete' : 'error'
          const checksum = result.success ? result.sourceChecksum : undefined

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

          completedFileResults.set(fileIndex, {
            success: result.success,
            checksum,
            error: result.error
          })

          db.updateFileStatus(context.sessionId, file.source, {
            status,
            checksum,
            bytesTransferred: result.bytesTransferred,
            percentage: 100,
            endTime: Date.now(),
            duration: result.duration / 1000,
            error: result.success ? undefined : result.error
          })

          // Trigger progress update
          const completedFiles = db.getFilesByStatus(context.sessionId, 'complete')
          const failedFilesList = db.getFilesByStatus(context.sessionId, 'error')

          const bytesCompletedPreviously = context.fileSizes
            .slice(0, fileIndex + 1)
            .reduce((sum, size) => sum + size, 0)
          const overallBytesTransferred = bytesCompletedPreviously
          const overallPercentage =
            context.totalBytes > 0 ? (overallBytesTransferred / context.totalBytes) * 100 : 0

          const elapsedTime = (Date.now() - context.startTime) / 1000
          const averageSpeed = elapsedTime > 0 ? overallBytesTransferred / elapsedTime : 0
          const remainingBytes = context.totalBytes - overallBytesTransferred
          const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0

          onProgress({
            status: 'transferring',
            totalFiles: context.totalFiles,
            completedFilesCount: completedFileResults.size,
            failedFiles: failedFilesList.length,
            skippedFiles: 0,
            totalBytes: context.totalBytes,
            transferredBytes: overallBytesTransferred,
            overallPercentage,
            activeFiles: [],
            completedFiles: [...completedFiles, ...failedFilesList].map((f) => ({
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
            currentFile: null,
            transferSpeed: 0,
            averageSpeed,
            eta,
            elapsedTime,
            startTime: context.startTime,
            endTime: null,
            errorCount: failedFilesList.length
          })
        }
      })
      .then((results) => {
        onComplete(results)
        updateMenuForTransferState(false)
      })
      .catch((error) => {
        onError(error instanceof Error ? error : new Error(String(error)))
        updateMenuForTransferState(false)
      })
  }

  /**
   * Update session status on completion
   */
  updateSessionCompletion(
    sessionId: string,
    results: TransferResult[],
    startTime: number
  ): { completedCount: number; failedCount: number } {
    const db = getDatabaseManager()
    const logger = getLogger()

    const completedCount = results.filter((r) => r.success).length
    const failedCount = results.filter((r) => !r.success).length

    // Update individual file statuses
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

    return { completedCount, failedCount }
  }

  /**
   * Update session with error
   */
  updateSessionError(sessionId: string, errorMessage: string): void {
    const db = getDatabaseManager()
    const logger = getLogger()

    db.updateTransferSession(sessionId, {
      status: 'error',
      endTime: Date.now(),
      errorMessage
    })

    logger.logTransferError(sessionId, errorMessage)
  }
}

// Global service instance
let globalTransferService: TransferService | null = null

/**
 * Get or create the global transfer service instance
 */
export function getTransferService(): TransferService {
  if (!globalTransferService) {
    globalTransferService = new TransferService()
  }
  return globalTransferService
}
