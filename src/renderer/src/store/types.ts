/**
 * Renderer Store Types
 * Types for Zustand state management
 */

import type {
  AppConfig,
  DriveInfo,
  TransferSession,
  TransferProgress,
  LogEntry,
  FileTransferInfo,
  TransferErrorType,
  ScannedFile
} from '../../../shared/types'

/**
 * State for file selection in the transfer queue.
 * Uses folder-based selection with individual file deselection for efficiency.
 */
export interface FileSelectionState {
  /** Set of folder relative paths that are selected (all files in folder selected by default) */
  selectedFolders: Set<string>
  /** Set of individual file absolute paths that are deselected within selected folders */
  deselectedFiles: Set<string>
  /** Set of folder relative paths that are expanded in the UI */
  expandedFolders: Set<string>
}

export interface DriveState {
  detectedDrives: DriveInfo[]
  selectedDrive: DriveInfo | null
  scannedFiles: ScannedFile[]
  scanInProgress: boolean
  scanError: string | null
  existingDrives: string[] // Track drives that were present at startup
  unmountedDrives: string[] // Track drives that are unmounted but still physically connected
  /** File selection state for selective transfer feature */
  fileSelection: FileSelectionState
}

export interface TransferState {
  currentSession: TransferSession | null
  progress: TransferProgress | null
  isTransferring: boolean
  isPaused: boolean
  error: string | null
  history: TransferSession[]

  // Enhanced error tracking
  errorDetails: {
    type: TransferErrorType | null
    retryable: boolean
    affectedFiles: FileTransferInfo[]
    timestamp: number | null
  } | null

  // Retry state
  retryState: {
    isRetrying: boolean
    currentAttempt: number
    maxAttempts: number
    files: Record<string, { attempts: number; lastError: string }>
  } | null

  // Pre-transfer validation state
  validationState: {
    isValidating: boolean
    hasEnoughSpace: boolean
    spaceRequired: number
    spaceAvailable: number
    warnings: Array<{
      type: 'space' | 'network' | 'sanitization' | 'conflict'
      message: string
      severity: 'low' | 'medium' | 'high'
    }>
  } | null

  // System state awareness
  systemState: {
    isSleeping: boolean
  }

  // File-level tracking
  fileStates: Record<
    string,
    {
      status:
        | 'pending'
        | 'validating'
        | 'transferring'
        | 'verifying'
        | 'retrying'
        | 'complete'
        | 'error'
        | 'skipped'
      progress: number
      errorType?: TransferErrorType
      retryCount: number
      sanitized?: { original: string; sanitized: string }
    }
  >
}

export interface ConfigState {
  config: AppConfig
  isLoading: boolean
  error: string | null
}

export interface LogState {
  logs: LogEntry[]
  filter: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'all'
}

export interface UIState {
  selectedDestination: string | null
  isSelectingDestination: boolean
  showSettings: boolean
  showLogs: boolean
  showHistory: boolean

  // Toast notifications
  toasts: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    duration?: number
  }>

  // Notification history (displayed in LogViewer)
  notificationHistory: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    timestamp: number
    duration?: number
  }>
}
