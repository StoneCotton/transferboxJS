/**
 * IPC Communication Hook
 * Provides typed access to IPC calls
 */

import { useCallback } from 'react'
import type {
  PathValidationRequest,
  PathValidationResponse,
  TransferStartRequest,
  TransferValidateRequest,
  TransferValidateResponse,
  AppConfig,
  TransferSession,
  LogEntry,
  DriveInfo,
  ScannedMedia,
  UpdateCheckResult
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

  // Transfer operations
  validateTransfer: (request: TransferValidateRequest) => Promise<TransferValidateResponse>
  startTransfer: (request: TransferStartRequest) => Promise<void>
  stopTransfer: () => Promise<void>

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
  checkForUpdates: () => Promise<UpdateCheckResult>
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
  onTransferProgress: (callback: (progress: any) => void) => () => void
  onTransferComplete: (callback: (data: any) => void) => () => void
  onTransferError: (callback: (error: string) => void) => () => void
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
 */
export function useIpc(): IpcApi {
  // Configuration
  const getConfig = useCallback(async () => {
    return await window.api.getConfig()
  }, [])

  const updateConfig = useCallback(async (config: Partial<AppConfig>) => {
    return await window.api.updateConfig(config)
  }, [])

  const resetConfig = useCallback(async () => {
    return await window.api.resetConfig()
  }, [])

  // Path validation
  const validatePath = useCallback(async (request: PathValidationRequest) => {
    return await window.api.validatePath(request)
  }, [])

  const selectFolder = useCallback(async () => {
    return await window.api.selectFolder()
  }, [])

  // Drive operations
  const listDrives = useCallback(async () => {
    return await window.api.listDrives()
  }, [])

  const scanDrive = useCallback(async (device: string) => {
    return await window.api.scanDrive(device)
  }, [])

  const unmountDrive = useCallback(async (device: string) => {
    return await window.api.unmountDrive(device)
  }, [])

  // Transfer operations
  const validateTransfer = useCallback(async (request: TransferValidateRequest) => {
    return await window.api.validateTransfer(request)
  }, [])

  const startTransfer = useCallback(async (request: TransferStartRequest) => {
    return await window.api.startTransfer(request)
  }, [])

  const stopTransfer = useCallback(async () => {
    return await window.api.stopTransfer()
  }, [])

  // History
  const getHistory = useCallback(async () => {
    return await window.api.getHistory()
  }, [])

  const getHistoryById = useCallback(async (id: string) => {
    return await window.api.getHistoryById(id)
  }, [])

  const clearHistory = useCallback(async () => {
    return await window.api.clearHistory()
  }, [])

  // Logs
  const getRecentLogs = useCallback(async (limit?: number) => {
    return await window.api.getRecentLogs(limit)
  }, [])

  const clearLogs = useCallback(async () => {
    return await window.api.clearLogs()
  }, [])

  // App info
  const getAppVersion = useCallback(async () => {
    return await window.api.getAppVersion()
  }, [])

  // Update checking
  const checkForUpdates = useCallback(async () => {
    return await window.api.checkForUpdates()
  }, [])

  const openReleasesPage = useCallback(async () => {
    return await window.api.openReleasesPage()
  }, [])

  // Config version management
  const getVersionInfo = useCallback(async () => {
    return await window.api.getVersionInfo()
  }, [])

  const getNewerConfigWarning = useCallback(async () => {
    return await window.api.getNewerConfigWarning()
  }, [])

  const handleNewerConfigChoice = useCallback(async (choice: 'continue' | 'reset') => {
    return await window.api.handleNewerConfigChoice(choice)
  }, [])

  const clearNewerConfigWarning = useCallback(async () => {
    return await window.api.clearNewerConfigWarning()
  }, [])

  // Event listeners
  const onDriveDetected = useCallback((callback: (drive: DriveInfo) => void) => {
    return window.api.onDriveDetected(callback)
  }, [])

  const onDriveRemoved = useCallback((callback: (device: string) => void) => {
    return window.api.onDriveRemoved(callback)
  }, [])

  const onDriveUnmounted = useCallback((callback: (device: string) => void) => {
    return window.api.onDriveUnmounted(callback)
  }, [])

  const onTransferProgress = useCallback((callback: (progress: any) => void) => {
    return window.api.onTransferProgress(callback)
  }, [])

  const onTransferComplete = useCallback((callback: (data: any) => void) => {
    return window.api.onTransferComplete(callback)
  }, [])

  const onTransferError = useCallback((callback: (error: string) => void) => {
    return window.api.onTransferError(callback)
  }, [])

  const onLogEntry = useCallback((callback: (entry: LogEntry) => void) => {
    return window.api.onLogEntry(callback)
  }, [])

  const onSystemSuspend = useCallback((callback: () => void) => {
    return window.api.onSystemSuspend(callback)
  }, [])

  const onSystemResume = useCallback((callback: () => void) => {
    return window.api.onSystemResume(callback)
  }, [])

  const onMenuOpenSettings = useCallback((callback: () => void) => {
    return window.api.onMenuOpenSettings(callback)
  }, [])

  const onMenuOpenHistory = useCallback((callback: () => void) => {
    return window.api.onMenuOpenHistory(callback)
  }, [])

  const onMenuNewTransfer = useCallback((callback: () => void) => {
    return window.api.onMenuNewTransfer(callback)
  }, [])

  const onMenuSelectDestination = useCallback((callback: () => void) => {
    return window.api.onMenuSelectDestination(callback)
  }, [])

  const onConfigMigrated = useCallback(
    (callback: (data: { fromVersion: string; toVersion: string }) => void) => {
      return window.api.onConfigMigrated(callback)
    },
    []
  )

  const onUpdateAvailable = useCallback((callback: (result: UpdateCheckResult) => void) => {
    return window.api.onUpdateAvailable(callback)
  }, [])

  return {
    getConfig,
    updateConfig,
    resetConfig,
    validatePath,
    selectFolder,
    listDrives,
    scanDrive,
    unmountDrive,
    validateTransfer,
    startTransfer,
    stopTransfer,
    getHistory,
    getHistoryById,
    clearHistory,
    getRecentLogs,
    clearLogs,
    getAppVersion,
    checkForUpdates,
    openReleasesPage,
    getVersionInfo,
    getNewerConfigWarning,
    handleNewerConfigChoice,
    clearNewerConfigWarning,
    onDriveDetected,
    onDriveRemoved,
    onDriveUnmounted,
    onTransferProgress,
    onTransferComplete,
    onTransferError,
    onLogEntry,
    onSystemSuspend,
    onSystemResume,
    onMenuOpenSettings,
    onMenuOpenHistory,
    onMenuNewTransfer,
    onMenuSelectDestination,
    onConfigMigrated,
    onUpdateAvailable
  }
}
