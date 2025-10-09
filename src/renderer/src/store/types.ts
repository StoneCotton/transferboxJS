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
  TransferErrorType
} from '../../../shared/types'

export interface DriveState {
  detectedDrives: DriveInfo[]
  selectedDrive: DriveInfo | null
  scannedFiles: string[]
  scanInProgress: boolean
  scanError: string | null
  existingDrives: Set<string> // Track drives that were present at startup
  unmountedDrives: string[] // Track drives that are unmounted but still physically connected
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
    files: Map<string, { attempts: number; lastError: string }>
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
    isNetworkDestination: boolean
    hasOrphanedFiles: boolean
  }

  // File-level tracking
  fileStates: Map<
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

  // Modals and dialogs
  modals: {
    confirmTransfer: boolean
    retryFailedFiles: boolean
    insufficientSpace: boolean
    networkWarning: boolean
    fileConflicts: boolean
    sanitizationWarning: boolean
  }

  // Toast notifications
  toasts: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    duration?: number
  }>

  // Loading states
  loadingStates: {
    validating: boolean
    scanning: boolean
    transferring: boolean
    retrying: boolean
  }

  // Sidebar/panel visibility
  panels: {
    errorDetails: boolean
    fileList: boolean
    retryQueue: boolean
  }
}
