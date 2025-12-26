import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC_CHANNELS,
  PathValidationRequest,
  TransferValidateRequest,
  TransferStartRequest,
  TransferRetryRequest,
  LogEntry,
  UpdateCheckResult
} from '../shared/types'
import type { AppConfig } from '../shared/types/config'
import type { DriveInfo } from '../shared/types/drive'
import type { TransferProgress, TransferSession } from '../shared/types/transfer'

// Custom APIs for renderer
const api = {
  // Configuration
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
  updateConfig: (config: Partial<AppConfig>) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config),
  resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_RESET),
  migrateConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_MIGRATE),

  // Path validation
  validatePath: (request: PathValidationRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PATH_VALIDATE, request),
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.PATH_SELECT_FOLDER),

  // Drive operations
  listDrives: () => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_LIST),
  scanDrive: (device: string) => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_SCAN, device),
  unmountDrive: (device: string) => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_UNMOUNT, device),
  revealDrive: (device: string) => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_REVEAL, device),

  // Transfer operations
  validateTransfer: (request: TransferValidateRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_VALIDATE, request),
  startTransfer: (request: TransferStartRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_START, request),
  stopTransfer: () => ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_STOP),
  getTransferStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_STATUS),
  retryTransfer: (request: TransferRetryRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_RETRY, request),

  // History
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_ALL),
  getHistoryById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_BY_ID, id),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),

  // Logs
  getRecentLogs: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.LOG_GET_RECENT, limit),
  clearLogs: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_CLEAR),
  getLogsByRange: (
    startTime: number,
    endTime: number,
    level?: 'debug' | 'info' | 'warn' | 'error'
  ) => ipcRenderer.invoke(IPC_CHANNELS.LOG_GET_RANGE, { startTime, endTime, level }),

  // App info
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),

  // Update checking
  checkForUpdates: (forceRefresh?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK, forceRefresh),
  openReleasesPage: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_OPEN_RELEASES),

  // Config version management
  getVersionInfo: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_VERSION_INFO),
  getNewerConfigWarning: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_NEWER_WARNING),
  handleNewerConfigChoice: (choice: 'continue' | 'reset') =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_HANDLE_NEWER, choice),
  clearNewerConfigWarning: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING),

  // Event listeners
  onDriveDetected: (callback: (drive: DriveInfo) => void) => {
    const listener = (_event: IpcRendererEvent, drive: DriveInfo) => callback(drive)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_DETECTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_DETECTED, listener)
  },
  onDriveRemoved: (callback: (device: string) => void) => {
    const listener = (_event: IpcRendererEvent, device: string) => callback(device)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_REMOVED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_REMOVED, listener)
  },
  onDriveUnmounted: (callback: (device: string) => void) => {
    const listener = (_event: IpcRendererEvent, device: string) => callback(device)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_UNMOUNTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_UNMOUNTED, listener)
  },
  onTransferProgress: (callback: (progress: TransferProgress) => void) => {
    const listener = (_event: IpcRendererEvent, progress: TransferProgress) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_PROGRESS, listener)
  },
  onTransferComplete: (callback: (data: TransferSession) => void) => {
    const listener = (_event: IpcRendererEvent, data: TransferSession) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_COMPLETE, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_COMPLETE, listener)
  },
  onTransferError: (callback: (error: string) => void) => {
    const listener = (_event: IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_ERROR, listener)
  },
  onLogEntry: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, listener)
  },
  onSystemSuspend: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.SYSTEM_SUSPEND, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYSTEM_SUSPEND, listener)
  },
  onSystemResume: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.SYSTEM_RESUME, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYSTEM_RESUME, listener)
  },
  onMenuOpenSettings: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_SETTINGS, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_SETTINGS, listener)
  },
  onMenuOpenHistory: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_HISTORY, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_HISTORY, listener)
  },
  onMenuNewTransfer: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_NEW_TRANSFER, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_NEW_TRANSFER, listener)
  },
  onMenuSelectDestination: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_SELECT_DESTINATION, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_SELECT_DESTINATION, listener)
  },
  onConfigMigrated: (callback: (data: { fromVersion: string; toVersion: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { fromVersion: string; toVersion: string }) =>
      callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONFIG_MIGRATED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_MIGRATED, listener)
  },
  onUpdateAvailable: (callback: (result: UpdateCheckResult) => void) => {
    const listener = (_event: IpcRendererEvent, result: UpdateCheckResult) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.UPDATE_AVAILABLE, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_AVAILABLE, listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
