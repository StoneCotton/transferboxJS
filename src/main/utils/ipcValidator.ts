/**
 * IPC Input Validation Utilities
 * Validates and sanitizes inputs from IPC messages to prevent security issues
 */

import * as path from 'path'
import { getLogger } from '../logger'
import {
  MAX_DEVICE_ID_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_FILES_PER_TRANSFER
} from '../constants/fileConstants'
import {
  validateNoControlCharacters,
  validateNoPathTraversal,
  validateNoCommandInjection,
  validateNoWildcards,
  isSafeDeviceId,
  getMaxPathLength
} from './securityValidation'

/**
 * Validates that a string is a valid file path
 * Prevents path traversal attacks
 */
export function validateFilePath(filePath: string, allowRelative: boolean = false): string {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('File path must be a non-empty string')
  }

  const trimmed = filePath.trim()

  // Check for path traversal attempts BEFORE normalization
  // This catches attempts like ../../../etc/passwd
  if (trimmed.includes('..')) {
    getLogger().warn('Path traversal attempt detected', { originalPath: filePath })
    throw new Error('Invalid path: path traversal not allowed')
  }

  // Normalize the path
  const normalized = path.normalize(trimmed)

  // Double-check after normalization
  if (normalized.includes('..')) {
    getLogger().warn('Path traversal attempt detected after normalization', {
      originalPath: filePath,
      normalized
    })
    throw new Error('Invalid path: path traversal not allowed')
  }

  // Check for absolute paths if relative paths are not allowed
  if (!allowRelative && !path.isAbsolute(normalized)) {
    throw new Error('File path must be absolute')
  }

  // Check path length using platform-aware limits
  const maxLength = getMaxPathLength()
  if (normalized.length > maxLength) {
    throw new Error('File path exceeds maximum length')
  }

  return normalized
}

/**
 * Validates an array of file paths
 */
export function validateFilePaths(filePaths: unknown[]): string[] {
  if (!Array.isArray(filePaths)) {
    throw new Error('Files must be an array')
  }

  if (filePaths.length === 0) {
    throw new Error('Files array cannot be empty')
  }

  // Limit array size to prevent DoS
  if (filePaths.length > MAX_FILES_PER_TRANSFER) {
    throw new Error('Too many files in transfer request')
  }

  return filePaths.map((fp, index) => {
    if (typeof fp !== 'string') {
      getLogger().error('[IPC Validator] Invalid file path type', {
        index,
        type: typeof fp,
        value: fp
      })
      throw new Error(`File path at index ${index} must be a string (got ${typeof fp})`)
    }
    if (fp.trim() === '') {
      getLogger().error('[IPC Validator] Empty file path', {
        index,
        originalValue: fp,
        length: fp.length
      })
      throw new Error(`File path at index ${index} is empty or contains only whitespace`)
    }
    return validateFilePath(fp, false)
  })
}

/**
 * Validates a device identifier with platform-specific rules
 *
 * Platform-specific formats:
 * - Unix (darwin/linux): /dev/disk*, /dev/sd*, /dev/mmcblk*
 * - Windows drive letters: [A-Z]:, [A-Z]:\
 * - Windows device paths: \\.\PHYSICALDRIVE0, \\?\Volume{guid}, \\.\HarddiskVolume1
 *
 * Security checks (using shared securityValidation utilities):
 * - Control characters (\x00-\x1f)
 * - Path traversal (..)
 * - Shell metacharacters (;|`$()&<>{})
 * - Wildcards (*?)
 */
export function validateDeviceId(device: unknown): string {
  if (typeof device !== 'string' || device.trim() === '') {
    throw new Error('Device ID must be a non-empty string')
  }

  const trimmed = device.trim()

  // Limit length
  if (trimmed.length > MAX_DEVICE_ID_LENGTH) {
    throw new Error('Device ID exceeds maximum length')
  }

  // Check for control characters (always invalid, even in device paths)
  try {
    validateNoControlCharacters(trimmed, 'Device ID')
  } catch {
    throw new Error('Device ID contains invalid characters')
  }

  // Check if it's a recognized safe device format
  if (isSafeDeviceId(trimmed)) {
    return trimmed
  }

  // If not a recognized device format, apply strict security checks
  try {
    validateNoPathTraversal(trimmed, 'Device ID')
    validateNoCommandInjection(trimmed, 'Device ID')
    validateNoWildcards(trimmed, 'Device ID')
  } catch {
    throw new Error('Device ID contains invalid characters')
  }

  // Check for remaining invalid characters
  // Reject: quotes, angle brackets, pipe, backslashes, forward slashes, colons
  if (/[<>:"/\\|]/.test(trimmed)) {
    throw new Error('Device ID contains invalid characters')
  }

  return trimmed
}

/**
 * Validates TransferStartRequest from IPC
 */
export function validateTransferStartRequest(request: unknown): {
  sourceRoot: string
  destinationRoot: string
  driveInfo: { device: string; displayName: string }
  files: string[]
} {
  if (!request || typeof request !== 'object') {
    throw new Error('Transfer request must be an object')
  }

  const req = request as Record<string, unknown>

  // Validate sourceRoot
  if (typeof req.sourceRoot !== 'string') {
    throw new Error('sourceRoot must be a string')
  }
  const sourceRoot = validateFilePath(req.sourceRoot, false)

  // Validate destinationRoot
  if (typeof req.destinationRoot !== 'string') {
    throw new Error('destinationRoot must be a string')
  }
  const destinationRoot = validateFilePath(req.destinationRoot, false)

  // Validate driveInfo
  if (!req.driveInfo || typeof req.driveInfo !== 'object') {
    throw new Error('driveInfo must be an object')
  }
  const driveInfo = req.driveInfo as Record<string, unknown>
  if (typeof driveInfo.device !== 'string') {
    throw new Error('driveInfo.device must be a string')
  }
  if (typeof driveInfo.displayName !== 'string') {
    throw new Error('driveInfo.displayName must be a string')
  }
  const validatedDevice = validateDeviceId(driveInfo.device)
  const displayName =
    typeof driveInfo.displayName === 'string' &&
    driveInfo.displayName.length <= MAX_DISPLAY_NAME_LENGTH
      ? driveInfo.displayName.trim()
      : 'Unknown Drive'

  // Validate files array
  if (!Array.isArray(req.files)) {
    throw new Error('files must be an array')
  }
  const files = validateFilePaths(req.files)

  return {
    sourceRoot,
    destinationRoot,
    driveInfo: {
      device: validatedDevice,
      displayName
    },
    files
  }
}

/**
 * Validates PathValidationRequest
 */
export function validatePathValidationRequest(request: unknown): string {
  if (!request || typeof request !== 'object') {
    throw new Error('Path validation request must be an object')
  }

  const req = request as Record<string, unknown>

  if (typeof req.path !== 'string') {
    throw new Error('path must be a string')
  }

  return validateFilePath(req.path, true) // Allow relative paths for validation
}

/**
 * Validates a log level
 */
export function validateLogLevel(level: unknown): 'debug' | 'info' | 'warn' | 'error' {
  if (typeof level !== 'string') {
    throw new Error('Log level must be a string')
  }

  const validLevels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error']
  if (!validLevels.includes(level as 'debug' | 'info' | 'warn' | 'error')) {
    throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`)
  }

  return level as 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Validates a session ID
 */
export function validateSessionId(id: unknown): string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('Session ID must be a non-empty string')
  }

  // Check format (should be like "session_1234567890_abc123")
  if (!/^session_\d+_[a-z0-9]+$/i.test(id)) {
    throw new Error('Invalid session ID format')
  }

  // Limit length
  if (id.length > 128) {
    throw new Error('Session ID exceeds maximum length')
  }

  return id.trim()
}

/**
 * Validates a numeric limit parameter
 */
export function validateLimit(limit: unknown, max: number = 10000): number {
  if (limit === undefined || limit === null) {
    return max
  }

  if (typeof limit !== 'number') {
    throw new Error('Limit must be a number')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new Error(`Limit must be an integer between 1 and ${max}`)
  }

  return limit
}
