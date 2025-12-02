/**
 * Progress Tracker Utility
 * Handles progress tracking and throttling for file transfers
 */

import {
  SMALL_FILE_THRESHOLD,
  MEDIUM_FILE_THRESHOLD,
  LARGE_FILE_THRESHOLD,
  PROGRESS_SMALL_FILE,
  PROGRESS_MEDIUM_FILE,
  PROGRESS_LARGE_FILE,
  PROGRESS_XLARGE_FILE
} from '../constants/fileConstants'

/**
 * Progress data structure
 */
export interface ProgressData {
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speed: number // Bytes per second
}

/**
 * Throttle configuration
 */
export interface ThrottleConfig {
  interval: number // Minimum time between updates in ms
  minBytes: number // Minimum bytes transferred between updates
}

/**
 * Progress Tracker Class
 * Tracks transfer progress with intelligent throttling based on file size
 */
export class ProgressTracker {
  private totalBytes: number
  private bytesTransferred: number = 0
  private lastProgressTime: number
  private lastBytesTransferred: number = 0
  private startTime: number
  private throttleConfig: ThrottleConfig

  constructor(totalBytes: number) {
    this.totalBytes = totalBytes
    this.startTime = Date.now()
    this.lastProgressTime = this.startTime
    this.throttleConfig = this.calculateThrottleConfig(totalBytes)
  }

  /**
   * Calculate optimal throttle configuration based on file size
   * Larger files get less frequent updates to prevent UI lag
   */
  private calculateThrottleConfig(fileSize: number): ThrottleConfig {
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
   * Update bytes transferred
   * @returns true if progress should be reported based on throttling
   */
  update(newBytes: number): boolean {
    this.bytesTransferred += newBytes

    const now = Date.now()
    const timeDelta = now - this.lastProgressTime
    const bytesDelta = this.bytesTransferred - this.lastBytesTransferred

    // Check if we should report progress
    if (
      timeDelta >= this.throttleConfig.interval ||
      bytesDelta >= this.throttleConfig.minBytes
    ) {
      return true
    }

    return false
  }

  /**
   * Get current progress data
   */
  getProgress(): ProgressData {
    const now = Date.now()
    const timeDelta = now - this.lastProgressTime
    const bytesDelta = this.bytesTransferred - this.lastBytesTransferred

    const speed = timeDelta > 0 ? (bytesDelta / timeDelta) * 1000 : 0
    const percentage = this.totalBytes > 0 ? (this.bytesTransferred / this.totalBytes) * 100 : 0

    return {
      bytesTransferred: this.bytesTransferred,
      totalBytes: this.totalBytes,
      percentage,
      speed
    }
  }

  /**
   * Commit progress report (update last reported values)
   */
  commitProgress(): void {
    this.lastProgressTime = Date.now()
    this.lastBytesTransferred = this.bytesTransferred
  }

  /**
   * Get final progress (100% complete)
   */
  getFinalProgress(): ProgressData {
    return {
      bytesTransferred: this.totalBytes,
      totalBytes: this.totalBytes,
      percentage: 100,
      speed: 0
    }
  }

  /**
   * Get current bytes transferred
   */
  getBytesTransferred(): number {
    return this.bytesTransferred
  }

  /**
   * Get total bytes
   */
  getTotalBytes(): number {
    return this.totalBytes
  }

  /**
   * Check if transfer is complete
   */
  isComplete(): boolean {
    return this.bytesTransferred >= this.totalBytes
  }

  /**
   * Check if more bytes were read than expected (corruption indicator)
   */
  hasOverflow(): boolean {
    return this.bytesTransferred > this.totalBytes
  }

  /**
   * Get average speed since start
   */
  getAverageSpeed(): number {
    const elapsedMs = Date.now() - this.startTime
    return elapsedMs > 0 ? (this.bytesTransferred / elapsedMs) * 1000 : 0
  }

  /**
   * Get estimated time remaining in seconds
   */
  getEta(): number {
    const avgSpeed = this.getAverageSpeed()
    if (avgSpeed <= 0) return 0

    const remainingBytes = this.totalBytes - this.bytesTransferred
    return remainingBytes / avgSpeed
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000
  }

  /**
   * Reset tracker for a new transfer
   */
  reset(totalBytes?: number): void {
    if (totalBytes !== undefined) {
      this.totalBytes = totalBytes
      this.throttleConfig = this.calculateThrottleConfig(totalBytes)
    }
    this.bytesTransferred = 0
    this.startTime = Date.now()
    this.lastProgressTime = this.startTime
    this.lastBytesTransferred = 0
  }
}

/**
 * Create a progress tracker for a file transfer
 */
export function createProgressTracker(totalBytes: number): ProgressTracker {
  return new ProgressTracker(totalBytes)
}

