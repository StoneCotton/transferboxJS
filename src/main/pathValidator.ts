/**
 * Path Validator Module
 * Validates destination paths for write permissions, space, and safety
 */

import * as fs from 'fs/promises'
import type { Stats } from 'fs'
import * as path from 'path'
import { PathValidationResponse } from '../shared/types'
import { validatePathForShellExecution } from './utils/securityValidation'

/**
 * System directories that should never be used as transfer destinations
 * Note: We only block root-level system directories and critical subdirectories,
 * not user-created subdirectories within them
 */
const SYSTEM_DIRECTORIES = {
  darwin: [
    '/',
    '/System',
    '/Library',
    '/private',
    '/bin',
    '/sbin',
    '/usr',
    '/var',
    '/etc',
    '/cores'
  ],
  win32: ['C:\\', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData'],
  linux: ['/', '/boot', '/sys', '/proc', '/dev', '/etc', '/bin', '/sbin', '/usr', '/var', '/root']
}

/**
 * Disk space information
 */
export interface DiskSpaceInfo {
  totalSpace: number
  freeSpace: number
}

/**
 * Validates a path for use as a transfer destination
 * @param targetPath - The path to validate
 * @returns Validation result with detailed information
 */
export async function validatePath(targetPath: string): Promise<PathValidationResponse> {
  // Check for empty path
  if (!targetPath || targetPath.trim() === '') {
    return {
      isValid: false,
      exists: false,
      isWritable: false,
      isSystem: false,
      hasSpace: false,
      availableSpace: 0,
      error: 'Path cannot be empty'
    }
  }

  // Normalize and resolve to absolute path
  const normalizedPath = path.resolve(targetPath.trim())

  // Check if it's a system directory
  const isSystem = isSystemDirectory(normalizedPath)
  if (isSystem) {
    return {
      isValid: false,
      exists: false,
      isWritable: false,
      isSystem: true,
      hasSpace: false,
      availableSpace: 0,
      error: 'Cannot use system directory as destination'
    }
  }

  // Check if path exists
  let stats: Stats | null = null

  try {
    stats = await fs.stat(normalizedPath)

    // Verify it's a directory
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        exists: true,
        isWritable: false,
        isSystem: false,
        hasSpace: false,
        availableSpace: 0,
        error: 'Path must be a directory, not a file'
      }
    }
  } catch {
    return {
      isValid: false,
      exists: false,
      isWritable: false,
      isSystem: false,
      hasSpace: false,
      availableSpace: 0,
      error: `Path does not exist: ${normalizedPath}`
    }
  }

  // Check if directory is writable
  try {
    await fs.access(normalizedPath, fs.constants.W_OK)
  } catch {
    return {
      isValid: false,
      exists: true,
      isWritable: false,
      isSystem: false,
      hasSpace: false,
      availableSpace: 0,
      error: 'Path is not writable. Check permissions.'
    }
  }

  // Check available disk space
  let spaceInfo: DiskSpaceInfo
  try {
    spaceInfo = await checkDiskSpace(normalizedPath)
  } catch {
    return {
      isValid: false,
      exists: true,
      isWritable: true,
      isSystem: false,
      hasSpace: false,
      availableSpace: 0,
      error: 'Unable to determine available disk space'
    }
  }

  const hasSpace = spaceInfo.freeSpace > 0

  // All checks passed
  return {
    isValid: true,
    exists: true,
    isWritable: true,
    isSystem: false,
    hasSpace,
    availableSpace: spaceInfo.freeSpace
  }
}

/**
 * Checks if a path is a system directory that should not be modified
 * @param targetPath - The path to check
 * @returns true if the path is a system directory
 */
export function isSystemDirectory(targetPath: string): boolean {
  const normalizedPath = path.resolve(targetPath)
  const platform = process.platform as keyof typeof SYSTEM_DIRECTORIES
  const systemDirs = SYSTEM_DIRECTORIES[platform] || []

  // For Windows, do case-insensitive comparison
  if (platform === 'win32') {
    const lowerPath = normalizedPath.toLowerCase()
    return systemDirs.some((sysDir) => {
      const lowerSysDir = sysDir.toLowerCase()
      // Exact match or direct child (but not deeper subdirectories)
      return (
        lowerPath === lowerSysDir ||
        (lowerPath.startsWith(lowerSysDir + path.sep) &&
          lowerPath.split(path.sep).length === lowerSysDir.split(path.sep).length + 1)
      )
    })
  }

  // For Unix-like systems
  // Only block exact matches and direct children of critical system dirs
  return systemDirs.some((sysDir) => {
    // Root directory is always blocked
    if (sysDir === '/' && normalizedPath === '/') {
      return true
    }

    // For other system directories, only block the exact path or its direct children
    if (normalizedPath === sysDir) {
      return true
    }

    // Block direct children of critical system directories
    // But allow deeper subdirectories (e.g., /var/tmp/mydir is OK)
    if (normalizedPath.startsWith(sysDir + path.sep)) {
      const pathParts = normalizedPath.split(path.sep).filter((p) => p !== '')
      const sysDirParts = sysDir.split(path.sep).filter((p) => p !== '')
      // Only block if it's a direct child (one level deeper)
      return pathParts.length === sysDirParts.length + 1
    }

    return false
  })
}

/**
 * Gets disk space information for a given path
 * Uses different methods depending on the platform
 * @param targetPath - The path to check
 * @returns Disk space information
 */
export async function checkDiskSpace(targetPath: string): Promise<DiskSpaceInfo> {
  const normalizedPath = path.resolve(targetPath)

  // For Node.js 18+, we can use statfs
  // For older versions, we'll need to use platform-specific commands
  try {
    // Try to use fs.statfs (available in Node.js 18.15.0+)
    if ('statfs' in fs && typeof (fs as any).statfs === 'function') {
      const stats = await (fs as any).statfs(normalizedPath)
      const totalSpace = stats.blocks * stats.bsize
      const freeSpace = stats.bfree * stats.bsize

      return {
        totalSpace,
        freeSpace
      }
    }
  } catch {
    // Fall through to platform-specific methods
  }

  // Fallback: Use platform-specific commands
  return await checkDiskSpaceFallback(normalizedPath)
}

/**
 * Fallback method for checking disk space using platform-specific commands
 * @param targetPath - The path to check
 * @returns Disk space information
 */
async function checkDiskSpaceFallback(targetPath: string): Promise<DiskSpaceInfo> {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      // Windows: Use wmic with validated drive letter
      const drive = path.parse(targetPath).root
      // Validate drive letter format (e.g., "C:")
      const driveLetter = drive.replace(/[\\/:]/g, '').toUpperCase()
      if (!/^[A-Z]$/.test(driveLetter)) {
        throw new Error('Invalid drive letter')
      }

      // Use execFile with array of arguments to prevent command injection
      const { stdout } = await execFileAsync('wmic', [
        'logical',
        'disk',
        'where',
        `DeviceID='${driveLetter}:'`,
        'get',
        'FreeSpace,Size',
        '/format:csv'
      ])

      const lines = stdout.trim().split('\n')
      const data = lines[lines.length - 1].split(',')

      return {
        freeSpace: parseInt(data[1], 10),
        totalSpace: parseInt(data[2], 10)
      }
    } else {
      // Unix-like: Use df command with path as argument (not in string)
      // Validate path is safe for shell execution
      validatePathForShellExecution(targetPath, 'disk space check path')

      const { stdout } = await execFileAsync('df', ['-k', targetPath])
      const lines = stdout.trim().split('\n')
      const data = lines[1].split(/\s+/)

      // df returns values in 1K blocks
      const totalSpace = parseInt(data[1], 10) * 1024
      const freeSpace = parseInt(data[3], 10) * 1024

      return {
        totalSpace,
        freeSpace
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to check disk space: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Validates that a path has enough space for a transfer
 * @param targetPath - The destination path
 * @param requiredBytes - Number of bytes needed
 * @returns true if enough space is available
 */
export async function hasEnoughSpace(targetPath: string, requiredBytes: number): Promise<boolean> {
  try {
    const spaceInfo = await checkDiskSpace(targetPath)
    // Add 10% buffer for safety
    const requiredWithBuffer = requiredBytes * 1.1
    return spaceInfo.freeSpace >= requiredWithBuffer
  } catch {
    return false
  }
}
