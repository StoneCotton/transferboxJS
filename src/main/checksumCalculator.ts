/**
 * Checksum Calculator Module
 * Provides fast file checksums using xxHash64 algorithm
 */

import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { XXHash64 } from 'xxhash-addon'

export interface ChecksumOptions {
  bufferSize?: number // Buffer size for reading files (default: 4MB)
  onProgress?: (bytesProcessed: number, totalBytes: number) => void
}

const DEFAULT_BUFFER_SIZE = 4 * 1024 * 1024 // 4MB - optimized for modern SSDs

/**
 * Calculate xxHash64 checksum for a file
 * @param filePath - Path to the file
 * @param options - Optional configuration
 * @returns Hex string of the checksum
 */
export async function calculateChecksum(
  filePath: string,
  options?: ChecksumOptions
): Promise<string> {
  const bufferSize = options?.bufferSize || DEFAULT_BUFFER_SIZE

  // Get file size for progress reporting
  const stats = await stat(filePath)
  const totalBytes = stats.size

  return new Promise((resolve, reject) => {
    // xxhash-addon requires Buffer for seed (8 bytes for xxHash64)
    const seed = Buffer.alloc(8)
    const hasher = new XXHash64(seed)
    let bytesProcessed = 0

    const stream = createReadStream(filePath, {
      highWaterMark: bufferSize
    })

    stream.on('data', (chunk: string | Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      hasher.update(buf)
      bytesProcessed += buf.length

      if (options?.onProgress) {
        options.onProgress(bytesProcessed, totalBytes)
      }
    })

    stream.on('end', () => {
      const checksumBuffer = hasher.digest()
      const checksum = checksumBuffer.toString('hex')
      resolve(checksum)
    })

    stream.on('error', (error) => {
      reject(new Error(`Failed to calculate checksum: ${error.message}`))
    })
  })
}

/**
 * Calculate xxHash64 checksum from a buffer
 * @param buffer - Buffer to calculate checksum for
 * @returns Hex string of the checksum
 */
export function calculateChecksumFromBuffer(buffer: Buffer): string {
  const seed = Buffer.alloc(8)
  const hasher = new XXHash64(seed)
  hasher.update(buffer)
  const checksumBuffer = hasher.digest()
  return checksumBuffer.toString('hex')
}

/**
 * Verify a file's checksum matches expected value
 * @param filePath - Path to the file
 * @param expectedChecksum - Expected checksum value
 * @param options - Optional configuration
 * @returns True if checksums match
 */
export async function verifyChecksum(
  filePath: string,
  expectedChecksum: string,
  options?: ChecksumOptions
): Promise<boolean> {
  try {
    const actualChecksum = await calculateChecksum(filePath, options)
    return actualChecksum === expectedChecksum
  } catch (error) {
    throw error
  }
}

/**
 * Calculate checksum using streaming (alias for calculateChecksum for clarity)
 * @param filePath - Path to the file
 * @param options - Optional configuration
 * @returns Hex string of the checksum
 */
export async function calculateChecksumStream(
  filePath: string,
  options?: ChecksumOptions
): Promise<string> {
  return calculateChecksum(filePath, options)
}

/**
 * Calculate checksums for multiple files concurrently
 * @param filePaths - Array of file paths
 * @param options - Optional configuration
 * @returns Map of file paths to checksums
 */
export async function calculateChecksumsBatch(
  filePaths: string[],
  options?: ChecksumOptions
): Promise<Map<string, string>> {
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const checksum = await calculateChecksum(filePath, options)
        return { filePath, checksum, error: null }
      } catch (error) {
        return {
          filePath,
          checksum: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  )

  const checksumMap = new Map<string, string>()
  results.forEach((result) => {
    if (result.checksum) {
      checksumMap.set(result.filePath, result.checksum)
    }
  })

  return checksumMap
}

/**
 * Compare two files by their checksums
 * @param filePath1 - First file path
 * @param filePath2 - Second file path
 * @returns True if files have identical checksums
 */
export async function compareFiles(filePath1: string, filePath2: string): Promise<boolean> {
  const [checksum1, checksum2] = await Promise.all([
    calculateChecksum(filePath1),
    calculateChecksum(filePath2)
  ])

  return checksum1 === checksum2
}

/**
 * Calculate checksum and return detailed information
 * @param filePath - Path to the file
 * @param options - Optional configuration
 * @returns Object with checksum, file size, and calculation time
 */
export async function calculateChecksumWithStats(
  filePath: string,
  options?: ChecksumOptions
): Promise<{
  checksum: string
  fileSize: number
  calculationTime: number
  throughput: number
}> {
  const stats = await stat(filePath)
  const startTime = Date.now()

  const checksum = await calculateChecksum(filePath, options)

  const calculationTime = Date.now() - startTime
  const throughput = calculationTime > 0 ? stats.size / (calculationTime / 1000) : 0 // Bytes per second

  return {
    checksum,
    fileSize: stats.size,
    calculationTime,
    throughput
  }
}
