/**
 * Path Processor Module
 * Handles file naming and directory structure based on configuration
 */

import { stat } from 'fs/promises'
import * as path from 'path'
import { getLogger } from './logger'
import type { AppConfig } from '../shared/types'
import { FilenameUtils } from './utils/filenameUtils'

/**
 * Interface for file information needed for processing
 */
export interface FileInfo {
  sourcePath: string
  fileName: string
  extension: string
  baseName: string
  directory: string
  stats: {
    birthtime: Date
    mtime: Date
    ctime: Date
  }
}

/**
 * Interface for processed path information
 */
export interface ProcessedPath {
  destinationPath: string
  fileName: string
  directory: string
}

/**
 * Path Processor Class
 * Handles file naming and directory structure based on configuration
 */
export class PathProcessor {
  private config: AppConfig
  private filenameUtils: FilenameUtils

  constructor(config: AppConfig) {
    this.config = config
    this.filenameUtils = new FilenameUtils()
  }

  /**
   * Process a source file path to generate the destination path based on configuration
   */
  async processFilePath(
    sourcePath: string,
    destinationRoot: string,
    deviceName?: string
  ): Promise<ProcessedPath> {
    getLogger().debug('[PathProcessor] Processing', { sourcePath, destinationRoot })

    // Get file information
    const fileInfo = await this.getFileInfo(sourcePath)

    // Check if file should be transferred based on media filter
    if (this.config.transferOnlyMediaFiles && !this.isMediaFile(fileInfo)) {
      throw new Error(
        `File ${fileInfo.fileName} is not a media file and transferOnlyMediaFiles is enabled`
      )
    }

    // Generate filename based on configuration
    const processedFileName = this.generateFileName(fileInfo)
    getLogger().debug('[PathProcessor] Generated filename', { processedFileName })

    // Generate directory structure based on configuration
    const directoryStructure = this.generateDirectoryStructure(
      fileInfo,
      destinationRoot,
      deviceName
    )
    getLogger().debug('[PathProcessor] Generated directory', { directoryStructure })

    // Combine directory and filename
    const destinationPath = path.join(directoryStructure, processedFileName)
    getLogger().debug('[PathProcessor] Final destination', { destinationPath })

    return {
      destinationPath,
      fileName: processedFileName,
      directory: directoryStructure
    }
  }

  /**
   * Get file information including stats
   */
  private async getFileInfo(sourcePath: string): Promise<FileInfo> {
    const stats = await stat(sourcePath)
    const fileName = path.basename(sourcePath)
    const extension = path.extname(sourcePath)
    const baseName = path.basename(sourcePath, extension)
    const directory = path.dirname(sourcePath)

    return {
      sourcePath,
      fileName,
      extension,
      baseName,
      directory,
      stats: {
        birthtime: stats.birthtime,
        mtime: stats.mtime,
        ctime: stats.ctime
      }
    }
  }

  /**
   * Check if file is a media file based on extensions
   */
  private isMediaFile(fileInfo: FileInfo): boolean {
    const normalizedExtension = fileInfo.extension.toLowerCase()
    return this.config.mediaExtensions.includes(normalizedExtension)
  }

  /**
   * Generate filename based on configuration
   */
  private generateFileName(fileInfo: FileInfo): string {
    let fileName = fileInfo.fileName

    // Apply timestamp if enabled
    if (this.config.addTimestampToFilename) {
      const timestamp = this.formatTimestamp(fileInfo.stats.birthtime)

      if (this.config.keepOriginalFilename) {
        // Use template to combine original name with timestamp
        fileName =
          this.config.filenameTemplate
            .replace('{original}', fileInfo.baseName)
            .replace('{timestamp}', timestamp) + fileInfo.extension
      } else {
        // Use just timestamp with extension. Remove any leading/trailing separators left by template.
        let builtName = this.config.filenameTemplate
          .replace('{original}', '')
          .replace('{timestamp}', timestamp)

        // Trim leftover separators/whitespace at start/end (e.g., leading underscore)
        builtName = builtName.replace(/(^[\-_.\s]+)|([\-_.\s]+$)/g, '')

        fileName = builtName + fileInfo.extension
      }
    }

    // Sanitize filename for cross-platform compatibility
    const originalFilename = fileName
    fileName = this.filenameUtils.sanitize(fileName)

    if (originalFilename !== fileName) {
      getLogger().warn('Filename sanitized for cross-platform compatibility', {
        original: originalFilename,
        sanitized: fileName
      })
    }

    return fileName
  }

  /**
   * Format timestamp according to configuration
   */
  private formatTimestamp(date: Date): string {
    const format = this.config.timestampFormat

    // Replace format tokens with actual values
    return format
      .replace(/%Y/g, date.getFullYear().toString())
      .replace(/%m/g, (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace(/%d/g, date.getDate().toString().padStart(2, '0'))
      .replace(/%H/g, date.getHours().toString().padStart(2, '0'))
      .replace(/%M/g, date.getMinutes().toString().padStart(2, '0'))
      .replace(/%S/g, date.getSeconds().toString().padStart(2, '0'))
  }

  /**
   * Generate directory structure based on configuration
   */
  private generateDirectoryStructure(
    fileInfo: FileInfo,
    destinationRoot: string,
    deviceName?: string
  ): string {
    let directory = destinationRoot

    // Handle folder structure preservation
    if (this.config.keepFolderStructure) {
      // Extract relative path from source and preserve it
      // Prefer detecting a mounted volume root on macOS, otherwise fall back to filesystem root
      const pathParts = fileInfo.sourcePath.split(path.sep)
      let driveRoot = ''

      // Find the drive root (e.g., /Volumes/CanonA_0015)
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === 'Volumes' && i + 1 < pathParts.length) {
          driveRoot = pathParts.slice(0, i + 2).join(path.sep)
          break
        }
      }

      // Fallback: preserve path relative to filesystem root when a volume root isn't detected
      const anchorRoot = driveRoot || path.parse(fileInfo.sourcePath).root

      const relativePath = path.relative(anchorRoot, fileInfo.directory)

      // Security: Validate that relative path doesn't contain path traversal attempts
      if (relativePath && relativePath !== '.' && !relativePath.includes('..')) {
        directory = path.join(directory, relativePath)
      } else if (relativePath.includes('..')) {
        getLogger().warn('Path traversal attempt detected in folder structure', {
          sourcePath: fileInfo.sourcePath,
          relativePath,
          driveRoot: anchorRoot
        })
        // Don't add the relative path if it contains path traversal
      }
    }

    // Add date-based folders if enabled
    if (this.config.createDateBasedFolders) {
      const dateFolder = this.formatDateFolder(fileInfo.stats.birthtime)
      directory = path.join(directory, dateFolder)
    }

    // Add device-based folders if enabled
    if (this.config.createDeviceBasedFolders && deviceName) {
      // Sanitize device name to prevent path traversal
      const sanitizedDeviceName = this.filenameUtils.sanitize(deviceName)
      const deviceFolder = this.config.deviceFolderTemplate.replace(
        '{device_name}',
        sanitizedDeviceName
      )
      directory = path.join(directory, deviceFolder)
    }

    // Final security check: Ensure the resolved directory is within destinationRoot
    const resolvedDirectory = path.resolve(directory)
    const resolvedDestinationRoot = path.resolve(destinationRoot)

    if (!resolvedDirectory.startsWith(resolvedDestinationRoot)) {
      getLogger().error('Directory traversal detected - path escapes destination root', {
        directory: resolvedDirectory,
        destinationRoot: resolvedDestinationRoot,
        sourcePath: fileInfo.sourcePath
      })
      // Fallback to just the destination root if traversal is detected
      return destinationRoot
    }

    return directory
  }

  /**
   * Format date folder according to configuration
   */
  private formatDateFolder(date: Date): string {
    const format = this.config.dateFolderFormat

    // Replace format tokens with actual values
    return format
      .replace(/%Y/g, date.getFullYear().toString())
      .replace(/%m/g, (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace(/%d/g, date.getDate().toString().padStart(2, '0'))
      .replace(/\//g, path.sep) // Replace forward slashes with platform-specific separator
  }

  /**
   * Check if file should be filtered based on media extensions
   */
  shouldTransferFile(sourcePath: string): boolean {
    if (!this.config.transferOnlyMediaFiles) {
      return true
    }

    const extension = path.extname(sourcePath).toLowerCase()
    return this.config.mediaExtensions.includes(extension)
  }

  /**
   * Update configuration
   */
  updateConfig(config: AppConfig): void {
    this.config = config
  }
}

/**
 * Create a new PathProcessor instance
 */
export function createPathProcessor(config: AppConfig): PathProcessor {
  return new PathProcessor(config)
}
