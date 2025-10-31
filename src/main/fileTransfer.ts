/**
 * File Transfer Engine Module
 * Handles file transfers with atomic operations, checksum verification, and progress tracking
 */

import { createReadStream, createWriteStream } from 'fs'
import { stat, mkdir, rename, unlink, chmod, access, constants, readdir, utimes } from 'fs/promises'
import * as path from 'path'
import { TransferError, wrapError } from './errors/TransferError'
import { TransferErrorType } from '../shared/types'
import { getLogger } from './logger'
import { withRetry } from './utils/retryStrategy'
import { safeAdd } from './utils/fileSizeUtils'
import {
  DEFAULT_BUFFER_SIZE,
  SMALL_FILE_THRESHOLD,
  MEDIUM_FILE_THRESHOLD,
  LARGE_FILE_THRESHOLD,
  PROGRESS_SMALL_FILE,
  PROGRESS_MEDIUM_FILE,
  PROGRESS_LARGE_FILE,
  PROGRESS_XLARGE_FILE,
  ORPHANED_FILE_MAX_AGE_MS
} from './constants/fileConstants'

export interface TransferProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speed: number // Bytes per second
}

export interface TransferOptions {
  bufferSize?: number // Buffer size for copying (default: 4MB)
  verifyChecksum?: boolean // Verify checksum after transfer
  overwrite?: boolean // Allow overwriting existing files
  continueOnError?: boolean // Continue batch transfer on error
  preservePermissions?: boolean // Preserve file permissions (default: true)
  maxRetries?: number // Maximum retry attempts (default: 3)
  retryDelay?: number // Delay between retries in ms (default: 1000)
  onProgress?: (progress: TransferProgress) => void
  onBatchProgress?: (completed: number, total: number) => void
  onChecksumProgress?: (
    phase: 'source' | 'destination',
    bytesProcessed: number,
    totalBytes: number
  ) => void
  onFileComplete?: (fileIndex: number, result: TransferResult) => void // Called when each file completes
  _testCorruptDestination?: boolean // For testing only
}

export interface TransferResult {
  success: boolean
  sourcePath: string
  destPath: string
  bytesTransferred: number
  checksumVerified: boolean
  sourceChecksum?: string
  destChecksum?: string
  error?: string
  errorType?: TransferErrorType
  skipped?: boolean
  duration: number // milliseconds
}

// Note: DEFAULT_BUFFER_SIZE and other constants now imported from fileConstants

/**
 * File Transfer Engine Class
 * Provides atomic file transfers with progress tracking and verification
 */
export class FileTransferEngine {
  private stopped = false
  private stopping = false // Intermediate state to prevent new transfers during stop
  private currentTransfer: { abort: () => void } | null = null
  private activeTempFiles: Set<string> = new Set()
  private activeTransferCount = 0 // Track number of active transfers

  /**
   * Calculate optimal progress reporting throttle based on file size
   * Larger files get less frequent updates to prevent UI lag
   */
  private calculateProgressThrottle(fileSize: number): { interval: number; minBytes: number } {
    if (fileSize < SMALL_FILE_THRESHOLD) {
      return PROGRESS_SMALL_FILE
    } else if (fileSize < MEDIUM_FILE_THRESHOLD) {
      return PROGRESS_MEDIUM_FILE
    } else if (fileSize < LARGE_FILE_THRESHOLD) {
      return PROGRESS_LARGE_FILE
    } else {
      return PROGRESS_XLARGE_FILE
    }
  }

  /**
   * Transfer a single file with atomic operations and retry logic
   */
  async transferFile(
    sourcePath: string,
    destPath: string,
    options?: TransferOptions
  ): Promise<TransferResult> {
    // Check if stop has been requested
    if (this.stopped || this.stopping) {
      throw new Error('Transfer engine is stopping')
    }

    const logger = getLogger()
    const startTime = Date.now()
    const bufferSize = options?.bufferSize || DEFAULT_BUFFER_SIZE
    const tempPath = destPath + '.TBPART'

    // Track active transfer
    this.activeTransferCount++

    // Track this temp file for cleanup
    this.activeTempFiles.add(tempPath)

    const result: TransferResult = {
      success: false,
      sourcePath,
      destPath,
      bytesTransferred: 0,
      checksumVerified: false,
      duration: 0
    }

    try {
      // Configure retry settings from options or use defaults
      // Default retry timing optimized for device reconnection scenarios:
      // Attempts at: 0s (immediate), 2s, 4s, 8s, 10s = ~24s total window
      const retryConfig = {
        maxAttempts: options?.maxRetries || 5,
        initialDelay: options?.retryDelay || 2000,
        maxDelay: 10000,
        backoffMultiplier: 2
      }

      // Wrap the core transfer logic with retry
      await withRetry(
        async () => {
          // Clean up any existing .TBPART file before retry attempt
          await this.cleanupTempFile(tempPath)

          return await this.performFileTransfer(
            sourcePath,
            destPath,
            tempPath,
            bufferSize,
            options,
            result
          )
        },
        retryConfig,
        {
          operationName: 'transferFile',
          metadata: {
            sourcePath,
            destPath,
            fileName: path.basename(sourcePath)
          }
        }
      )

      result.success = true
      // Log success
      logger.logFileTransfer(sourcePath, destPath, 'complete')
    } catch (error) {
      const transferError = wrapError(error)
      result.error = transferError.message
      result.errorType = transferError.errorType

      // Cleanup .TBPART file on error
      try {
        await unlink(tempPath)
        // Remove from tracking since it's been cleaned up
        this.activeTempFiles.delete(tempPath)
      } catch {
        // Ignore cleanup errors
      }

      // Log error for this file
      logger.logFileTransfer(sourcePath, destPath, 'error')
      throw transferError
    } finally {
      result.duration = Date.now() - startTime
      this.currentTransfer = null

      // Decrement active transfer count
      this.activeTransferCount = Math.max(0, this.activeTransferCount - 1)
    }

    return result
  }

  /**
   * Clean up temporary file if it exists
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await unlink(tempPath)
      this.activeTempFiles.delete(tempPath)
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Log non-ENOENT errors for debugging
        getLogger().debug('Failed to cleanup temp file', {
          tempPath,
          error: (error as Error).message
        })
      }
    }
  }

  /**
   * Core file transfer logic (extracted for retry wrapper)
   */
  private async performFileTransfer(
    sourcePath: string,
    destPath: string,
    tempPath: string,
    bufferSize: number,
    options: TransferOptions | undefined,
    result: TransferResult
  ): Promise<void> {
    const logger = getLogger()

    try {
      // Check if stopped before starting
      if (this.stopped) {
        throw new Error('Transfer cancelled')
      }

      // Log file transfer start (debug)
      try {
        const sourceStats = await stat(sourcePath)
        logger.debug('File transfer start', {
          sourcePath,
          destPath,
          size: sourceStats.size
        })
      } catch {
        logger.debug('File transfer start', { sourcePath, destPath })
      }

      // Check if source exists
      await access(sourcePath, constants.R_OK)

      // Get source file stats
      const sourceStats = await stat(sourcePath)
      const totalBytes = sourceStats.size

      // Check if destination exists and overwrite is disabled
      if (options?.overwrite === false) {
        try {
          await access(destPath)
          throw new Error('Destination file already exists and overwrite is disabled')
        } catch (error) {
          // File doesn't exist, which is what we want
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
        }
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath)
      await mkdir(destDir, { recursive: true })

      // Copy file to .TBPART with progress tracking and streaming checksum
      if (options?.verifyChecksum) {
        // Use streaming checksum during transfer
        const { sourceChecksum, destChecksum } = await this.copyFileWithStreamingChecksum(
          sourcePath,
          tempPath,
          totalBytes,
          bufferSize,
          options
        )

        result.sourceChecksum = sourceChecksum
        result.destChecksum = destChecksum

        if (sourceChecksum !== destChecksum) {
          throw TransferError.fromChecksumMismatch(sourceChecksum, destChecksum)
        }

        result.checksumVerified = true
      } else {
        // Regular copy without checksum
        await this.copyFileWithProgress(sourcePath, tempPath, totalBytes, bufferSize, options)
      }

      result.bytesTransferred = totalBytes

      // Preserve permissions if requested (default: true)
      if (options?.preservePermissions !== false && process.platform !== 'win32') {
        await chmod(tempPath, sourceStats.mode)
      }

      // Preserve file timestamps (access and modification times)
      // This ensures creation date, modified date, and last accessed date are preserved
      // Note: birthtime (creation time) cannot be set via utimes, but atime/mtime are preserved
      await utimes(tempPath, sourceStats.atime, sourceStats.mtime)

      // Atomic rename: .TBPART -> final file
      await rename(tempPath, destPath)

      // Remove from tracking since it's now completed
      this.activeTempFiles.delete(tempPath)
    } catch (error) {
      // Wrap all errors in TransferError to ensure isRetryable property is set
      if (error instanceof TransferError) {
        throw error
      }
      if (error instanceof Error) {
        throw TransferError.fromNodeError(error as NodeJS.ErrnoException)
      }
      throw new TransferError(String(error), TransferErrorType.UNKNOWN, false)
    }
  }

  /**
   * Transfer multiple files in batch with parallel processing
   */
  async transferFiles(
    files: Array<{ source: string; dest: string }>,
    options?: TransferOptions
  ): Promise<TransferResult[]> {
    const CONCURRENT_LIMIT = 3 // Process up to 3 files concurrently
    const results: TransferResult[] = new Array(files.length)
    let completed = 0

    // Track progress for parallel transfers
    const fileProgress = new Map<number, TransferProgress>()
    let lastAggregatedProgressTime = Date.now()
    const PROGRESS_AGGREGATION_INTERVAL = 100 // Aggregate progress every 100ms

    // Store file information for progress reporting
    const fileInfo = new Map<number, { source: string; dest: string; totalBytes: number }>()

    // Track file start times for duration calculation
    const fileStartTimes = new Map<number, number>()

    // Track completed files for progress calculation
    const completedFiles = new Map<number, number>() // fileIndex -> bytesTransferred

    // Get file sizes for all files
    await Promise.all(
      files.map(async (file, index) => {
        try {
          const stats = await stat(file.source)
          const size = stats.size
          fileInfo.set(index, { source: file.source, dest: file.dest, totalBytes: size })
        } catch {
          fileInfo.set(index, { source: file.source, dest: file.dest, totalBytes: 0 })
        }
      })
    )

    // Calculate total bytes for all files (not just active ones)
    const totalBytesForAllFiles = Array.from(fileInfo.values()).reduce(
      (sum, info) => safeAdd(sum, info.totalBytes),
      0
    )

    // Aggregate and report progress from all active transfers
    const reportAggregatedProgress = (): void => {
      if (!options?.onProgress) return

      const now = Date.now()
      if (now - lastAggregatedProgressTime < PROGRESS_AGGREGATION_INTERVAL) return
      lastAggregatedProgressTime = now

      let totalBytesTransferred = 0
      let totalSpeed = 0
      let activeTransfers = 0

      // Add bytes from completed files
      completedFiles.forEach((bytes) => {
        totalBytesTransferred = safeAdd(totalBytesTransferred, bytes)
      })

      // Add bytes from active transfers
      fileProgress.forEach((progress) => {
        totalBytesTransferred = safeAdd(totalBytesTransferred, progress.bytesTransferred)
        totalSpeed += progress.speed // Speed is naturally a float (bytes/sec), don't use safeAdd
        if (progress.percentage < 100) activeTransfers++
      })

      if (activeTransfers > 0 || completedFiles.size > 0) {
        const overallPercentage =
          totalBytesForAllFiles > 0 ? (totalBytesTransferred / totalBytesForAllFiles) * 100 : 0

        // Create enhanced progress with individual file information
        const enhancedProgress = {
          bytesTransferred: totalBytesTransferred,
          totalBytes: totalBytesForAllFiles,
          percentage: overallPercentage,
          speed: totalSpeed,
          activeFiles: Array.from(fileProgress.entries()).map(([index, progress]) => {
            const info = fileInfo.get(index)
            const startTime = fileStartTimes.get(index)
            const currentTime = Date.now()
            const elapsedTime = startTime ? (currentTime - startTime) / 1000 : 0 // seconds
            const remainingBytes = (info?.totalBytes || 0) - progress.bytesTransferred
            const remainingTime = progress.speed > 0 ? remainingBytes / progress.speed : 0 // seconds

            return {
              index,
              fileName: info?.source.split('/').pop() || '',
              fileSize: info?.totalBytes || 0,
              bytesTransferred: progress.bytesTransferred,
              percentage: progress.percentage,
              speed: progress.speed,
              status: progress.percentage >= 100 ? 'completed' : 'transferring',
              startTime,
              duration: elapsedTime,
              remainingTime
            }
          })
        }

        options.onProgress(enhancedProgress)
      }
    }

    // Process files with continuous parallel transfers
    const activeTransfers = new Map<number, Promise<TransferResult>>()
    let nextFileIndex = 0

    // Helper function to start a transfer
    const startTransfer = (fileIndex: number): void => {
      const file = files[fileIndex]
      const startTime = Date.now()
      fileStartTimes.set(fileIndex, startTime)

      const transferPromise = this.transferFile(file.source, file.dest, {
        ...options,
        onProgress: (progress) => {
          fileProgress.set(fileIndex, progress)
          reportAggregatedProgress()
        },
        onChecksumProgress: options?.onChecksumProgress
          ? (_phase, bytesProcessed, totalBytes) => {
              const progress: TransferProgress = {
                bytesTransferred: bytesProcessed,
                totalBytes,
                percentage: totalBytes > 0 ? (bytesProcessed / totalBytes) * 100 : 0,
                speed: 0
              }
              fileProgress.set(fileIndex, progress)
              reportAggregatedProgress()
            }
          : undefined
      })
        .then((result) => {
          // Calculate final duration for this file
          const startTime = fileStartTimes.get(fileIndex)
          const endTime = Date.now()
          const duration = startTime ? (endTime - startTime) / 1000 : 0 // seconds

          // Update result with duration
          const resultWithDuration = {
            ...result,
            duration: duration * 1000 // Convert to milliseconds for consistency
          }

          results[fileIndex] = resultWithDuration
          completed++

          // Track completed file bytes for progress calculation
          const fileInfoEntry = fileInfo.get(fileIndex)
          if (fileInfoEntry) {
            completedFiles.set(fileIndex, fileInfoEntry.totalBytes)
          }

          fileProgress.delete(fileIndex)
          activeTransfers.delete(fileIndex)
          fileStartTimes.delete(fileIndex) // Clean up start time tracking

          if (options?.onBatchProgress) {
            options.onBatchProgress(completed, files.length)
          }

          // NEW: Call onFileComplete callback with the result
          if (options?.onFileComplete) {
            options.onFileComplete(fileIndex, resultWithDuration)
          }

          return resultWithDuration
        })
        .catch((error) => {
          // Calculate duration even for failed transfers
          const startTime = fileStartTimes.get(fileIndex)
          const endTime = Date.now()
          const duration = startTime ? (endTime - startTime) / 1000 : 0 // seconds

          const transferError = wrapError(error)
          const errorResult: TransferResult = {
            success: false,
            sourcePath: file.source,
            destPath: file.dest,
            bytesTransferred: 0,
            checksumVerified: false,
            error: transferError.message,
            errorType: transferError.errorType,
            duration: duration * 1000 // Convert to milliseconds for consistency
          }

          results[fileIndex] = errorResult
          completed++
          fileProgress.delete(fileIndex)
          activeTransfers.delete(fileIndex)
          fileStartTimes.delete(fileIndex) // Clean up start time tracking

          if (options?.onBatchProgress) {
            options.onBatchProgress(completed, files.length)
          }

          // NEW: Call onFileComplete callback with the error result
          if (options?.onFileComplete) {
            options.onFileComplete(fileIndex, errorResult)
          }

          if (!options?.continueOnError) {
            throw error
          }

          return errorResult
        })

      activeTransfers.set(fileIndex, transferPromise)
    }

    // Start initial batch of transfers
    while (nextFileIndex < Math.min(CONCURRENT_LIMIT, files.length) && !this.stopped) {
      startTransfer(nextFileIndex)
      nextFileIndex++
    }

    // Continuously maintain CONCURRENT_LIMIT active transfers
    while (activeTransfers.size > 0 && !this.stopped) {
      // Wait for any transfer to complete
      await Promise.race(Array.from(activeTransfers.values()))

      // Start next transfer if there are more files
      if (nextFileIndex < files.length) {
        startTransfer(nextFileIndex)
        nextFileIndex++
      }
    }

    if (this.stopped) {
      throw new Error('Batch transfer cancelled')
    }

    return results
  }

  /**
   * Stop ongoing transfer
   * Uses two-phase shutdown to prevent race conditions:
   * 1. Set stopping flag to prevent new transfers
   * 2. Wait for active transfers to complete or abort them
   * 3. Clean up resources
   */
  async stop(): Promise<void> {
    // Phase 1: Prevent new transfers from starting
    this.stopping = true

    // Phase 2: Abort current transfer if any
    if (this.currentTransfer) {
      this.currentTransfer.abort()
      this.currentTransfer = null
    }

    // Phase 3: Wait for active transfers to complete (with timeout)
    const maxWaitTime = 5000 // 5 seconds max wait
    const startTime = Date.now()

    while (this.activeTransferCount > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (this.activeTransferCount > 0) {
      getLogger().warn('Stopping with active transfers still running', {
        activeCount: this.activeTransferCount
      })
    }

    // Phase 4: Set final stopped flag
    this.stopped = true

    // Phase 5: Clean up all active temp files
    const tempFilesToClean = Array.from(this.activeTempFiles)
    this.activeTempFiles.clear()

    for (const tempFile of tempFilesToClean) {
      try {
        await unlink(tempFile)
        getLogger().info('Cleaned up partial file during transfer stop', { path: tempFile })
      } catch (error) {
        getLogger().warn('Failed to clean up partial file', {
          path: tempFile,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // Give a brief moment for any ongoing file operations to complete their cleanup
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  /**
   * Reset stopped flag for reuse
   */
  reset(): void {
    this.stopped = false
    this.stopping = false
    this.currentTransfer = null
    this.activeTempFiles.clear()
    this.activeTransferCount = 0
  }

  /**
   * Check if transfers are currently in progress
   */
  isTransferring(): boolean {
    // Check if we have active transfers
    return this.activeTransferCount > 0 || (this.activeTempFiles.size > 0 && !this.stopped)
  }

  /**
   * Copy file with streaming checksum calculation during transfer
   */
  private async copyFileWithStreamingChecksum(
    sourcePath: string,
    destPath: string,
    totalBytes: number,
    bufferSize: number,
    options?: TransferOptions
  ): Promise<{ sourceChecksum: string; destChecksum: string }> {
    return new Promise((resolve, reject) => {
      let bytesTransferred = 0
      let lastProgressTime = Date.now()
      let lastBytesTransferred = 0

      // Dynamic throttling based on file size
      const { interval: PROGRESS_INTERVAL, minBytes: MIN_BYTES_FOR_PROGRESS } =
        this.calculateProgressThrottle(totalBytes)

      // Import XXHash64 for streaming checksum
      const { XXHash64 } = require('xxhash-addon') // eslint-disable-line @typescript-eslint/no-require-imports
      const seed = Buffer.alloc(8)
      const sourceHasher = new XXHash64(seed)
      const destHasher = new XXHash64(seed)

      const readStream = createReadStream(sourcePath, {
        highWaterMark: bufferSize
      })

      const writeStream = createWriteStream(destPath, {
        highWaterMark: bufferSize
      })

      // Setup abort handler
      const abort = (): void => {
        readStream.destroy()
        writeStream.destroy()
        reject(new Error('Transfer stopped'))
      }

      this.currentTransfer = { abort }

      readStream.on('data', (chunk: string | Buffer) => {
        if (this.stopped) {
          abort()
          return
        }

        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytesTransferred += buf.length

        // Detect if we're reading more than file size (corruption indicator)
        if (bytesTransferred > totalBytes) {
          readStream.destroy()
          writeStream.destroy()
          reject(TransferError.fromValidation('File size mismatch - possible source corruption'))
          return
        }

        // Update both hashers with the same data
        sourceHasher.update(buf)
        destHasher.update(buf)

        // Report progress only if enough time has passed AND enough bytes transferred
        if (options?.onProgress) {
          const now = Date.now()
          const timeDelta = now - lastProgressTime
          const bytesDelta = bytesTransferred - lastBytesTransferred

          if (timeDelta >= PROGRESS_INTERVAL || bytesDelta >= MIN_BYTES_FOR_PROGRESS) {
            const speed = timeDelta > 0 ? (bytesDelta / timeDelta) * 1000 : 0 // bytes per second
            const percentage = totalBytes > 0 ? (bytesTransferred / totalBytes) * 100 : 0

            options.onProgress({
              bytesTransferred,
              totalBytes,
              percentage,
              speed
            })

            lastProgressTime = now
            lastBytesTransferred = bytesTransferred
          }
        }
      })

      readStream.on('error', (error) => {
        writeStream.destroy()
        const nodeError = error as NodeJS.ErrnoException
        reject(TransferError.fromNodeError(nodeError))
      })

      writeStream.on('error', (error) => {
        readStream.destroy()
        const nodeError = error as NodeJS.ErrnoException
        reject(TransferError.fromNodeError(nodeError))
      })

      readStream.on('end', () => {
        // Verify we read exactly what we expected
        if (bytesTransferred !== totalBytes) {
          writeStream.destroy()
          reject(
            TransferError.fromValidation(
              `Incomplete read: expected ${totalBytes} bytes, got ${bytesTransferred} bytes`
            )
          )
        }
      })

      writeStream.on('finish', () => {
        // Final progress report
        if (options?.onProgress) {
          options.onProgress({
            bytesTransferred: totalBytes,
            totalBytes,
            percentage: 100,
            speed: 0
          })
        }

        // Calculate final checksums
        const sourceChecksum = sourceHasher.digest().toString('hex')
        const destChecksum = destHasher.digest().toString('hex')

        resolve({ sourceChecksum, destChecksum })
      })

      readStream.pipe(writeStream)
    })
  }

  /**
   * Copy file with progress tracking
   */
  private async copyFileWithProgress(
    sourcePath: string,
    destPath: string,
    totalBytes: number,
    bufferSize: number,
    options?: TransferOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let bytesTransferred = 0
      let lastProgressTime = Date.now()
      let lastBytesTransferred = 0

      // Dynamic throttling based on file size
      const { interval: PROGRESS_INTERVAL, minBytes: MIN_BYTES_FOR_PROGRESS } =
        this.calculateProgressThrottle(totalBytes)

      const readStream = createReadStream(sourcePath, {
        highWaterMark: bufferSize
      })

      const writeStream = createWriteStream(destPath, {
        highWaterMark: bufferSize
      })

      // Setup abort handler
      const abort = (): void => {
        readStream.destroy()
        writeStream.destroy()
        reject(new Error('Transfer stopped'))
      }

      this.currentTransfer = { abort }

      readStream.on('data', (chunk: string | Buffer) => {
        if (this.stopped) {
          abort()
          return
        }

        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytesTransferred += buf.length

        // Detect if we're reading more than file size (corruption indicator)
        if (bytesTransferred > totalBytes) {
          readStream.destroy()
          writeStream.destroy()
          reject(TransferError.fromValidation('File size mismatch - possible source corruption'))
          return
        }

        // Report progress only if enough time has passed AND enough bytes transferred
        if (options?.onProgress) {
          const now = Date.now()
          const timeDelta = now - lastProgressTime
          const bytesDelta = bytesTransferred - lastBytesTransferred

          if (timeDelta >= PROGRESS_INTERVAL || bytesDelta >= MIN_BYTES_FOR_PROGRESS) {
            const speed = timeDelta > 0 ? (bytesDelta / timeDelta) * 1000 : 0 // bytes per second
            const percentage = totalBytes > 0 ? (bytesTransferred / totalBytes) * 100 : 0

            options.onProgress({
              bytesTransferred,
              totalBytes,
              percentage,
              speed
            })

            lastProgressTime = now
            lastBytesTransferred = bytesTransferred
          }
        }
      })

      readStream.on('error', (error) => {
        writeStream.destroy()
        const nodeError = error as NodeJS.ErrnoException
        reject(TransferError.fromNodeError(nodeError))
      })

      writeStream.on('error', (error) => {
        readStream.destroy()
        const nodeError = error as NodeJS.ErrnoException
        reject(TransferError.fromNodeError(nodeError))
      })

      readStream.on('end', () => {
        // Verify we read exactly what we expected
        if (bytesTransferred !== totalBytes) {
          writeStream.destroy()
          reject(
            TransferError.fromValidation(
              `Incomplete read: expected ${totalBytes} bytes, got ${bytesTransferred} bytes`
            )
          )
        }
      })

      writeStream.on('finish', () => {
        // Final progress report
        if (options?.onProgress) {
          options.onProgress({
            bytesTransferred: totalBytes,
            totalBytes,
            percentage: 100,
            speed: 0
          })
        }
        resolve()
      })

      readStream.pipe(writeStream)
    })
  }
}

/**
 * Convenience function to transfer a single file
 */
export async function transferFile(
  sourcePath: string,
  destPath: string,
  options?: TransferOptions
): Promise<TransferResult> {
  const engine = new FileTransferEngine()
  return engine.transferFile(sourcePath, destPath, options)
}

/**
 * Convenience function to transfer multiple files
 */
export async function transferFiles(
  files: Array<{ source: string; dest: string }>,
  options?: TransferOptions
): Promise<TransferResult[]> {
  const engine = new FileTransferEngine()
  return engine.transferFiles(files, options)
}

/**
 * Clean up orphaned .TBPART files in a directory
 * These are partial files left over from failed or interrupted transfers
 */
export async function cleanupOrphanedPartFiles(directory: string): Promise<number> {
  const logger = getLogger()
  let cleaned = 0

  try {
    // Check if directory exists
    await access(directory, constants.R_OK)

    // Recursively scan for .TBPART files
    const partFiles = await findPartFiles(directory)

    for (const file of partFiles) {
      try {
        await unlink(file)
        cleaned++
        logger.info('Cleaned orphaned .TBPART file', { path: file })
      } catch (error) {
        logger.warn('Failed to clean .TBPART file', {
          file,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (cleaned > 0) {
      logger.info('Cleanup complete', { count: cleaned, directory })
    }
  } catch (error) {
    logger.error('Failed to cleanup orphaned files', {
      directory,
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return cleaned
}

/**
 * Recursively find .TBPART files in a directory
 */
/**
 * Check if a .TBPART file is old enough to be considered orphaned
 * Only files older than 24 hours are considered orphaned to avoid removing active transfers
 */
async function isOrphanedPartFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath)
    const age = Date.now() - stats.mtimeMs
    return age > ORPHANED_FILE_MAX_AGE_MS
  } catch {
    // If we can't stat it, assume it's not orphaned (safer default)
    return false
  }
}

async function findPartFiles(dirPath: string): Promise<string[]> {
  const partFiles: string[] = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      try {
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await findPartFiles(fullPath)
          partFiles.push(...subFiles)
        } else if (entry.isFile() && entry.name.endsWith('.TBPART')) {
          // Only include files that are old enough to be considered orphaned
          if (await isOrphanedPartFile(fullPath)) {
            partFiles.push(fullPath)
          }
        }
      } catch {
        // Skip files/directories that can't be accessed
        continue
      }
    }
  } catch {
    // Skip directories that can't be accessed
  }

  return partFiles
}
