/**
 * Renderer Store Types
 * Types for Zustand state management
 */

import type {
  AppConfig,
  DriveInfo,
  TransferSession,
  TransferProgress,
  LogEntry
} from '../../../shared/types'

export interface DriveState {
  detectedDrives: DriveInfo[]
  selectedDrive: DriveInfo | null
  scannedFiles: string[]
  scanInProgress: boolean
  scanError: string | null
  existingDrives: Set<string> // Track drives that were present at startup
}

export interface TransferState {
  currentSession: TransferSession | null
  progress: TransferProgress | null
  isTransferring: boolean
  error: string | null
  history: TransferSession[]
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
}
