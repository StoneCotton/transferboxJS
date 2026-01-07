/**
 * Main Zustand Store
 * Combines all slices into a single store
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
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

// Convenience selectors using shallow comparison for better performance
export const useDriveStore = () =>
  useStore(
    useShallow((state) => ({
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
      clearScan: state.clearScan,
      setExistingDrives: state.setExistingDrives,
      isExistingDrive: state.isExistingDrive,
      markDriveAsUnmounted: state.markDriveAsUnmounted,
      isDriveUnmounted: state.isDriveUnmounted
    }))
  )

export const useTransferStore = () =>
  useStore(
    useShallow((state) => ({
      currentSession: state.currentSession,
      progress: state.progress,
      isTransferring: state.isTransferring,
      isPaused: state.isPaused,
      error: state.error,
      history: state.history,
      startTransfer: state.startTransfer,
      updateProgress: state.updateProgress,
      completeTransfer: state.completeTransfer,
      failTransfer: state.failTransfer,
      cancelTransfer: state.cancelTransfer,
      pauseTransfer: state.pauseTransfer,
      resumeTransfer: state.resumeTransfer,
      clearError: state.clearError,
      setHistory: state.setHistory,
      addToHistory: state.addToHistory
    }))
  )

export const useConfigStore = () =>
  useStore(
    useShallow((state) => ({
      config: state.config,
      isLoading: state.isLoading,
      error: state.error,
      setConfig: state.setConfig,
      updateConfig: state.updateConfig,
      setConfigLoading: state.setConfigLoading,
      setConfigError: state.setConfigError
    }))
  )

export const useLogStore = () =>
  useStore(
    useShallow((state) => ({
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
  )

export const useUIStore = () =>
  useStore(
    useShallow((state) => ({
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
  )
