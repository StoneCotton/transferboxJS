/**
 * Transfer state and progress types
 */

export type TransferStatus =
  | 'idle' // Waiting for drive
  | 'scanning' // Scanning drive for media files
  | 'ready' // Files found, ready to transfer
  | 'transferring' // Active transfer in progress
  | 'verifying' // Verifying checksums
  | 'complete' // Transfer completed successfully
  | 'error' // Error occurred
  | 'cancelled' // Transfer was cancelled by user

export interface FileTransferInfo {
  sourcePath: string
  destinationPath: string
  fileName: string
  fileSize: number
  bytesTransferred: number
  percentage: number
  speed?: number // Bytes per second for this file
  checksum?: string
  status: 'pending' | 'transferring' | 'verifying' | 'complete' | 'error' | 'skipped'
  error?: string
  startTime?: number
  endTime?: number
}

export interface TransferProgress {
  // Overall progress
  status: TransferStatus
  totalFiles: number
  completedFilesCount: number
  failedFiles: number
  skippedFiles: number
  totalBytes: number
  transferredBytes: number
  overallPercentage: number

  // Current file being transferred
  currentFile: FileTransferInfo | null

  // Active files being transferred in parallel
  activeFiles: FileTransferInfo[]

  // Completed files with their final status and checksums
  completedFiles: FileTransferInfo[]

  // Statistics
  transferSpeed: number // Bytes per second
  averageSpeed: number // Average speed since start
  eta: number // Estimated time remaining in seconds
  elapsedTime: number // Time elapsed in seconds

  // Timestamps
  startTime: number | null
  endTime: number | null

  // Error info
  errorMessage?: string
  errorCount: number
}

export interface TransferSession {
  id: string
  driveId: string
  driveName: string
  sourceRoot: string
  destinationRoot: string
  startTime: number
  endTime: number | null
  status: TransferStatus
  fileCount: number
  totalBytes: number
  files: FileTransferInfo[]
  errorMessage?: string
}

export const INITIAL_TRANSFER_PROGRESS: TransferProgress = {
  status: 'idle',
  totalFiles: 0,
  completedFilesCount: 0,
  failedFiles: 0,
  skippedFiles: 0,
  totalBytes: 0,
  transferredBytes: 0,
  overallPercentage: 0,
  currentFile: null,
  activeFiles: [],
  completedFiles: [],
  transferSpeed: 0,
  averageSpeed: 0,
  eta: 0,
  elapsedTime: 0,
  startTime: null,
  endTime: null,
  errorCount: 0
}
