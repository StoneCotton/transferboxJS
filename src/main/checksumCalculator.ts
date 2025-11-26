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
  const actualChecksum = await calculateChecksum(filePath, options)
  return actualChecksum === expectedChecksum
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
