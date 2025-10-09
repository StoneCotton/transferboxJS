/**
 * File Validator Module
 * Validates files before transfer
 */

import { access, open, lstat, constants } from 'fs/promises'
import type { Stats } from 'fs'
import { TransferError } from '../errors/TransferError'

export interface FileValidationResult {
  valid: boolean
  error?: TransferError
  stats?: Stats
}

export interface ValidationOptions {
  checkReadability?: boolean
  checkSize?: boolean
  allowSymlinks?: boolean
  allowSpecialFiles?: boolean
  minSize?: number
  maxSize?: number
}

export class FileValidator {
  async validate(filePath: string, options: ValidationOptions = {}): Promise<FileValidationResult> {
    const {
      checkReadability = true,
      checkSize = true,
      allowSymlinks = false,
      allowSpecialFiles = false,
      minSize = 1,
      maxSize = Number.MAX_SAFE_INTEGER
    } = options

    try {
      // Use lstat to not follow symlinks
      const stats = await lstat(filePath)

      // Check symlinks
      if (stats.isSymbolicLink() && !allowSymlinks) {
        return {
          valid: false,
          error: TransferError.fromValidation('Symlinks are not supported')
        }
      }

      // Check special files
      if (!stats.isFile() && !allowSpecialFiles) {
        const type = this.getFileType(stats)
        return {
          valid: false,
          error: TransferError.fromValidation(`Not a regular file (type: ${type})`)
        }
      }

      // Check size
      if (checkSize && stats.isFile()) {
        if (stats.size < minSize) {
          return {
            valid: false,
            error: TransferError.fromValidation(`File too small (${stats.size} bytes)`)
          }
        }
        if (stats.size > maxSize) {
          return {
            valid: false,
            error: TransferError.fromValidation(`File too large (${stats.size} bytes)`)
          }
        }
      }

      // Check readability
      if (checkReadability) {
        await access(filePath, constants.R_OK)

        // Try reading first few bytes
        if (stats.isFile()) {
          const fd = await open(filePath, 'r')
          try {
            const buffer = Buffer.alloc(Math.min(4096, stats.size))
            await fd.read(buffer, 0, buffer.length, 0)
          } finally {
            await fd.close()
          }
        }
      }

      return { valid: true, stats }
    } catch (error) {
      return {
        valid: false,
        error: TransferError.fromNodeError(error as NodeJS.ErrnoException)
      }
    }
  }

  private getFileType(stats: Stats): string {
    if (stats.isDirectory()) return 'directory'
    if (stats.isBlockDevice()) return 'block device'
    if (stats.isCharacterDevice()) return 'character device'
    if (stats.isFIFO()) return 'pipe'
    if (stats.isSocket()) return 'socket'
    return 'unknown'
  }
}
