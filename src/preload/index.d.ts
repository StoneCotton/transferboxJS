import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppConfig,
  PathValidationRequest,
  PathValidationResponse,
  TransferStartRequest,
  TransferValidateRequest,
  TransferValidateResponse,
  TransferSession,
  TransferStatusResponse,
  LogEntry,
  DriveInfo,
  ScannedMedia,
  UpdateCheckResult
} from '../shared/types'

interface IpcApi {
  // Configuration
  getConfig: () => Promise<AppConfig>
  updateConfig: (config: Partial<AppConfig>) => Promise<AppConfig>
  resetConfig: () => Promise<AppConfig>
  migrateConfig: () => Promise<AppConfig>

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
  getTransferStatus: () => Promise<TransferStatusResponse>
  retryTransfer: (request: {
    files: Array<{ sourcePath: string; destinationPath: string }>
    driveInfo: { device: string; displayName: string }
  }) => Promise<void>

  // History
  getHistory: () => Promise<TransferSession[]>
  getHistoryById: (id: string) => Promise<TransferSession | null>
  clearHistory: () => Promise<void>

  // Logs
  getRecentLogs: (limit?: number) => Promise<LogEntry[]>
  clearLogs: () => Promise<void>
  getLogsByRange: (
    startTime: number,
    endTime: number,
    level?: 'debug' | 'info' | 'warn' | 'error'
  ) => Promise<LogEntry[]>

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

declare global {
  interface Window {
    electron: ElectronAPI
    api: IpcApi
  }
}
