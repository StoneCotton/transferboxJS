/**
 * Utilities for safely handling large file sizes
 * JavaScript Number can safely represent integers up to Number.MAX_SAFE_INTEGER (2^53-1 ≈ 9 PB)
 * These utilities help prevent overflow and provide warnings for edge cases
 */

import { getLogger } from '../logger'

/**
 * Maximum safe file size in bytes (Number.MAX_SAFE_INTEGER)
 * Approximately 9 petabytes (9,007,199,254,740,991 bytes)
 */
export const MAX_SAFE_FILE_SIZE = Number.MAX_SAFE_INTEGER

/**
 * Safely add two file sizes, checking for overflow
 * @throws {Error} if the result would exceed MAX_SAFE_FILE_SIZE
 */
export function safeAdd(a: number, b: number): number {
  // Check if either input is already too large
  if (!Number.isSafeInteger(a)) {
    throw new Error(`File size ${a} exceeds maximum safe integer`)
  }
  if (!Number.isSafeInteger(b)) {
    throw new Error(`File size ${b} exceeds maximum safe integer`)
  }

  const result = a + b

  // Check if result overflowed
  if (!Number.isSafeInteger(result)) {
    getLogger().error('File size addition would overflow', {
      a,
      b,
      result,
      maxSafeInteger: Number.MAX_SAFE_INTEGER
    })
    throw new Error(
      `File size addition overflow: ${a} + ${b} exceeds maximum safe integer (${Number.MAX_SAFE_INTEGER})`
    )
  }

  // Warn if we're getting close to the limit (> 90%)
  if (result > MAX_SAFE_FILE_SIZE * 0.9) {
    getLogger().warn('File size sum approaching maximum safe integer', {
      result,
      maxSafeInteger: Number.MAX_SAFE_INTEGER,
      percentageOfMax: (result / MAX_SAFE_FILE_SIZE) * 100
    })
  }

  return result
}

/**
 * Safely sum an array of file sizes
 * @throws {Error} if the sum would exceed MAX_SAFE_FILE_SIZE
 */
export function safeSum(sizes: number[]): number {
  return sizes.reduce((sum, size) => safeAdd(sum, size), 0)
}

/**
 * Validate that a file size from the database is within safe limits
 * @throws {Error} if the size is not a safe integer
 */
export function validateFileSize(size: unknown, context: string = 'file size'): number {
  if (typeof size !== 'number') {
    throw new Error(`Invalid ${context}: expected number, got ${typeof size}`)
  }

  if (size < 0) {
    throw new Error(`Invalid ${context}: negative value ${size}`)
  }

  if (!Number.isSafeInteger(size)) {
    getLogger().error('File size exceeds maximum safe integer', {
      size,
      context,
      maxSafeInteger: Number.MAX_SAFE_INTEGER
    })
    throw new Error(`${context} ${size} exceeds maximum safe integer (${Number.MAX_SAFE_INTEGER})`)
  }

  return size
}

/**
 * Format a file size for display, handling very large sizes gracefully
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isSafeInteger(bytes)) {
    return `~${(bytes / Math.pow(1024, 5)).toFixed(2)} PB (precision limited)`
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}
