/**
 * File Transfer Engine Module
 * Handles file transfers with atomic operations, checksum verification, and progress tracking
 */

import { createReadStream, createWriteStream } from 'fs'
import { stat, mkdir, rename, unlink, chmod, access, constants } from 'fs/promises'
import * as path from 'path'

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
  duration: number // milliseconds
}

const DEFAULT_BUFFER_SIZE = 4 * 1024 * 1024 // 4MB - optimized for modern SSDs

/**
 * File Transfer Engine Class
 * Provides atomic file transfers with progress tracking and verification
 */
export class FileTransferEngine {
  private stopped = false
  private currentTransfer: { abort: () => void } | null = null

  /**
   * Transfer a single file with atomic operations
   */
  async transferFile(
    sourcePath: string,
    destPath: string,
    options?: TransferOptions
  ): Promise<TransferResult> {
    const startTime = Date.now()
    const bufferSize = options?.bufferSize || DEFAULT_BUFFER_SIZE
    const tempPath = destPath + '.TBPART'

    const result: TransferResult = {
      success: false,
      sourcePath,
      destPath,
      bytesTransferred: 0,
      checksumVerified: false,
      duration: 0
    }

    try {
      // Check if stopped before starting
      if (this.stopped) {
        throw new Error('Transfer cancelled')
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
          throw new Error('Checksum verification failed')
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

      // Atomic rename: .TBPART -> final file
      await rename(tempPath, destPath)

      result.success = true
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error'

      // Cleanup .TBPART file on error
      try {
        await unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }

      throw error
    } finally {
      result.duration = Date.now() - startTime
      this.currentTransfer = null
    }

    return result
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
      (sum, info) => sum + info.totalBytes,
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
        totalBytesTransferred += bytes
      })

      // Add bytes from active transfers
      fileProgress.forEach((progress) => {
        totalBytesTransferred += progress.bytesTransferred
        totalSpeed += progress.speed
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

          const errorResult: TransferResult = {
            success: false,
            sourcePath: file.source,
            destPath: file.dest,
            bytesTransferred: 0,
            checksumVerified: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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
   */
  stop(): void {
    this.stopped = true
    if (this.currentTransfer) {
      this.currentTransfer.abort()
    }
  }

  /**
   * Reset stopped flag for reuse
   */
  reset(): void {
    this.stopped = false
    this.currentTransfer = null
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
      const PROGRESS_INTERVAL = 200 // Report progress every 200ms
      const MIN_BYTES_FOR_PROGRESS = 2 * 1024 * 1024 // Report every 2MB minimum

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
        reject(new Error(`Read error: ${error.message}`))
      })

      writeStream.on('error', (error) => {
        readStream.destroy()
        reject(new Error(`Write error: ${error.message}`))
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
      const PROGRESS_INTERVAL = 200 // Report progress every 200ms
      const MIN_BYTES_FOR_PROGRESS = 2 * 1024 * 1024 // Report every 2MB minimum

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
        reject(new Error(`Read error: ${error.message}`))
      })

      writeStream.on('error', (error) => {
        readStream.destroy()
        reject(new Error(`Write error: ${error.message}`))
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
