/**
 * Transfer Validator Module
 * Performs pre-transfer safety checks including conflict detection,
 * same/nested directory validation, and space validation
 */

import * as path from 'path'
import { stat, access } from 'fs/promises'
import { hasEnoughSpace, checkDiskSpace } from './pathValidator'
import { getLogger } from './logger'
import type {
  FileConflict,
  ValidationWarningType,
  ValidationWarning
} from '../shared/types/ipc'
import type { ConflictResolution } from '../shared/types/config'

// Re-export types for backward compatibility
export type { ConflictResolution, FileConflict, ValidationWarningType, ValidationWarning }

/**
 * Result of pre-transfer validation
 */
export interface TransferValidationResult {
  isValid: boolean
  canProceed: boolean
  requiresConfirmation: boolean
  warnings: ValidationWarning[]
  conflicts: FileConflict[]
  spaceRequired: number
  spaceAvailable: number
  error?: string
}

/**
 * Options for transfer validation
 */
export interface TransferValidationOptions {
  sourceRoot: string
  destinationRoot: string
  files: Array<{ source: string; dest: string; size?: number }>
  conflictResolution?: ConflictResolution
}

/**
 * Validate a transfer before starting
 * Checks for same directory, nested directories, file conflicts, and disk space
 */
export async function validateTransfer(
  options: TransferValidationOptions
): Promise<TransferValidationResult> {
  const logger = getLogger()
  const { sourceRoot, destinationRoot, files, conflictResolution = 'ask' } = options

  const result: TransferValidationResult = {
    isValid: true,
    canProceed: true,
    requiresConfirmation: false,
    warnings: [],
    conflicts: [],
    spaceRequired: 0,
    spaceAvailable: 0
  }

  logger.debug('[TransferValidator] Starting validation', {
    sourceRoot,
    destinationRoot,
    fileCount: files.length,
    conflictResolution
  })

  // Normalize paths for comparison
  const normalizedSourceRoot = path.resolve(sourceRoot)
  const normalizedDestRoot = path.resolve(destinationRoot)

  // 1. Check for same directory
  if (normalizedSourceRoot === normalizedDestRoot) {
    result.isValid = false
    result.canProceed = false
    result.warnings.push({
      type: 'same_directory',
      message: 'Source and destination cannot be the same directory',
      details: { sourceRoot: normalizedSourceRoot, destinationRoot: normalizedDestRoot }
    })
    result.error = 'Source and destination cannot be the same directory'
    logger.warn('[TransferValidator] Same directory detected', {
      sourceRoot: normalizedSourceRoot,
      destinationRoot: normalizedDestRoot
    })
    return result
  }

  // 2. Check for nested directories
  const nestedCheck = checkNestedDirectories(normalizedSourceRoot, normalizedDestRoot)
  if (nestedCheck.isNested) {
    result.isValid = false
    result.canProceed = false
    result.warnings.push({
      type: nestedCheck.type as ValidationWarningType,
      message: nestedCheck.message,
      details: { sourceRoot: normalizedSourceRoot, destinationRoot: normalizedDestRoot }
    })
    result.error = nestedCheck.message
    logger.warn('[TransferValidator] Nested directory detected', {
      type: nestedCheck.type,
      sourceRoot: normalizedSourceRoot,
      destinationRoot: normalizedDestRoot
    })
    return result
  }

  // 3. Calculate total space required
  let totalSpaceRequired = 0
  for (const file of files) {
    if (file.size !== undefined) {
      totalSpaceRequired += file.size
    } else {
      try {
        const stats = await stat(file.source)
        totalSpaceRequired += stats.size
      } catch {
        // Skip files that can't be stat'd
      }
    }
  }
  result.spaceRequired = totalSpaceRequired

  // 4. Check available disk space (with 10% buffer)
  try {
    const spaceInfo = await checkDiskSpace(destinationRoot)
    result.spaceAvailable = spaceInfo.freeSpace

    const hasSpace = await hasEnoughSpace(destinationRoot, totalSpaceRequired)
    if (!hasSpace) {
      result.warnings.push({
        type: 'insufficient_space',
        message: `Insufficient disk space. Required: ${formatBytes(totalSpaceRequired * 1.1)}, Available: ${formatBytes(spaceInfo.freeSpace)}`,
        details: {
          required: totalSpaceRequired,
          requiredWithBuffer: totalSpaceRequired * 1.1,
          available: spaceInfo.freeSpace
        }
      })
      result.canProceed = false
      result.error = 'Insufficient disk space'
      logger.warn('[TransferValidator] Insufficient disk space', {
        required: totalSpaceRequired,
        available: spaceInfo.freeSpace
      })
    }
  } catch (error) {
    logger.warn('[TransferValidator] Failed to check disk space', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // 5. Detect file conflicts
  const conflicts = await detectFileConflicts(files)
  result.conflicts = conflicts

  if (conflicts.length > 0) {
    result.warnings.push({
      type: 'file_conflicts',
      message: `${conflicts.length} file${conflicts.length === 1 ? '' : 's'} already exist at the destination`,
      details: { conflictCount: conflicts.length }
    })

    // Determine if we need confirmation based on conflict resolution setting
    if (conflictResolution === 'ask') {
      result.requiresConfirmation = true
      logger.info('[TransferValidator] File conflicts require user confirmation', {
        conflictCount: conflicts.length
      })
    } else {
      logger.info('[TransferValidator] File conflicts will be handled automatically', {
        conflictCount: conflicts.length,
        resolution: conflictResolution
      })
    }
  }

  // Set overall validity
  result.isValid =
    result.warnings.filter(
      (w) =>
        w.type === 'same_directory' ||
        w.type === 'nested_source_in_dest' ||
        w.type === 'nested_dest_in_source'
    ).length === 0

  logger.debug('[TransferValidator] Validation complete', {
    isValid: result.isValid,
    canProceed: result.canProceed,
    requiresConfirmation: result.requiresConfirmation,
    warningCount: result.warnings.length,
    conflictCount: result.conflicts.length
  })

  return result
}

/**
 * Check if source and destination directories are nested
 */
function checkNestedDirectories(
  sourceRoot: string,
  destRoot: string
): { isNested: boolean; type?: string; message: string } {
  // Check if destination is inside source (would cause infinite loop when copying)
  if (isPathInside(destRoot, sourceRoot)) {
    return {
      isNested: true,
      type: 'nested_dest_in_source',
      message: 'Destination cannot be inside the source directory (would cause infinite loop)'
    }
  }

  // Check if source is inside destination
  if (isPathInside(sourceRoot, destRoot)) {
    return {
      isNested: true,
      type: 'nested_source_in_dest',
      message: 'Source cannot be inside the destination directory'
    }
  }

  return { isNested: false, message: '' }
}

/**
 * Check if a path is inside another path
 */
function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath)
  return !relative.startsWith('..') && !path.isAbsolute(relative) && relative !== ''
}

/**
 * Detect file conflicts at the destination
 */
async function detectFileConflicts(
  files: Array<{ source: string; dest: string; size?: number }>
): Promise<FileConflict[]> {
  const conflicts: FileConflict[] = []

  for (const file of files) {
    try {
      // Check if destination file exists
      await access(file.dest)

      // File exists - gather conflict information
      const [sourceStats, destStats] = await Promise.all([stat(file.source), stat(file.dest)])

      conflicts.push({
        sourcePath: file.source,
        destinationPath: file.dest,
        fileName: path.basename(file.source),
        sourceSize: sourceStats.size,
        sourceModified: sourceStats.mtimeMs,
        existingSize: destStats.size,
        existingModified: destStats.mtimeMs
      })
    } catch {
      // File doesn't exist at destination - no conflict
    }
  }

  return conflicts
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
