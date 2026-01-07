/**
 * Security Validation Utilities
 * Centralized validation functions to prevent security vulnerabilities
 *
 * These utilities should be used throughout the codebase to prevent:
 * - Command injection attacks
 * - Path traversal attacks
 * - Shell metacharacter exploits
 */

import { getLogger } from '../logger'
import { PATH_LENGTH_LIMITS, NAME_LENGTH_LIMITS } from '../constants/fileConstants'

/**
 * Characters that can be used for command injection or shell exploits
 * These are dangerous when used in paths or identifiers that may be passed to shell commands
 */
const SHELL_METACHARACTERS = /[;|`$()&<>{}]/
const COMMAND_SUBSTITUTION = /\$\(|`/
const PATH_SEPARATORS_UNSAFE = /[<>"|]/
const WILDCARD_CHARACTERS = /[*?]/

/**
 * Validates that a string doesn't contain shell metacharacters that could be used for command injection
 *
 * @param value - The string to validate
 * @param context - Description of what's being validated (for logging)
 * @throws Error if dangerous characters are found
 */
export function validateNoCommandInjection(value: string, context: string = 'value'): void {
  if (SHELL_METACHARACTERS.test(value)) {
    getLogger().warn('Command injection attempt detected', { context, value })
    throw new Error(`${context} contains potentially dangerous shell metacharacters`)
  }

  if (COMMAND_SUBSTITUTION.test(value)) {
    getLogger().warn('Command substitution attempt detected', { context, value })
    throw new Error(`${context} contains command substitution patterns`)
  }
}

/**
 * Validates that a string doesn't contain wildcard characters
 *
 * @param value - The string to validate
 * @param context - Description of what's being validated (for logging)
 * @throws Error if wildcards are found
 */
export function validateNoWildcards(value: string, context: string = 'value'): void {
  if (WILDCARD_CHARACTERS.test(value)) {
    getLogger().warn('Wildcard characters detected', { context, value })
    throw new Error(`${context} contains wildcard characters`)
  }
}

/**
 * Validates that a string doesn't contain path traversal attempts
 *
 * @param value - The string to validate
 * @param context - Description of what's being validated (for logging)
 * @throws Error if path traversal is detected
 */
export function validateNoPathTraversal(value: string, context: string = 'value'): void {
  if (value.includes('..')) {
    getLogger().warn('Path traversal attempt detected', { context, value })
    throw new Error(`${context} contains path traversal patterns`)
  }
}

/**
 * Validates that a string doesn't contain control characters
 * Control characters (0x00-0x1F) can cause issues and are often used in exploits
 *
 * @param value - The string to validate
 * @param context - Description of what's being validated (for logging)
 * @throws Error if control characters are found
 */
export function validateNoControlCharacters(value: string, context: string = 'value'): void {
  if (/[\x00-\x1f]/.test(value)) {
    getLogger().warn('Control characters detected', { context, value })
    throw new Error(`${context} contains control characters`)
  }
}

/**
 * Comprehensive path safety check
 * Validates that a path is safe to use in shell commands
 *
 * @param pathValue - The path to validate
 * @param context - Description of what's being validated
 * @throws Error if the path contains unsafe characters
 */
export function validateSafePath(pathValue: string, context: string = 'path'): void {
  validateNoControlCharacters(pathValue, context)
  validateNoCommandInjection(pathValue, context)

  // Check for pipe and redirect characters (< > | ")
  if (PATH_SEPARATORS_UNSAFE.test(pathValue)) {
    getLogger().warn('Unsafe path separators detected', { context, value: pathValue })
    throw new Error(`${context} contains unsafe characters`)
  }
}

/**
 * Validates a path to be used in shell command execution
 * More strict than validateSafePath - also rejects wildcards and validates against traversal
 *
 * @param pathValue - The path to validate
 * @param context - Description of what's being validated
 * @throws Error if the path is not safe for shell execution
 */
export function validatePathForShellExecution(pathValue: string, context: string = 'path'): void {
  validateSafePath(pathValue, context)
  validateNoWildcards(pathValue, context)
  validateNoPathTraversal(pathValue, context)
}

/**
 * Sanitizes a string for use in shell commands by escaping dangerous characters
 *
 * WARNING: Prefer validation over sanitization when possible!
 * Sanitization can be bypassed and is not as safe as rejecting invalid input.
 *
 * @param value - The string to sanitize
 * @returns Sanitized string safe for shell use
 */
export function sanitizeForShell(value: string): string {
  // Escape special shell characters
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/!/g, '\\!')
}

/**
 * Checks if a value is a safe device identifier
 * Allows only specific formats:
 * - Unix devices: /dev/xxx
 * - Windows drives: X: or X:\
 * - Windows device paths: \\.\PHYSICALDRIVE0, \\?\Volume{guid}, \\.\HarddiskVolume1
 * - Simple alphanumeric identifiers
 *
 * @param device - The device identifier to check
 * @returns true if the device identifier is safe
 */
export function isSafeDeviceId(device: string): boolean {
  // Unix device path
  if (/^\/dev\/[a-zA-Z0-9_\-/]+$/.test(device)) {
    return true
  }

  // Windows drive letter
  if (/^[A-Z]:(\\)?$/i.test(device)) {
    return true
  }

  // Windows physical drive or volume path
  if (/^\\\\[.?]\\(PHYSICALDRIVE\d+|Volume\{[a-fA-F0-9-]+\}|Harddisk(Volume)?\d+)$/i.test(device)) {
    return true
  }

  // Simple alphanumeric identifier (fallback)
  if (/^[a-zA-Z0-9_-]+$/.test(device)) {
    return true
  }

  return false
}

// Re-export path limits from fileConstants for backward compatibility
export { PATH_LENGTH_LIMITS, NAME_LENGTH_LIMITS } from '../constants/fileConstants'

/**
 * Gets the maximum path length for the current platform
 *
 * @returns Maximum path length in characters
 */
export function getMaxPathLength(): number {
  const platform = process.platform as keyof typeof PATH_LENGTH_LIMITS
  return PATH_LENGTH_LIMITS[platform] || PATH_LENGTH_LIMITS.default
}

/**
 * Gets the maximum filename length for the current platform
 *
 * @returns Maximum filename length in characters
 */
export function getMaxNameLength(): number {
  const platform = process.platform as keyof typeof NAME_LENGTH_LIMITS
  return NAME_LENGTH_LIMITS[platform] || NAME_LENGTH_LIMITS.default
}

/**
 * Validates that a path meets platform-specific length requirements
 *
 * @param pathValue - The path to validate
 * @param context - Description of what's being validated
 * @throws Error if the path is too long
 */
export function validatePathLength(pathValue: string, context: string = 'path'): void {
  const maxLength = getMaxPathLength()

  if (pathValue.length > maxLength) {
    getLogger().warn('Path exceeds maximum length', {
      context,
      length: pathValue.length,
      maxLength
    })
    throw new Error(`${context} exceeds maximum length of ${maxLength} characters`)
  }
}

/**
 * Validates that a filename meets platform-specific length requirements
 *
 * @param filename - The filename to validate
 * @param context - Description of what's being validated
 * @throws Error if the filename is too long
 */
export function validateNameLength(filename: string, context: string = 'filename'): void {
  const maxLength = getMaxNameLength()

  if (filename.length > maxLength) {
    getLogger().warn('Filename exceeds maximum length', {
      context,
      length: filename.length,
      maxLength
    })
    throw new Error(`${context} exceeds maximum length of ${maxLength} characters`)
  }
}
