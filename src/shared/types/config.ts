/**
 * Configuration types for TransferBox
 */

export type TransferMode = 'manual' | 'semi-auto' | 'autonomous'

export type FolderStructure = 'date-based' | 'device-based' | 'flat' | 'preserve-source'

export type ChecksumAlgorithm = 'xxhash64'

export interface AppConfig {
  // Transfer modes
  transferMode: TransferMode // 'manual' = Mode 1, 'semi-auto' = Mode 2, 'autonomous' = Mode 3

  // Destination settings
  defaultDestination: string | null // Used in autonomous mode

  // File naming
  preserveOriginalNames: boolean
  timestampFormat: string // e.g., 'YYYY-MM-DD_HHmmss'

  // Folder structure
  folderStructure: FolderStructure

  // Media file filtering
  mediaExtensions: string[] // e.g., ['.mp4', '.mov', '.jpg', '.raw', '.dng']

  // Checksum settings
  checksumAlgorithm: ChecksumAlgorithm
  verifyChecksums: boolean

  // Performance settings
  bufferSize: number // In bytes, default 64KB
  chunkSize: number // In bytes, for progress updates

  // Logging
  enableLogging: boolean
  generateMHL: boolean // Generate MHL manifest files

  // UI preferences
  showDetailedProgress: boolean
  autoCleanupLogs: boolean
  logRetentionDays: number
}

export const DEFAULT_CONFIG: AppConfig = {
  transferMode: 'manual',
  defaultDestination: null,
  preserveOriginalNames: true,
  timestampFormat: 'YYYY-MM-DD_HHmmss',
  folderStructure: 'date-based',
  mediaExtensions: [
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.m4v',
    '.mpg',
    '.mpeg',
    '.jpg',
    '.jpeg',
    '.png',
    '.raw',
    '.cr2',
    '.nef',
    '.arw',
    '.dng',
    '.wav',
    '.mp3',
    '.aac',
    '.flac',
    '.m4a'
  ],
  checksumAlgorithm: 'xxhash64',
  verifyChecksums: true,
  bufferSize: 65536, // 64KB
  chunkSize: 1048576, // 1MB for progress updates
  enableLogging: true,
  generateMHL: false,
  showDetailedProgress: true,
  autoCleanupLogs: false,
  logRetentionDays: 30
}
