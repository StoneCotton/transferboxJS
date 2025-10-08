import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppConfig,
  PathValidationRequest,
  PathValidationResponse,
  TransferStartRequest,
  TransferSession,
  LogEntry,
  DriveInfo
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
  scanDrive: (
    device: string
  ) => Promise<{ driveInfo: DriveInfo; files: string[]; totalSize: number; fileCount: number }>
  unmountDrive: (device: string) => Promise<boolean>

  // Transfer operations
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

  // Event listeners
  onDriveDetected: (callback: (drive: DriveInfo) => void) => () => void
  onDriveRemoved: (callback: (device: string) => void) => () => void
  onTransferProgress: (callback: (progress: any) => void) => () => void
  onTransferComplete: (callback: (data: any) => void) => () => void
  onTransferError: (callback: (error: string) => void) => () => void
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IpcApi
  }
}
