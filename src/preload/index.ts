import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Configuration
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
  updateConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config),
  resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_RESET),
  migrateConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_MIGRATE),

  // Path validation
  validatePath: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.PATH_VALIDATE, request),
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.PATH_SELECT_FOLDER),

  // Drive operations
  listDrives: () => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_LIST),
  scanDrive: (device: string) => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_SCAN, device),
  unmountDrive: (device: string) => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_UNMOUNT, device),

  // Transfer operations
  startTransfer: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_START, request),
  stopTransfer: () => ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_STOP),
  getTransferStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TRANSFER_STATUS),

  // History
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_ALL),
  getHistoryById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_BY_ID, id),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),

  // Logs
  getRecentLogs: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.LOG_GET_RECENT, limit),
  clearLogs: () => ipcRenderer.invoke(IPC_CHANNELS.LOG_CLEAR),

  // App info
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),

  // Event listeners
  onDriveDetected: (callback: (drive: any) => void) => {
    const listener = (_event: any, drive: any) => callback(drive)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_DETECTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_DETECTED, listener)
  },
  onDriveRemoved: (callback: (device: string) => void) => {
    const listener = (_event: any, device: string) => callback(device)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_REMOVED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_REMOVED, listener)
  },
  onDriveUnmounted: (callback: (device: string) => void) => {
    const listener = (_event: any, device: string) => callback(device)
    ipcRenderer.on(IPC_CHANNELS.DRIVE_UNMOUNTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DRIVE_UNMOUNTED, listener)
  },
  onTransferProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_PROGRESS, listener)
  },
  onTransferComplete: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_COMPLETE, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_COMPLETE, listener)
  },
  onTransferError: (callback: (error: string) => void) => {
    const listener = (_event: any, error: string) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.TRANSFER_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSFER_ERROR, listener)
  },
  onLogEntry: (callback: (entry: any) => void) => {
    const listener = (_event: any, entry: any) => callback(entry)
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
