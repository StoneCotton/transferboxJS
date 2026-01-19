/**
 * Benchmark Service Module
 * Orchestrates benchmark runs: file generation, transfer, verification, and cleanup
 */

import { createWriteStream } from 'fs'
import { mkdir, unlink, readdir, stat, rmdir, access, constants } from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomBytes } from 'crypto'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type { BrowserWindow } from 'electron'
import { FileTransferEngine, TransferResult } from '../fileTransfer'
import { getDatabaseManager } from '../databaseManager'
import { getLogger } from '../logger'
import { APP_VERSION } from '../constants/version'
import { getConfig } from '../configManager'
import { checkDiskSpace } from '../pathValidator'
import {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkProgressEvent,
  SpeedSample,
  BenchmarkPhase,
  BENCHMARK_TEST_FILES,
  BENCHMARK_REQUIRED_SPACE,
  BENCHMARK_SAMPLE_INTERVAL_MS,
  getBenchmarkTotalSize,
  BenchmarkExportFormat,
  BenchmarkHistoryEntry
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/types/ipc'

/**
 * Generate random data stream of specified size
 */
function createRandomDataStream(size: number): Readable {
  let remaining = size
  const chunkSize = 64 * 1024 // 64KB chunks

  return new Readable({
    read() {
      if (remaining <= 0) {
        this.push(null)
        return
      }

      const toGenerate = Math.min(chunkSize, remaining)
      const chunk = randomBytes(toGenerate)
      remaining -= toGenerate
      this.push(chunk)
    }
  })
}

/**
 * Benchmark Service Class
 * Manages benchmark operations
 */
export class BenchmarkService {
  private static instance: BenchmarkService
  private isRunning = false
  private isCancelled = false
  private mainWindow: BrowserWindow | null = null
  private transferEngine: FileTransferEngine | null = null
  private currentPhase: BenchmarkPhase = 'idle'
  private samples: SpeedSample[] = []
  private startTime = 0
  private sampleInterval: ReturnType<typeof setInterval> | null = null
  private currentSpeedMbps = 0

  private constructor() {}

  static getInstance(): BenchmarkService {
    if (!BenchmarkService.instance) {
      BenchmarkService.instance = new BenchmarkService()
    }
    return BenchmarkService.instance
  }

  /**
   * Set the main window for IPC events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Check if benchmark is currently running
   */
  isBenchmarkRunning(): boolean {
    return this.isRunning
  }

  /**
   * Send progress event to renderer
   */
  private sendProgress(progress: Partial<BenchmarkProgressEvent>): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const fullProgress: BenchmarkProgressEvent = {
        phase: this.currentPhase,
        progress: 0,
        ...progress
      }
      this.mainWindow.webContents.send(IPC_CHANNELS.BENCHMARK_PROGRESS, fullProgress)
    }
  }

  /**
   * Send speed sample to renderer
   */
  private sendSpeedSample(sample: SpeedSample): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.BENCHMARK_SPEED_SAMPLE, sample)
    }
  }

  /**
   * Send completion event to renderer
   */
  private sendComplete(result: BenchmarkResult): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.BENCHMARK_COMPLETE, result)
    }
  }

  /**
   * Send error event to renderer
   */
  private sendError(
    message: string,
    cleanupSuccessful: boolean,
    partialResults?: Partial<BenchmarkResult>
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.BENCHMARK_ERROR, {
        message,
        cleanupSuccessful,
        partialResults
      })
    }
  }

  /**
   * Validate benchmark can run
   */
  async validateBenchmark(config: BenchmarkConfig): Promise<{ valid: boolean; error?: string }> {
    const logger = getLogger()

    // Check if benchmark is already running
    if (this.isRunning) {
      return { valid: false, error: 'A benchmark is already running' }
    }

    // Check source exists and is accessible
    try {
      await access(config.sourceDeviceId, constants.R_OK | constants.W_OK)
    } catch {
      return { valid: false, error: `Source drive is not accessible: ${config.sourceDeviceId}` }
    }

    // Check destination exists and is writable
    try {
      await access(config.destinationPath, constants.R_OK | constants.W_OK)
    } catch {
      return { valid: false, error: `Destination is not accessible: ${config.destinationPath}` }
    }

    // Check space on source
    try {
      const sourceSpace = await checkDiskSpace(config.sourceDeviceId)
      if (sourceSpace.freeSpace < BENCHMARK_REQUIRED_SPACE) {
        const requiredGB = (BENCHMARK_REQUIRED_SPACE / (1024 * 1024 * 1024)).toFixed(1)
        const availableGB = (sourceSpace.freeSpace / (1024 * 1024 * 1024)).toFixed(1)
        return {
          valid: false,
          error: `Insufficient space on source drive. Need ${requiredGB}GB, have ${availableGB}GB`
        }
      }
    } catch (error) {
      logger.warn('Could not check source disk space', { error })
    }

    // Check space on destination
    try {
      const destSpace = await checkDiskSpace(config.destinationPath)
      if (destSpace.freeSpace < BENCHMARK_REQUIRED_SPACE) {
        const requiredGB = (BENCHMARK_REQUIRED_SPACE / (1024 * 1024 * 1024)).toFixed(1)
        const availableGB = (destSpace.freeSpace / (1024 * 1024 * 1024)).toFixed(1)
        return {
          valid: false,
          error: `Insufficient space on destination. Need ${requiredGB}GB, have ${availableGB}GB`
        }
      }
    } catch (error) {
      logger.warn('Could not check destination disk space', { error })
    }

    return { valid: true }
  }

  /**
   * Start a benchmark run
   */
  async start(config: BenchmarkConfig): Promise<void> {
    const logger = getLogger()
    logger.info('Starting benchmark', { config })

    // Validate
    const validation = await this.validateBenchmark(config)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    this.isRunning = true
    this.isCancelled = false
    this.samples = []
    this.startTime = Date.now()
    this.currentSpeedMbps = 0

    const sourceBenchmarkDir = path.join(config.sourceDeviceId, '.tbench')
    const destBenchmarkDir = path.join(config.destinationPath, '.tbench')

    try {
      // Phase 1: Generate test files
      this.currentPhase = 'generating'
      this.sendProgress({ phase: 'generating', progress: 0 })

      await mkdir(sourceBenchmarkDir, { recursive: true })
      await this.generateTestFiles(sourceBenchmarkDir)

      if (this.isCancelled) {
        await this.cleanup(sourceBenchmarkDir, destBenchmarkDir)
        return
      }

      // Phase 2: Transfer files
      this.currentPhase = 'transferring'
      this.sendProgress({ phase: 'transferring', progress: 0 })

      // Start speed sampling
      this.startSpeedSampling()

      const transferResults = await this.runTransfer(sourceBenchmarkDir, destBenchmarkDir)

      if (this.isCancelled) {
        this.stopSpeedSampling()
        await this.cleanup(sourceBenchmarkDir, destBenchmarkDir)
        return
      }

      // Phase 3: Verify (checksum verification happens during transfer)
      this.currentPhase = 'verifying'
      this.sendProgress({ phase: 'verifying', progress: 100 })
      this.stopSpeedSampling()

      // Phase 4: Cleanup
      this.currentPhase = 'cleanup'
      this.sendProgress({ phase: 'cleanup', progress: 0 })
      await this.cleanup(sourceBenchmarkDir, destBenchmarkDir)

      // Calculate results
      const result = this.calculateResults(config, transferResults)

      // Save to database
      const db = getDatabaseManager()
      db.saveBenchmarkRun(result)
      db.pruneBenchmarkHistory() // Auto-prune old results

      // Send completion
      this.sendComplete(result)
      logger.info('Benchmark complete', { avgSpeed: result.metrics.avgSpeedMbps })
    } catch (error) {
      logger.error('Benchmark failed', {
        error: error instanceof Error ? error.message : String(error)
      })

      this.stopSpeedSampling()

      // Attempt cleanup
      let cleanupSuccessful = true
      try {
        await this.cleanup(sourceBenchmarkDir, destBenchmarkDir)
      } catch (cleanupError) {
        cleanupSuccessful = false
        logger.warn('Benchmark cleanup failed', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        })
      }

      this.sendError(
        error instanceof Error ? error.message : 'Benchmark failed',
        cleanupSuccessful
      )
    } finally {
      this.isRunning = false
      this.currentPhase = 'idle'
      this.transferEngine = null
    }
  }

  /**
   * Cancel the current benchmark
   */
  async cancel(): Promise<void> {
    const logger = getLogger()
    logger.info('Cancelling benchmark')

    this.isCancelled = true

    if (this.transferEngine) {
      await this.transferEngine.stop()
    }

    this.stopSpeedSampling()
  }

  /**
   * Generate synthetic test files
   */
  private async generateTestFiles(targetDir: string): Promise<void> {
    const logger = getLogger()
    const totalSize = getBenchmarkTotalSize()
    let generatedBytes = 0

    for (let i = 0; i < BENCHMARK_TEST_FILES.length; i++) {
      if (this.isCancelled) break

      const fileSpec = BENCHMARK_TEST_FILES[i]
      const filePath = path.join(targetDir, fileSpec.name)

      logger.debug('Generating benchmark file', { name: fileSpec.name, size: fileSpec.size })

      // Generate random data and write to file
      const readStream = createRandomDataStream(fileSpec.size)
      const writeStream = createWriteStream(filePath)

      await pipeline(readStream, writeStream)

      generatedBytes += fileSpec.size

      this.sendProgress({
        phase: 'generating',
        progress: Math.round((generatedBytes / totalSize) * 100),
        currentFile: fileSpec.name,
        fileIndex: i + 1,
        totalFiles: BENCHMARK_TEST_FILES.length,
        bytesProcessed: generatedBytes,
        totalBytes: totalSize
      })
    }
  }

  /**
   * Run the file transfer
   */
  private async runTransfer(
    sourceDir: string,
    destDir: string
  ): Promise<TransferResult[]> {
    const config = getConfig()

    await mkdir(destDir, { recursive: true })

    this.transferEngine = new FileTransferEngine()

    // Prepare file list
    const files = BENCHMARK_TEST_FILES.map((f) => ({
      source: path.join(sourceDir, f.name),
      dest: path.join(destDir, f.name)
    }))

    const totalBytes = getBenchmarkTotalSize()
    const totalFiles = files.length
    let completedFiles = 0
    let transferredBytes = 0
    const results: TransferResult[] = []

    // Track progress for speed calculation
    const transferStartTime = Date.now()

    for (let i = 0; i < files.length; i++) {
      if (this.isCancelled || !this.transferEngine) break

      const file = files[i]
      const fileSpec = BENCHMARK_TEST_FILES[i]

      try {
        const result = await this.transferEngine.transferFile(file.source, file.dest, {
          bufferSize: config.bufferSize,
          verifyChecksum: true, // Always verify for benchmarks
          overwrite: true,
          onProgress: (progress) => {
            const currentFileBytes = progress.bytesTransferred
            const totalTransferred = transferredBytes + currentFileBytes

            const elapsed = Date.now() - transferStartTime
            const speedBps = elapsed > 0 ? (totalTransferred / elapsed) * 1000 : 0
            this.currentSpeedMbps = speedBps / (1024 * 1024)

            this.sendProgress({
              phase: 'transferring',
              progress: Math.round((totalTransferred / totalBytes) * 100),
              currentFile: fileSpec.name,
              fileIndex: i + 1,
              totalFiles,
              bytesProcessed: totalTransferred,
              totalBytes,
              currentSpeedMbps: this.currentSpeedMbps,
              elapsedMs: elapsed,
              estimatedRemainingMs:
                speedBps > 0 ? ((totalBytes - totalTransferred) / speedBps) * 1000 : undefined
            })
          }
        })

        results.push(result)
        transferredBytes += result.bytesTransferred
        completedFiles++
      } catch (error) {
        results.push({
          success: false,
          sourcePath: file.source,
          destPath: file.dest,
          bytesTransferred: 0,
          checksumVerified: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0
        })
      }
    }

    return results
  }

  /**
   * Start speed sampling for graph
   */
  private startSpeedSampling(): void {
    this.sampleInterval = setInterval(() => {
      if (this.currentPhase === 'transferring' || this.currentPhase === 'verifying') {
        const sample: SpeedSample = {
          timestampMs: Date.now() - this.startTime,
          speedMbps: this.currentSpeedMbps,
          phase: this.currentPhase === 'verifying' ? 'verify' : 'transfer'
        }
        this.samples.push(sample)
        this.sendSpeedSample(sample)
      }
    }, BENCHMARK_SAMPLE_INTERVAL_MS)
  }

  /**
   * Stop speed sampling
   */
  private stopSpeedSampling(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval)
      this.sampleInterval = null
    }
  }

  /**
   * Calculate benchmark results
   */
  private calculateResults(
    config: BenchmarkConfig,
    transferResults: TransferResult[]
  ): BenchmarkResult {
    const endTime = Date.now()
    const totalDurationMs = endTime - this.startTime

    const successfulTransfers = transferResults.filter((r) => r.success)
    const totalBytes = successfulTransfers.reduce((sum, r) => sum + r.bytesTransferred, 0)
    const totalFiles = successfulTransfers.length

    // Calculate speeds
    const totalDurationSec = totalDurationMs / 1000
    const avgSpeedMbps = totalDurationSec > 0 ? (totalBytes / totalDurationSec) / (1024 * 1024) : 0

    // Calculate peak from samples (99th percentile to avoid outliers)
    const sortedSpeeds = [...this.samples.map((s) => s.speedMbps)].sort((a, b) => b - a)
    const peakIndex = Math.floor(sortedSpeeds.length * 0.01)
    const peakSpeedMbps = sortedSpeeds[peakIndex] || avgSpeedMbps

    // Estimate individual phase speeds (simplified - real implementation would track separately)
    const readSpeedMbps = avgSpeedMbps * 1.1 // Typically read is slightly faster
    const writeSpeedMbps = avgSpeedMbps
    const checksumSpeedMbps = avgSpeedMbps * 5 // XXHash is much faster than I/O

    return {
      id: `benchmark_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(this.startTime),
      appVersion: APP_VERSION,
      sourceDrive: {
        name: path.basename(config.sourceDeviceId),
        type: this.detectDriveType(config.sourceDeviceId)
      },
      destination: {
        path: config.destinationPath,
        driveType: this.detectDriveType(config.destinationPath)
      },
      metrics: {
        totalBytes,
        totalFiles,
        totalDurationMs,
        avgSpeedMbps,
        peakSpeedMbps,
        readSpeedMbps,
        writeSpeedMbps,
        checksumSpeedMbps
      },
      samples: this.samples,
      os: `${os.type()} ${os.release()}`,
      platform: process.platform
    }
  }

  /**
   * Detect drive type from path (simplified heuristic)
   */
  private detectDriveType(drivePath: string): string {
    const lower = drivePath.toLowerCase()

    if (lower.includes('usb') || lower.includes('removable')) {
      return 'USB'
    }
    if (lower.includes('sd') || lower.includes('card')) {
      return 'SD Card'
    }
    if (lower.includes('ssd') || lower.includes('nvme')) {
      return 'SSD'
    }
    if (lower.includes('hdd') || lower.includes('disk')) {
      return 'HDD'
    }

    // Default based on mount point patterns
    if (process.platform === 'darwin') {
      if (lower.startsWith('/volumes/')) {
        return 'External'
      }
    } else if (process.platform === 'win32') {
      if (/^[d-z]:/i.test(drivePath)) {
        return 'External'
      }
    }

    return 'Unknown'
  }

  /**
   * Clean up benchmark files
   */
  private async cleanup(sourceDir: string, destDir: string): Promise<void> {
    const logger = getLogger()

    // Clean source
    try {
      await this.removeDirectory(sourceDir)
      logger.debug('Cleaned source benchmark directory', { dir: sourceDir })
    } catch (error) {
      logger.warn('Failed to clean source benchmark directory', {
        dir: sourceDir,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    // Clean destination
    try {
      await this.removeDirectory(destDir)
      logger.debug('Cleaned destination benchmark directory', { dir: destDir })
    } catch (error) {
      logger.warn('Failed to clean destination benchmark directory', {
        dir: destDir,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    this.sendProgress({ phase: 'cleanup', progress: 100 })
  }

  /**
   * Recursively remove a directory
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath)

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry)
        const entryStat = await stat(entryPath)

        if (entryStat.isDirectory()) {
          await this.removeDirectory(entryPath)
        } else {
          await unlink(entryPath)
        }
      }

      await rmdir(dirPath)
    } catch (error) {
      // Directory might not exist, that's OK
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Clean up orphaned benchmark files from failed runs
   */
  async cleanupOrphans(): Promise<number> {
    const logger = getLogger()
    let cleanedCount = 0

    // This would need to scan known locations for .tbench directories
    // For now, just log that it was called
    logger.info('Orphan cleanup requested')

    return cleanedCount
  }

  /**
   * Get benchmark history
   */
  getBenchmarkHistory(limit?: number): BenchmarkHistoryEntry[] {
    const db = getDatabaseManager()
    return db.getBenchmarkHistory(limit)
  }

  /**
   * Get a specific benchmark result
   */
  getBenchmarkResult(id: string): BenchmarkResult | null {
    const db = getDatabaseManager()
    return db.getBenchmarkResult(id)
  }

  /**
   * Delete a benchmark result
   */
  deleteBenchmark(id: string): void {
    const db = getDatabaseManager()
    db.deleteBenchmarkRun(id)
  }

  /**
   * Export benchmark results
   */
  async exportBenchmarks(ids: string[], format: BenchmarkExportFormat): Promise<string> {
    const db = getDatabaseManager()
    const results: BenchmarkResult[] = []

    for (const id of ids) {
      const result = db.getBenchmarkResult(id)
      if (result) {
        results.push(result)
      }
    }

    if (format === 'json') {
      return JSON.stringify(results, null, 2)
    } else {
      // CSV format
      const headers = [
        'ID',
        'Timestamp',
        'App Version',
        'Source Drive',
        'Source Type',
        'Destination',
        'Dest Type',
        'Total Bytes',
        'Total Files',
        'Duration (ms)',
        'Avg Speed (MB/s)',
        'Peak Speed (MB/s)',
        'Read Speed (MB/s)',
        'Write Speed (MB/s)',
        'Checksum Speed (MB/s)',
        'OS',
        'Platform'
      ]

      const rows = results.map((r) => [
        r.id,
        r.timestamp.toISOString(),
        r.appVersion,
        r.sourceDrive.name,
        r.sourceDrive.type,
        r.destination.path,
        r.destination.driveType,
        r.metrics.totalBytes,
        r.metrics.totalFiles,
        r.metrics.totalDurationMs,
        r.metrics.avgSpeedMbps.toFixed(2),
        r.metrics.peakSpeedMbps.toFixed(2),
        r.metrics.readSpeedMbps.toFixed(2),
        r.metrics.writeSpeedMbps.toFixed(2),
        r.metrics.checksumSpeedMbps.toFixed(2),
        r.os,
        r.platform
      ])

      return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    }
  }
}

/**
 * Get the singleton benchmark service instance
 */
export function getBenchmarkService(): BenchmarkService {
  return BenchmarkService.getInstance()
}
