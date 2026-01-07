/**
 * Checksum Calculator Service
 * Provides XXHash64-based checksum calculation for file integrity verification
 */

import { createReadStream } from 'fs'
import { XXHash64 } from 'xxhash-addon'
import { DEFAULT_BUFFER_SIZE } from '../constants/fileConstants'

/**
 * Interface for a streaming checksum hasher
 */
export interface StreamingHasher {
  update(data: Buffer): void
  digest(): string
}

/**
 * Interface for checksum calculation results
 */
export interface ChecksumResult {
  sourceChecksum: string
  destChecksum: string
}

/**
 * Checksum Calculator Service
 * Encapsulates XXHash64 checksum operations for file transfers
 */
export class ChecksumCalculator {
  private readonly seed: Buffer

  constructor() {
    // XXHash64 requires an 8-byte seed buffer
    this.seed = Buffer.alloc(8)
  }

  /**
   * Create a new streaming hasher for incremental checksum calculation
   * @returns A hasher object that can be updated with chunks and finalized
   */
  createHasher(): StreamingHasher {
    const hasher = new XXHash64(this.seed)
    return {
      update: (data: Buffer) => hasher.update(data),
      digest: () => hasher.digest().toString('hex')
    }
  }

  /**
   * Create a pair of hashers for source and destination verification
   * @returns Object containing source and destination hashers
   */
  createHasherPair(): { sourceHasher: StreamingHasher; destHasher: StreamingHasher } {
    return {
      sourceHasher: this.createHasher(),
      destHasher: this.createHasher()
    }
  }

  /**
   * Calculate checksum of a file by reading it from disk
   * @param filePath - Path to the file
   * @param bufferSize - Buffer size for reading (default: 4MB)
   * @returns Hex string checksum
   */
  async calculateFileChecksum(
    filePath: string,
    bufferSize: number = DEFAULT_BUFFER_SIZE
  ): Promise<string> {
    const hasher = this.createHasher()

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(filePath, { highWaterMark: bufferSize })

      readStream.on('data', (chunk: Buffer | string) => {
        // Ensure we have a Buffer (createReadStream always returns Buffer unless encoding is set)
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        hasher.update(buffer)
      })

      readStream.on('end', () => {
        resolve(hasher.digest())
      })

      readStream.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Compare two checksums for equality
   * @param checksum1 - First checksum to compare
   * @param checksum2 - Second checksum to compare
   * @returns True if checksums match
   */
  compareChecksums(checksum1: string, checksum2: string): boolean {
    return checksum1 === checksum2
  }

  /**
   * Verify file integrity by comparing checksums
   * @param result - Checksum calculation result with source and dest checksums
   * @returns True if source and destination checksums match
   */
  verifyIntegrity(result: ChecksumResult): boolean {
    return this.compareChecksums(result.sourceChecksum, result.destChecksum)
  }
}

// Singleton instance for shared usage
let checksumCalculatorInstance: ChecksumCalculator | null = null

/**
 * Get the singleton ChecksumCalculator instance
 */
export function getChecksumCalculator(): ChecksumCalculator {
  if (!checksumCalculatorInstance) {
    checksumCalculatorInstance = new ChecksumCalculator()
  }
  return checksumCalculatorInstance
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetChecksumCalculator(): void {
  checksumCalculatorInstance = null
}
