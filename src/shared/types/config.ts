/**
 * Configuration types for TransferBox
 *
 * This module defines the application configuration schema including:
 * - Transfer modes (manual, auto-transfer, confirm-transfer, fully-autonomous)
 * - Drive detection settings (showAllDrives for including non-removable drives)
 * - File naming and directory structure options
 * - Media file filtering and system file exclusion
 * - Checksum verification and MHL generation
 * - Performance tuning (buffer size, chunk size)
 * - UI preferences (density, unit system, tooltips)
 *
 * The DEFAULT_CONFIG provides sensible defaults for all settings.
 * Configuration is persisted via electron-store and migrated between versions.
 */

export type TransferMode = 'auto-transfer' | 'confirm-transfer' | 'fully-autonomous' | 'manual'

export type ChecksumAlgorithm = 'xxhash64'

export type UnitSystem = 'binary' | 'decimal'

export type UiDensity = 'comfortable' | 'condensed'

export type ConflictResolution = 'skip' | 'rename' | 'overwrite' | 'ask'

export interface AppConfig {
  // Config version for migration purposes (semantic versioning)
  // Set automatically from package.json by the config manager
  configVersion: string

  // Transfer modes
  // 'auto-transfer' = Mode 1: Auto-start when drive detected, ask for destination each time
  // 'confirm-transfer' = Mode 2: After setting destination, require confirmation
  // 'fully-autonomous' = Mode 3: Pre-configured destination, fully automatic
  // 'manual' = Mode 4: Manual selection of source and destination
  transferMode: TransferMode

  // Destination settings
  defaultDestination: string | null // Used in autonomous mode

  // Drive detection settings
  showAllDrives: boolean // Show all local physical drives as sources (default: only removable drives)

  // File naming settings
  addTimestampToFilename: boolean // Add timestamp to file names to prevent duplicates
  keepOriginalFilename: boolean // Preserve original filename when adding timestamps (requires addTimestampToFilename)
  filenameTemplate: string // Template for renaming files. Use {original} for original name and {timestamp} for timestamp
  timestampFormat: string // Format for timestamps in filenames (e.g., %Y%m%d_%H%M%S for YYYYMMDD_HHMMSS)

  // Directory structure settings
  createDateBasedFolders: boolean // Organize files into folders based on their creation date
  dateFolderFormat: string // Format for date-based folder names (e.g., %Y/%m/%d for YYYY/MM/DD)
  createDeviceBasedFolders: boolean // Create separate folders for each source device or drive
  deviceFolderTemplate: string // Template for device folder names. Use {device_name} for the device name
  keepFolderStructure: boolean // Maintain the original folder structure from the source drive

  // Media file filtering
  transferOnlyMediaFiles: boolean // Only transfer files with media extensions, ignoring other file types
  mediaExtensions: string[] // List of file extensions considered as media files (e.g., .mp4, .mov, .wav)
  excludeSystemFiles: boolean // Exclude common OS/system files from scans (e.g., .DS_Store, Thumbs.db)

  // Checksum settings
  checksumAlgorithm: ChecksumAlgorithm
  verifyChecksums: boolean
  generateMHLChecksumFiles: boolean // Create Media Hash List (MHL) files for data integrity verification

  // Performance settings
  bufferSize: number // In bytes, default 64KB
  chunkSize: number // In bytes, for progress updates

  // Logging
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  enableLogging: boolean

  // UI preferences
  showDetailedProgress: boolean
  autoCleanupLogs: boolean
  logRetentionDays: number
  unitSystem: UnitSystem // 'binary' for GiB/KiB/MiB (1024-based), 'decimal' for GB/KB/MB (1000-based)
  uiDensity: UiDensity // 'comfortable' for spacious layout, 'condensed' for compact layout (better for small screens)
  showTooltips: boolean // Enable or disable tooltip hints throughout the app

  // Conflict resolution settings
  conflictResolution: ConflictResolution // 'skip' to skip conflicts, 'rename' to auto-rename, 'overwrite' to replace, 'ask' to prompt user

  // Internal properties (not user-configurable)
  _newerConfigWarning?: {
    configVersion: string
    appVersion: string
    timestamp: number
  }
}

/**
 * Default configuration template
 * Note: configVersion will be set dynamically by ConfigManager from package.json
 */
export const DEFAULT_CONFIG: AppConfig = {
  configVersion: '0.0.0', // Placeholder - will be replaced by ConfigManager with actual version from package.json
  transferMode: 'manual', // Default to Mode 4
  defaultDestination: null,

  // Drive detection settings
  showAllDrives: false, // Only show removable drives by default

  // File naming settings
  addTimestampToFilename: false,
  keepOriginalFilename: false,
  filenameTemplate: '{original}_{timestamp}',
  timestampFormat: '%Y%m%d_%H%M%S', // YYYYMMDD_HHMMSS format

  // Directory structure settings
  createDateBasedFolders: false,
  dateFolderFormat: '%Y/%m/%d', // YYYY/MM/DD format
  createDeviceBasedFolders: false,
  deviceFolderTemplate: '{device_name}',
  keepFolderStructure: false,

  // Media file filtering
  transferOnlyMediaFiles: false,
  excludeSystemFiles: true, // Exclude system files by default
  mediaExtensions: [
    // Video formats
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.m4v',
    '.mpg',
    '.mpeg',
    '.mts', // AVCHD
    '.m2ts', // AVCHD
    '.mxf', // Professional video (Sony, Canon, Panasonic)
    '.crm', // Canon Raw Lite
    '.braw', // Blackmagic RAW
    '.r3d', // RED RAW
    '.webm',
    // Image formats
    '.jpg',
    '.jpeg',
    '.png',
    '.raw',
    '.cr2', // Canon RAW
    '.cr3', // Canon RAW (newer)
    '.nef', // Nikon RAW
    '.arw', // Sony RAW
    '.dng', // Adobe Digital Negative
    '.heic', // High Efficiency Image Format
    '.heif',
    // Audio formats
    '.wav',
    '.mp3',
    '.aac',
    '.flac',
    '.m4a',
    // Metadata/sidecar files
    '.xml' // Camera metadata, Adobe sidecar files
  ],

  // Checksum settings
  checksumAlgorithm: 'xxhash64',
  verifyChecksums: true,
  generateMHLChecksumFiles: false,

  // Performance settings
  bufferSize: 4194304, // 4MB - optimized for modern SSDs
  chunkSize: 1048576, // 1MB for progress updates

  // Logging
  logLevel: 'info',
  enableLogging: true,

  // UI preferences
  showDetailedProgress: true,
  autoCleanupLogs: false,
  logRetentionDays: 30,
  unitSystem: 'decimal', // Default to decimal units (GB/KB/MB) to match standard storage displays
  uiDensity: 'comfortable', // Default to comfortable layout
  showTooltips: true, // Show tooltips by default

  // Conflict resolution settings
  conflictResolution: 'ask' // Default to asking user for conflict resolution
}
