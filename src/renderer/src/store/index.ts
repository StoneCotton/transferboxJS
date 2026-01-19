/**
 * Main Zustand Store
 * Combines all slices into a single store.
 * Provides convenience selectors for common state access patterns.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
import { useMemo } from 'react'
import { createDriveSlice, type DriveSlice } from './slices/driveSlice'
import { createTransferSlice, type TransferSlice } from './slices/transferSlice'
import { createConfigSlice, type ConfigSlice } from './slices/configSlice'
import { createLogSlice, type LogSlice } from './slices/logSlice'
import { createUISlice, type UISlice } from './slices/uiSlice'
import { createErrorSlice, type ErrorSlice } from './slices/errorSlice'
import { createBenchmarkSlice, type BenchmarkSlice } from './slices/benchmarkSlice'
import {
  groupFilesByFolder,
  getSelectedFilePaths,
  getSelectionStats,
  getAllFolderPaths,
  type FolderGroup
} from '../utils/fileGrouping'

// Combined store type
export type AppStore = DriveSlice &
  TransferSlice &
  ConfigSlice &
  LogSlice &
  UISlice &
  ErrorSlice &
  BenchmarkSlice

// Create the store
export const useStore = create<AppStore>()(
  devtools(
    (...args) => ({
      ...createDriveSlice(...args),
      ...createTransferSlice(...args),
      ...createConfigSlice(...args),
      ...createLogSlice(...args),
      ...createUISlice(...args),
      ...createErrorSlice(...args),
      ...createBenchmarkSlice(...args)
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
      fileSelection: state.fileSelection,
      setDetectedDrives: state.setDetectedDrives,
      addDrive: state.addDrive,
      removeDrive: state.removeDrive,
      selectDrive: state.selectDrive,
      setScannedFiles: state.setScannedFiles,
      setScannedFilesWithSelection: state.setScannedFilesWithSelection,
      setScanInProgress: state.setScanInProgress,
      setScanError: state.setScanError,
      clearScan: state.clearScan,
      setExistingDrives: state.setExistingDrives,
      isExistingDrive: state.isExistingDrive,
      markDriveAsUnmounted: state.markDriveAsUnmounted,
      isDriveUnmounted: state.isDriveUnmounted,
      // File selection actions
      toggleFolderSelection: state.toggleFolderSelection,
      toggleFileSelection: state.toggleFileSelection,
      toggleFolderExpanded: state.toggleFolderExpanded,
      selectAllFolders: state.selectAllFolders,
      deselectAllFolders: state.deselectAllFolders,
      resetFileSelection: state.resetFileSelection,
      // Shift-click range selection actions
      setLastClickedFile: state.setLastClickedFile,
      selectFileRange: state.selectFileRange,
      clearLastClickedFile: state.clearLastClickedFile
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

export const useBenchmarkStore = () =>
  useStore(
    useShallow((state) => ({
      // State
      isRunning: state.benchmarkIsRunning,
      currentPhase: state.benchmarkPhase,
      progress: state.benchmarkProgress,
      currentFile: state.benchmarkCurrentFile,
      currentFileIndex: state.benchmarkFileIndex,
      totalFiles: state.benchmarkTotalFiles,
      bytesProcessed: state.benchmarkBytesProcessed,
      totalBytes: state.benchmarkTotalBytes,
      currentSpeedMbps: state.benchmarkSpeedMbps,
      elapsedMs: state.benchmarkElapsedMs,
      estimatedRemainingMs: state.benchmarkRemainingMs,
      speedSamples: state.benchmarkSamples,
      currentResult: state.benchmarkResult,
      history: state.benchmarkHistory,
      error: state.benchmarkError,
      comparisonIds: state.benchmarkComparisonIds,
      // Actions
      startBenchmark: state.startBenchmark,
      updateProgress: state.updateBenchmarkProgress,
      addSpeedSample: state.addBenchmarkSample,
      completeBenchmark: state.completeBenchmark,
      failBenchmark: state.failBenchmark,
      cancelBenchmark: state.cancelBenchmark,
      resetBenchmark: state.resetBenchmark,
      setHistory: state.setBenchmarkHistory,
      addToHistory: state.addToBenchmarkHistory,
      removeFromHistory: state.removeFromBenchmarkHistory,
      setCurrentResult: state.setBenchmarkResult,
      toggleComparison: state.toggleBenchmarkComparison,
      clearComparison: state.clearBenchmarkComparison
    }))
  )

// ==========================================
// File Selection Hooks (for selective transfer feature)
// ==========================================

/**
 * Hook to get files grouped by folder for the current selection.
 * Returns memoized folder groups based on scanned files and drive root.
 */
export function useFileGroups(): FolderGroup[] {
  const { scannedFiles, selectedDrive } = useStore(
    useShallow((state) => ({
      scannedFiles: state.scannedFiles,
      selectedDrive: state.selectedDrive
    }))
  )

  return useMemo(() => {
    if (!selectedDrive || scannedFiles.length === 0) {
      return []
    }
    const driveRoot = selectedDrive.mountpoints[0] || ''
    return groupFilesByFolder(scannedFiles, driveRoot)
  }, [scannedFiles, selectedDrive])
}

/**
 * Hook to get the list of selected file paths for transfer.
 * Computes selected paths based on folder and file selection state.
 */
export function useSelectedFilePaths(): string[] {
  const { scannedFiles, selectedDrive, fileSelection } = useStore(
    useShallow((state) => ({
      scannedFiles: state.scannedFiles,
      selectedDrive: state.selectedDrive,
      fileSelection: state.fileSelection
    }))
  )

  return useMemo(() => {
    if (!selectedDrive || scannedFiles.length === 0) {
      return []
    }
    const driveRoot = selectedDrive.mountpoints[0] || ''
    const groups = groupFilesByFolder(scannedFiles, driveRoot)
    return getSelectedFilePaths(
      groups,
      fileSelection.selectedFolders,
      fileSelection.deselectedFiles,
      fileSelection.individuallySelectedFiles
    )
  }, [scannedFiles, selectedDrive, fileSelection])
}

/**
 * Hook to get selection statistics (selected count, total count, sizes).
 * Useful for displaying selection summary in the UI.
 */
export function useSelectionStats(): {
  selected: number
  total: number
  totalSize: number
  selectedSize: number
} {
  const { scannedFiles, selectedDrive, fileSelection } = useStore(
    useShallow((state) => ({
      scannedFiles: state.scannedFiles,
      selectedDrive: state.selectedDrive,
      fileSelection: state.fileSelection
    }))
  )

  return useMemo(() => {
    if (!selectedDrive || scannedFiles.length === 0) {
      return { selected: 0, total: 0, totalSize: 0, selectedSize: 0 }
    }
    const driveRoot = selectedDrive.mountpoints[0] || ''
    const groups = groupFilesByFolder(scannedFiles, driveRoot)
    return getSelectionStats(
      groups,
      fileSelection.selectedFolders,
      fileSelection.deselectedFiles,
      fileSelection.individuallySelectedFiles
    )
  }, [scannedFiles, selectedDrive, fileSelection])
}

/**
 * Hook to get a flat list of all files with their folder paths and indices.
 * Used for shift-click range selection.
 */
export function useFlatFileList(): Array<{ path: string; folderPath: string; index: number }> {
  const folderGroups = useFileGroups()

  return useMemo(() => {
    const list: Array<{ path: string; folderPath: string; index: number }> = []
    let index = 0
    for (const group of folderGroups) {
      for (const file of group.files) {
        list.push({ path: file.path, folderPath: group.relativePath, index: index++ })
      }
    }
    return list
  }, [folderGroups])
}

/**
 * Hook to initialize file selection with all folders selected.
 * Call this after a scan completes to select all files by default.
 */
export function useInitializeFileSelection(): () => void {
  const { scannedFiles, selectedDrive, selectAllFolders } = useStore(
    useShallow((state) => ({
      scannedFiles: state.scannedFiles,
      selectedDrive: state.selectedDrive,
      selectAllFolders: state.selectAllFolders
    }))
  )

  return useMemo(() => {
    return () => {
      if (!selectedDrive || scannedFiles.length === 0) {
        return
      }
      const driveRoot = selectedDrive.mountpoints[0] || ''
      const groups = groupFilesByFolder(scannedFiles, driveRoot)
      const allFolderPaths = getAllFolderPaths(groups)
      selectAllFolders(allFolderPaths)
    }
  }, [scannedFiles, selectedDrive, selectAllFolders])
}

// Re-export FolderGroup type for convenience
export type { FolderGroup }
