/**
 * Filename Utilities Module
 * Handles filename sanitization and conflict resolution
 */

import * as path from 'path'
import { access } from 'fs/promises'

export interface SanitizeOptions {
  platform?: NodeJS.Platform
  maxLength?: number
  replacement?: string
}

export interface ConflictResolution {
  strategy: 'overwrite' | 'skip' | 'rename' | 'rename-timestamp' | 'error'
  maxRenameAttempts?: number
}

export class FilenameUtils {
  /**
   * Sanitize filename for cross-platform compatibility
   */
  sanitize(filename: string, options: SanitizeOptions = {}): string {
    const { platform = process.platform, maxLength = 255, replacement = '_' } = options

    let sanitized = filename

    // Always remove Windows-forbidden characters for cross-platform portability
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, replacement)

    // Replace NULL with replacement, then remove other control characters universally
    sanitized = sanitized.replace(/\x00/g, replacement)
    sanitized = sanitized.replace(/[\x01-\x1f\x7f]/g, '')

    // Ensure path separators are safe on POSIX (already handled in Windows set above)
    if (platform !== 'win32') {
      sanitized = sanitized.replace(/\//g, replacement)
    }

    if (platform === 'win32') {
      // Windows reserved names
      const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
      if (reserved.test(sanitized)) {
        sanitized = `${replacement}${sanitized}`
      }

      // No trailing dots or spaces on Windows
      sanitized = sanitized.replace(/[. ]+$/, '')
    }

    // Limit length
    sanitized = this.truncateFilename(sanitized, maxLength)

    // Ensure not empty
    if (!sanitized || sanitized.trim() === '') {
      sanitized = 'unnamed_file'
    }

    return sanitized
  }

  /**
   * Truncate filename to max bytes while preserving extension
   */
  private truncateFilename(filename: string, maxBytes: number): string {
    if (Buffer.byteLength(filename, 'utf8') <= maxBytes) {
      return filename
    }

    const ext = path.extname(filename)
    let name = path.basename(filename, ext)

    while (Buffer.byteLength(name + ext, 'utf8') > maxBytes && name.length > 0) {
      name = name.slice(0, -1)
    }

    return name + ext
  }

  /**
   * Resolve filename conflicts
   */
  async resolveConflict(
    filePath: string,
    resolution: ConflictResolution
  ): Promise<{ path: string; action: 'write' | 'skip' }> {
    const exists = await this.fileExists(filePath)

    if (!exists) {
      return { path: filePath, action: 'write' }
    }

    switch (resolution.strategy) {
      case 'overwrite':
        return { path: filePath, action: 'write' }

      case 'skip':
        return { path: filePath, action: 'skip' }

      case 'rename':
        return {
          path: await this.generateUniqueName(filePath, resolution.maxRenameAttempts ?? 100),
          action: 'write'
        }

      case 'rename-timestamp':
        return {
          path: this.addTimestamp(filePath),
          action: 'write'
        }

      case 'error':
        throw new Error(`File already exists: ${filePath}`)
    }
  }

  /**
   * Generate unique filename by adding counter
   */
  private async generateUniqueName(filePath: string, maxAttempts: number): Promise<string> {
    const parsed = path.parse(filePath)
    let counter = 1

    while (counter <= maxAttempts) {
      const newPath = path.join(parsed.dir, `${parsed.name}_${counter}${parsed.ext}`)

      if (!(await this.fileExists(newPath))) {
        return newPath
      }

      counter++
    }

    throw new Error(`Could not generate unique filename after ${maxAttempts} attempts`)
  }

  /**
   * Add timestamp to filename
   */
  private addTimestamp(filePath: string): string {
    const parsed = path.parse(filePath)
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')

    return path.join(parsed.dir, `${parsed.name}_${timestamp}${parsed.ext}`)
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  }
}
