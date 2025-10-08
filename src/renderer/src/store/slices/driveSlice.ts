/**
 * Drive Store Slice
 * Manages drive detection and scanning state
 */

import type { StateCreator } from 'zustand'
import type { DriveState } from '../types'
import type { DriveInfo } from '../../../../shared/types'

export interface DriveSlice extends DriveState {
  // Actions
  setDetectedDrives: (drives: DriveInfo[]) => void
  addDrive: (drive: DriveInfo) => void
  removeDrive: (device: string) => void
  selectDrive: (drive: DriveInfo | null) => void
  setScannedFiles: (files: string[]) => void
  setScanInProgress: (inProgress: boolean) => void
  setScanError: (error: string | null) => void
  clearScan: () => void
  // New actions for existing drive handling
  setExistingDrives: (drives: DriveInfo[]) => void
  isExistingDrive: (device: string) => boolean
}

export const createDriveSlice: StateCreator<DriveSlice> = (set, get) => ({
  // Initial state
  detectedDrives: [],
  selectedDrive: null,
  scannedFiles: [],
  scanInProgress: false,
  scanError: null,
  existingDrives: new Set<string>(), // Track drives that were present at startup

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
      // Remove drive from existing drives set when it's physically disconnected
      const newExistingDrives = new Set(state.existingDrives)
      newExistingDrives.delete(device)

      return {
        detectedDrives: state.detectedDrives.filter((d) => d.device !== device),
        existingDrives: newExistingDrives,
        // Clear selected drive if it was removed
        selectedDrive: state.selectedDrive?.device === device ? null : state.selectedDrive,
        // Clear scan if removed drive was selected
        scannedFiles: state.selectedDrive?.device === device ? [] : state.scannedFiles,
        scanError: state.selectedDrive?.device === device ? null : state.scanError
      }
    }),

  selectDrive: (drive) => set({ selectedDrive: drive }),

  setScannedFiles: (files) => set({ scannedFiles: files }),

  setScanInProgress: (inProgress) => set({ scanInProgress: inProgress }),

  setScanError: (error) => set({ scanError: error }),

  clearScan: () =>
    set({
      scannedFiles: [],
      scanInProgress: false,
      scanError: null
    }),

  // New actions for existing drive handling
  setExistingDrives: (drives) => set({ existingDrives: new Set(drives.map((d) => d.device)) }),

  isExistingDrive: (device) => get().existingDrives.has(device)
})
