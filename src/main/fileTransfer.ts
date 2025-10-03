/**
 * File Transfer Engine Module
 * Handles file transfers with atomic operations, checksum verification, and progress tracking
 */

import { createReadStream, createWriteStream } from 'fs'
import { stat, mkdir, rename, unlink, chmod, access, constants } from 'fs/promises'
import * as path from 'path'
import { calculateChecksum } from './checksumCalculator'

export interface TransferProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speed: number // Bytes per second
}

export interface TransferOptions {
  bufferSize?: number // Buffer size for copying (default: 64KB)
  verifyChecksum?: boolean // Verify checksum after transfer
  overwrite?: boolean // Allow overwriting existing files
  continueOnError?: boolean // Continue batch transfer on error
  preservePermissions?: boolean // Preserve file permissions (default: true)
  onProgress?: (progress: TransferProgress) => void
  onBatchProgress?: (completed: number, total: number) => void
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

const DEFAULT_BUFFER_SIZE = 65536 // 64KB

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
          if ((error as any).code !== 'ENOENT') {
            throw error
          }
        }
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath)
      await mkdir(destDir, { recursive: true })

      // Copy file to .TBPART with progress tracking
      await this.copyFileWithProgress(sourcePath, tempPath, totalBytes, bufferSize, options)

      result.bytesTransferred = totalBytes

      // Verify checksum if requested
      if (options?.verifyChecksum) {
        const [sourceChecksum, destChecksum] = await Promise.all([
          calculateChecksum(sourcePath),
          calculateChecksum(tempPath)
        ])

        result.sourceChecksum = sourceChecksum
        result.destChecksum = destChecksum

        if (sourceChecksum !== destChecksum) {
          throw new Error('Checksum verification failed')
        }

        result.checksumVerified = true
      }

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
   * Transfer multiple files in batch
   */
  async transferFiles(
    files: Array<{ source: string; dest: string }>,
    options?: TransferOptions
  ): Promise<TransferResult[]> {
    const results: TransferResult[] = []
    let completed = 0

    for (const file of files) {
      if (this.stopped) {
        throw new Error('Batch transfer cancelled')
      }

      try {
        const result = await this.transferFile(file.source, file.dest, options)
        results.push(result)
        completed++

        if (options?.onBatchProgress) {
          options.onBatchProgress(completed, files.length)
        }
      } catch (error) {
        const errorResult: TransferResult = {
          success: false,
          sourcePath: file.source,
          destPath: file.dest,
          bytesTransferred: 0,
          checksumVerified: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        }

        results.push(errorResult)

        // Stop on error unless continueOnError is true
        if (!options?.continueOnError) {
          throw error
        }

        completed++
        if (options?.onBatchProgress) {
          options.onBatchProgress(completed, files.length)
        }
      }
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

      const readStream = createReadStream(sourcePath, {
        highWaterMark: bufferSize
      })

      const writeStream = createWriteStream(destPath, {
        highWaterMark: bufferSize
      })

      // Setup abort handler
      const abort = () => {
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

        // Report progress
        if (options?.onProgress) {
          const now = Date.now()
          const timeDelta = (now - lastProgressTime) / 1000 // seconds
          const bytesDelta = bytesTransferred - lastBytesTransferred

          const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0
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
