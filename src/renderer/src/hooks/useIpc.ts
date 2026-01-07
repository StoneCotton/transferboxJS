/**
 * IPC Communication Hook
 * Provides typed access to IPC calls
 */

import { useMemo } from 'react'
import type {
  PathValidationRequest,
  PathValidationResponse,
  TransferStartRequest,
  TransferValidateRequest,
  TransferValidateResponse,
  AppConfig,
  TransferSession,
  TransferProgress,
  LogEntry,
  DriveInfo,
  ScannedMedia,
  UpdateCheckResult,
  TransferErrorInfo
} from '../../../shared/types'

// Type-safe IPC API
export interface IpcApi {
  // Configuration
  getConfig: () => Promise<AppConfig>
  updateConfig: (config: Partial<AppConfig>) => Promise<AppConfig>
  resetConfig: () => Promise<AppConfig>

  // Path validation
  validatePath: (request: PathValidationRequest) => Promise<PathValidationResponse>
  selectFolder: () => Promise<string | null>

  // Drive operations
  listDrives: () => Promise<DriveInfo[]>
  scanDrive: (device: string) => Promise<ScannedMedia>
  unmountDrive: (device: string) => Promise<boolean>
  revealDrive: (device: string) => Promise<void>

  // Transfer operations
  validateTransfer: (request: TransferValidateRequest) => Promise<TransferValidateResponse>
  startTransfer: (request: TransferStartRequest) => Promise<void>
  stopTransfer: () => Promise<void>
  pauseTransfer: () => Promise<void>
  resumeTransfer: () => Promise<void>
  retryTransfer: (request: {
    files: Array<{ sourcePath: string; destinationPath: string }>
    driveInfo: DriveInfo
  }) => Promise<void>

  // History
  getHistory: () => Promise<TransferSession[]>
  getHistoryById: (id: string) => Promise<TransferSession | null>
  clearHistory: () => Promise<void>

  // Logs
  getRecentLogs: (limit?: number) => Promise<LogEntry[]>
  clearLogs: () => Promise<void>

  // App info
  getAppVersion: () => Promise<string>

  // Update checking
  checkForUpdates: (forceRefresh?: boolean) => Promise<UpdateCheckResult>
  openReleasesPage: () => Promise<void>

  // Config version management
  getVersionInfo: () => Promise<{
    appVersion: string
    configVersion: string
    isUpToDate: boolean
    needsMigration: boolean
    hasNewerConfigWarning: boolean
  }>
  getNewerConfigWarning: () => Promise<{
    configVersion: string
    appVersion: string
    timestamp: number
  } | null>
  handleNewerConfigChoice: (choice: 'continue' | 'reset') => Promise<AppConfig>
  clearNewerConfigWarning: () => Promise<void>

  // Event listeners
  onDriveDetected: (callback: (drive: DriveInfo) => void) => () => void
  onDriveRemoved: (callback: (device: string) => void) => () => void
  onDriveUnmounted: (callback: (device: string) => void) => () => void
  onTransferProgress: (callback: (progress: TransferProgress) => void) => () => void
  onTransferComplete: (callback: (data: TransferSession) => void) => () => void
  onTransferError: (callback: (error: TransferErrorInfo) => void) => () => void
  onTransferPaused: (callback: () => void) => () => void
  onTransferResumed: (callback: () => void) => () => void
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void
  onSystemSuspend: (callback: () => void) => () => void
  onSystemResume: (callback: () => void) => () => void
  onMenuOpenSettings: (callback: () => void) => () => void
  onMenuOpenHistory: (callback: () => void) => () => void
  onMenuNewTransfer: (callback: () => void) => () => void
  onMenuSelectDestination: (callback: () => void) => () => void
  onConfigMigrated: (
    callback: (data: { fromVersion: string; toVersion: string }) => void
  ) => () => void
  onUpdateAvailable: (callback: (result: UpdateCheckResult) => void) => () => void
}

/**
 * Hook to access IPC API
 * Returns a stable reference to window.api methods
 */
export function useIpc(): IpcApi {
  return useMemo(
    () => ({
      // Configuration
      getConfig: window.api.getConfig,
      updateConfig: window.api.updateConfig,
      resetConfig: window.api.resetConfig,

      // Path validation
      validatePath: window.api.validatePath,
      selectFolder: window.api.selectFolder,

      // Drive operations
      listDrives: window.api.listDrives,
      scanDrive: window.api.scanDrive,
      unmountDrive: window.api.unmountDrive,
      revealDrive: window.api.revealDrive,

      // Transfer operations
      validateTransfer: window.api.validateTransfer,
      startTransfer: window.api.startTransfer,
      stopTransfer: window.api.stopTransfer,
      pauseTransfer: window.api.pauseTransfer,
      resumeTransfer: window.api.resumeTransfer,
      retryTransfer: window.api.retryTransfer,

      // History
      getHistory: window.api.getHistory,
      getHistoryById: window.api.getHistoryById,
      clearHistory: window.api.clearHistory,

      // Logs
      getRecentLogs: window.api.getRecentLogs,
      clearLogs: window.api.clearLogs,

      // App info
      getAppVersion: window.api.getAppVersion,

      // Update checking
      checkForUpdates: window.api.checkForUpdates,
      openReleasesPage: window.api.openReleasesPage,

      // Config version management
      getVersionInfo: window.api.getVersionInfo,
      getNewerConfigWarning: window.api.getNewerConfigWarning,
      handleNewerConfigChoice: window.api.handleNewerConfigChoice,
      clearNewerConfigWarning: window.api.clearNewerConfigWarning,

      // Event listeners
      onDriveDetected: window.api.onDriveDetected,
      onDriveRemoved: window.api.onDriveRemoved,
      onDriveUnmounted: window.api.onDriveUnmounted,
      onTransferProgress: window.api.onTransferProgress,
      onTransferComplete: window.api.onTransferComplete,
      onTransferError: window.api.onTransferError,
      onTransferPaused: window.api.onTransferPaused,
      onTransferResumed: window.api.onTransferResumed,
      onLogEntry: window.api.onLogEntry,
      onSystemSuspend: window.api.onSystemSuspend,
      onSystemResume: window.api.onSystemResume,
      onMenuOpenSettings: window.api.onMenuOpenSettings,
      onMenuOpenHistory: window.api.onMenuOpenHistory,
      onMenuNewTransfer: window.api.onMenuNewTransfer,
      onMenuSelectDestination: window.api.onMenuSelectDestination,
      onConfigMigrated: window.api.onConfigMigrated,
      onUpdateAvailable: window.api.onUpdateAvailable
    }),
    []
  )
}
