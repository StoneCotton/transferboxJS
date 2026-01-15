/**
 * Drive Store Slice
 * Manages drive detection, scanning state, and file selection for selective transfers.
 * Supports folder-grouped file selection with individual file deselection.
 */

import type { StateCreator } from 'zustand'
import type { DriveState, FileSelectionState } from '../types'
import type { DriveInfo, ScannedFile } from '../../../../shared/types'
import { groupFilesByFolder, getAllFolderPaths } from '../../utils/fileGrouping'

// Minimal interface for cross-slice state access
interface CrossSliceState {
  isTransferring?: boolean
}

export interface DriveSlice extends DriveState {
  // Actions
  setDetectedDrives: (drives: DriveInfo[]) => void
  addDrive: (drive: DriveInfo) => void
  removeDrive: (device: string) => void
  selectDrive: (drive: DriveInfo | null) => void
  setScannedFiles: (files: ScannedFile[]) => void
  /** Sets scanned files AND initializes file selection (all files selected by default) */
  setScannedFilesWithSelection: (files: ScannedFile[], driveRoot: string) => void
  setScanInProgress: (inProgress: boolean) => void
  setScanError: (error: string | null) => void
  clearScan: () => void
  // New actions for existing drive handling
  setExistingDrives: (drives: DriveInfo[]) => void
  isExistingDrive: (device: string) => boolean
  // Mount status actions
  markDriveAsUnmounted: (device: string) => void
  isDriveUnmounted: (device: string) => boolean

  // File selection actions for selective transfer feature
  /** Toggle selection state for a folder (by relative path) */
  toggleFolderSelection: (relativePath: string) => void
  /** Toggle selection state for a single file (by absolute path) */
  toggleFileSelection: (filePath: string, folderRelativePath: string) => void
  /** Toggle expanded/collapsed state for a folder */
  toggleFolderExpanded: (relativePath: string) => void
  /** Select all folders (used after scan to select all by default) */
  selectAllFolders: (folderPaths: string[]) => void
  /** Deselect all folders */
  deselectAllFolders: () => void
  /** Reset file selection state (clear all selections) */
  resetFileSelection: () => void
}

// Initial file selection state factory
const createInitialFileSelection = (): FileSelectionState => ({
  selectedFolders: new Set<string>(),
  deselectedFiles: new Set<string>(),
  expandedFolders: new Set<string>()
})

export const createDriveSlice: StateCreator<DriveSlice> = (set, get) => ({
  // Initial state
  detectedDrives: [],
  selectedDrive: null,
  scannedFiles: [],
  scanInProgress: false,
  scanError: null,
  existingDrives: [], // Track drives that were present at startup
  unmountedDrives: [], // Track drives that are unmounted but still connected
  fileSelection: createInitialFileSelection(),

  // Actions
  setDetectedDrives: (drives) => set({ detectedDrives: drives }),

  addDrive: (drive) =>
    set((state) => {
      // Only add if not already present
      if (!state.detectedDrives.some((d) => d.device === drive.device)) {
        return { detectedDrives: [...state.detectedDrives, drive] }
      }
      return state
    }),

  removeDrive: (device) =>
    set((state) => {
      // Check if there's an active transfer - don't clear scannedFiles during transfer
      // This allows retry logic to work and keeps the queue visible to users
      const isTransferring = (state as DriveSlice & CrossSliceState).isTransferring || false

      return {
        detectedDrives: state.detectedDrives.filter((d) => d.device !== device),
        // Remove drive from all tracking when it's physically disconnected
        existingDrives: state.existingDrives.filter((d) => d !== device),
        unmountedDrives: state.unmountedDrives.filter((d) => d !== device),
        // Clear selected drive if it was removed
        selectedDrive: state.selectedDrive?.device === device ? null : state.selectedDrive,
        // Only clear scan if NOT transferring - preserve queue during retry
        scannedFiles:
          state.selectedDrive?.device === device && !isTransferring ? [] : state.scannedFiles,
        scanError:
          state.selectedDrive?.device === device && !isTransferring ? null : state.scanError
      }
    }),

  selectDrive: (drive) => set({ selectedDrive: drive }),

  setScannedFiles: (files) => set({ scannedFiles: files }),

  setScannedFilesWithSelection: (files, driveRoot) =>
    set(() => {
      // Group files by folder and select all folders by default
      const groups = groupFilesByFolder(files, driveRoot)
      const allFolderPaths = getAllFolderPaths(groups)

      return {
        scannedFiles: files,
        fileSelection: {
          selectedFolders: new Set(allFolderPaths),
          deselectedFiles: new Set(),
          expandedFolders: new Set() // Start with all collapsed for cleaner UI
        }
      }
    }),

  setScanInProgress: (inProgress) => set({ scanInProgress: inProgress }),

  setScanError: (error) => set({ scanError: error }),

  clearScan: () =>
    set({
      scannedFiles: [],
      scanInProgress: false,
      scanError: null
    }),

  // New actions for existing drive handling
  setExistingDrives: (drives) => set({ existingDrives: drives.map((d) => d.device) }),

  isExistingDrive: (device) => get().existingDrives.includes(device),

  // Mount status actions
  markDriveAsUnmounted: (device) =>
    set((state) => {
      // Only add if not already in the array
      if (state.unmountedDrives.includes(device)) {
        return state
      }

      // Check if there's an active transfer - don't clear scannedFiles during transfer
      // This allows retry logic to work and keeps the queue visible to users
      const isTransferring = (state as DriveSlice & CrossSliceState).isTransferring || false

      return {
        unmountedDrives: [...state.unmountedDrives, device],
        // Deselect the drive when it's unmounted
        selectedDrive: state.selectedDrive?.device === device ? null : state.selectedDrive,
        // Only clear scan data if NOT transferring - preserve queue during retry
        scannedFiles:
          state.selectedDrive?.device === device && !isTransferring ? [] : state.scannedFiles
      }
    }),

  isDriveUnmounted: (device) => get().unmountedDrives.includes(device),

  // File selection actions for selective transfer feature
  toggleFolderSelection: (relativePath) =>
    set((state) => {
      const newSelectedFolders = new Set(state.fileSelection.selectedFolders)
      const newDeselectedFiles = new Set(state.fileSelection.deselectedFiles)

      if (newSelectedFolders.has(relativePath)) {
        // Deselect folder
        newSelectedFolders.delete(relativePath)
      } else {
        // Select folder and clear any individually deselected files in it
        newSelectedFolders.add(relativePath)
        // Clear deselected files that belong to this folder
        // Note: We can't easily filter by folder here without knowing the files
        // The UI should handle clearing deselected files when folder is selected
      }

      return {
        fileSelection: {
          ...state.fileSelection,
          selectedFolders: newSelectedFolders,
          deselectedFiles: newDeselectedFiles
        }
      }
    }),

  toggleFileSelection: (filePath, folderRelativePath) =>
    set((state) => {
      // If folder is not selected, do nothing
      if (!state.fileSelection.selectedFolders.has(folderRelativePath)) {
        return state
      }

      const newDeselectedFiles = new Set(state.fileSelection.deselectedFiles)

      if (newDeselectedFiles.has(filePath)) {
        // Re-select the file (remove from deselected)
        newDeselectedFiles.delete(filePath)
      } else {
        // Deselect the file
        newDeselectedFiles.add(filePath)
      }

      return {
        fileSelection: {
          ...state.fileSelection,
          deselectedFiles: newDeselectedFiles
        }
      }
    }),

  toggleFolderExpanded: (relativePath) =>
    set((state) => {
      const newExpandedFolders = new Set(state.fileSelection.expandedFolders)

      if (newExpandedFolders.has(relativePath)) {
        newExpandedFolders.delete(relativePath)
      } else {
        newExpandedFolders.add(relativePath)
      }

      return {
        fileSelection: {
          ...state.fileSelection,
          expandedFolders: newExpandedFolders
        }
      }
    }),

  selectAllFolders: (folderPaths) =>
    set((state) => ({
      fileSelection: {
        selectedFolders: new Set(folderPaths),
        deselectedFiles: new Set(), // Clear individual deselections
        expandedFolders: state.fileSelection.expandedFolders // Preserve expand state
      }
    })),

  deselectAllFolders: () =>
    set((state) => ({
      fileSelection: {
        selectedFolders: new Set(),
        deselectedFiles: new Set(),
        expandedFolders: state.fileSelection.expandedFolders // Preserve expand state
      }
    })),

  resetFileSelection: () =>
    set({
      fileSelection: createInitialFileSelection()
    })
})
