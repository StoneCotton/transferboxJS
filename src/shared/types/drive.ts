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

export interface ScannedMedia {
  driveInfo: DriveInfo
  files: string[] // Absolute paths to media files
  totalSize: number // Total size of all media files
  fileCount: number // Number of media files found
  scanTime: number // Time taken to scan in milliseconds
}
