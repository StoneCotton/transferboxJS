/**
 * Drive detection and information types
 */

export interface DriveInfo {
  device: string // Device path (e.g., /dev/disk2, E:)
  displayName: string // User-friendly name
  description: string // Device description
  mountpoints: string[] // Mount points (where drive is mounted)
  size: number // Total size in bytes
  isRemovable: boolean // Whether drive is removable
  isSystem: boolean // Whether this is a system drive
  busType: string // Connection type (USB, SD, etc.)
}

export interface DriveStats {
  totalSpace: number // Total space in bytes
  freeSpace: number // Available space in bytes
  usedSpace: number // Used space in bytes
  percentUsed: number // Percentage used
}

/**
 * File metadata collected during scanning
 */
export interface ScannedFile {
  path: string // Absolute path to the file
  size: number // File size in bytes
  birthtime: number // File creation date/time (timestamp in milliseconds)
  mtime: number // File modification date/time (timestamp in milliseconds)
}

export interface ScannedMedia {
  driveInfo: DriveInfo
  files: ScannedFile[] // File objects with metadata
  totalSize: number // Total size of all media files
  fileCount: number // Number of media files found
  scanTime: number // Time taken to scan in milliseconds
}
