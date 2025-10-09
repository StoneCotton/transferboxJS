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
import { createErrorSlice, type ErrorSlice } from './slices/errorSlice'

// Combined store type
export type AppStore = DriveSlice & TransferSlice & ConfigSlice & LogSlice & UISlice & ErrorSlice

// Create the store
export const useStore = create<AppStore>()(
  devtools(
    (...args) => ({
      ...createDriveSlice(...args),
      ...createTransferSlice(...args),
      ...createConfigSlice(...args),
      ...createLogSlice(...args),
      ...createUISlice(...args),
      ...createErrorSlice(...args)
    }),
    {
      name: 'TransferBox Store'
    }
  )
)

// Convenience selectors
export const useDriveStore = () => {
  const detectedDrives = useStore((state) => state.detectedDrives)
  const selectedDrive = useStore((state) => state.selectedDrive)
  const scannedFiles = useStore((state) => state.scannedFiles)
  const scanInProgress = useStore((state) => state.scanInProgress)
  const scanError = useStore((state) => state.scanError)
  const setDetectedDrives = useStore((state) => state.setDetectedDrives)
  const addDrive = useStore((state) => state.addDrive)
  const removeDrive = useStore((state) => state.removeDrive)
  const selectDrive = useStore((state) => state.selectDrive)
  const setScannedFiles = useStore((state) => state.setScannedFiles)
  const setScanInProgress = useStore((state) => state.setScanInProgress)
  const setScanError = useStore((state) => state.setScanError)
  const clearScan = useStore((state) => state.clearScan)
  const setExistingDrives = useStore((state) => state.setExistingDrives)
  const isExistingDrive = useStore((state) => state.isExistingDrive)
  const markDriveAsUnmounted = useStore((state) => state.markDriveAsUnmounted)
  const isDriveUnmounted = useStore((state) => state.isDriveUnmounted)

  return {
    detectedDrives,
    selectedDrive,
    scannedFiles,
    scanInProgress,
    scanError,
    setDetectedDrives,
    addDrive,
    removeDrive,
    selectDrive,
    setScannedFiles,
    setScanInProgress,
    setScanError,
    clearScan,
    setExistingDrives,
    isExistingDrive,
    markDriveAsUnmounted,
    isDriveUnmounted
  }
}

export const useTransferStore = () => {
  const currentSession = useStore((state) => state.currentSession)
  const progress = useStore((state) => state.progress)
  const isTransferring = useStore((state) => state.isTransferring)
  const error = useStore((state) => state.error)
  const history = useStore((state) => state.history)
  const startTransfer = useStore((state) => state.startTransfer)
  const updateProgress = useStore((state) => state.updateProgress)
  const completeTransfer = useStore((state) => state.completeTransfer)
  const failTransfer = useStore((state) => state.failTransfer)
  const cancelTransfer = useStore((state) => state.cancelTransfer)
  const clearError = useStore((state) => state.clearError)
  const setHistory = useStore((state) => state.setHistory)
  const addToHistory = useStore((state) => state.addToHistory)

  return {
    currentSession,
    progress,
    isTransferring,
    error,
    history,
    startTransfer,
    updateProgress,
    completeTransfer,
    failTransfer,
    cancelTransfer,
    clearError,
    setHistory,
    addToHistory
  }
}

export const useConfigStore = () => {
  const config = useStore((state) => state.config)
  const isLoading = useStore((state) => state.isLoading)
  const error = useStore((state) => state.error)
  const setConfig = useStore((state) => state.setConfig)
  const updateConfig = useStore((state) => state.updateConfig)
  const setConfigLoading = useStore((state) => state.setConfigLoading)
  const setConfigError = useStore((state) => state.setConfigError)

  return {
    config,
    isLoading,
    error,
    setConfig,
    updateConfig,
    setConfigLoading,
    setConfigError
  }
}

export const useLogStore = () => {
  const logs = useStore((state) => state.logs)
  const filter = useStore((state) => state.filter)
  const level = useStore((state) => state.level)
  const setLogs = useStore((state) => state.setLogs)
  const addLog = useStore((state) => state.addLog)
  const setFilter = useStore((state) => state.setFilter)
  const setLevel = useStore((state) => state.setLevel)
  const clearLogs = useStore((state) => state.clearLogs)
  const getFilteredLogs = useStore((state) => state.getFilteredLogs)

  return {
    logs,
    filter,
    level,
    setLogs,
    addLog,
    setFilter,
    setLevel,
    clearLogs,
    getFilteredLogs
  }
}

export const useUIStore = () => {
  const selectedDestination = useStore((state) => state.selectedDestination)
  const isSelectingDestination = useStore((state) => state.isSelectingDestination)
  const showSettings = useStore((state) => state.showSettings)
  const showLogs = useStore((state) => state.showLogs)
  const showHistory = useStore((state) => state.showHistory)
  const setSelectedDestination = useStore((state) => state.setSelectedDestination)
  const setIsSelectingDestination = useStore((state) => state.setIsSelectingDestination)
  const toggleSettings = useStore((state) => state.toggleSettings)
  const toggleLogs = useStore((state) => state.toggleLogs)
  const toggleHistory = useStore((state) => state.toggleHistory)
  const closeAllModals = useStore((state) => state.closeAllModals)

  return {
    selectedDestination,
    isSelectingDestination,
    showSettings,
    showLogs,
    showHistory,
    setSelectedDestination,
    setIsSelectingDestination,
    toggleSettings,
    toggleLogs,
    toggleHistory,
    closeAllModals
  }
}
