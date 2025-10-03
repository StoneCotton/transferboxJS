/**
 * Main Zustand Store
 * Combines all slices into a single store
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createDriveSlice, type DriveSlice } from './slices/driveSlice'
import { createTransferSlice, type TransferSlice } from './slices/transferSlice'
import { createConfigSlice, type ConfigSlice } from './slices/configSlice'
import { createLogSlice, type LogSlice } from './slices/logSlice'
import { createUISlice, type UISlice } from './slices/uiSlice'

// Combined store type
export type AppStore = DriveSlice & TransferSlice & ConfigSlice & LogSlice & UISlice

// Create the store
export const useStore = create<AppStore>()(
  devtools(
    (...args) => ({
      ...createDriveSlice(...args),
      ...createTransferSlice(...args),
      ...createConfigSlice(...args),
      ...createLogSlice(...args),
      ...createUISlice(...args)
    }),
    {
      name: 'TransferBox Store'
    }
  )
)

// Convenience selectors
export const useDriveStore = () =>
  useStore((state) => ({
    detectedDrives: state.detectedDrives,
    selectedDrive: state.selectedDrive,
    scannedFiles: state.scannedFiles,
    scanInProgress: state.scanInProgress,
    scanError: state.scanError,
    setDetectedDrives: state.setDetectedDrives,
    addDrive: state.addDrive,
    removeDrive: state.removeDrive,
    selectDrive: state.selectDrive,
    setScannedFiles: state.setScannedFiles,
    setScanInProgress: state.setScanInProgress,
    setScanError: state.setScanError,
    clearScan: state.clearScan
  }))

export const useTransferStore = () =>
  useStore((state) => ({
    currentSession: state.currentSession,
    progress: state.progress,
    isTransferring: state.isTransferring,
    error: state.error,
    history: state.history,
    startTransfer: state.startTransfer,
    updateProgress: state.updateProgress,
    completeTransfer: state.completeTransfer,
    failTransfer: state.failTransfer,
    cancelTransfer: state.cancelTransfer,
    clearError: state.clearError,
    setHistory: state.setHistory,
    addToHistory: state.addToHistory
  }))

export const useConfigStore = () =>
  useStore((state) => ({
    config: state.config,
    isLoading: state.isLoading,
    error: state.error,
    setConfig: state.setConfig,
    updateConfig: state.updateConfig,
    setLoading: state.setLoading,
    setError: state.setError
  }))

export const useLogStore = () =>
  useStore((state) => ({
    logs: state.logs,
    filter: state.filter,
    level: state.level,
    setLogs: state.setLogs,
    addLog: state.addLog,
    setFilter: state.setFilter,
    setLevel: state.setLevel,
    clearLogs: state.clearLogs,
    getFilteredLogs: state.getFilteredLogs
  }))

export const useUIStore = () =>
  useStore((state) => ({
    selectedDestination: state.selectedDestination,
    isSelectingDestination: state.isSelectingDestination,
    showSettings: state.showSettings,
    showLogs: state.showLogs,
    showHistory: state.showHistory,
    setSelectedDestination: state.setSelectedDestination,
    setIsSelectingDestination: state.setIsSelectingDestination,
    toggleSettings: state.toggleSettings,
    toggleLogs: state.toggleLogs,
    toggleHistory: state.toggleHistory,
    closeAllModals: state.closeAllModals
  }))
