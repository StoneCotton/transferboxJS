/**
 * Drive Store Slice
 * Manages drive detection and scanning state
 */

import type { StateCreator } from 'zustand'
import type { DriveState } from '../types'
import type { DriveInfo, ScannedFile } from '../../../../shared/types'

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
  setScanInProgress: (inProgress: boolean) => void
  setScanError: (error: string | null) => void
  clearScan: () => void
  // New actions for existing drive handling
  setExistingDrives: (drives: DriveInfo[]) => void
  isExistingDrive: (device: string) => boolean
  // Mount status actions
  markDriveAsUnmounted: (device: string) => void
  isDriveUnmounted: (device: string) => boolean
}

export const createDriveSlice: StateCreator<DriveSlice> = (set, get) => ({
  // Initial state
  detectedDrives: [],
  selectedDrive: null,
  scannedFiles: [],
  scanInProgress: false,
  scanError: null,
  existingDrives: new Set<string>(), // Track drives that were present at startup
  unmountedDrives: [], // Track drives that are unmounted but still connected

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
      // Remove drive from all tracking when it's physically disconnected
      const newExistingDrives = new Set(state.existingDrives)
      newExistingDrives.delete(device)

      // Check if there's an active transfer - don't clear scannedFiles during transfer
      // This allows retry logic to work and keeps the queue visible to users
      const isTransferring = (state as DriveSlice & CrossSliceState).isTransferring || false

      return {
        detectedDrives: state.detectedDrives.filter((d) => d.device !== device),
        existingDrives: newExistingDrives,
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

  isExistingDrive: (device) => get().existingDrives.has(device),

  // Mount status actions
  markDriveAsUnmounted: (device) =>
    set((state) => {
      console.log('[driveSlice] markDriveAsUnmounted called with device:', device)
      console.log('[driveSlice] Current state.unmountedDrives:', state.unmountedDrives)

      // Only add if not already in the array
      if (state.unmountedDrives.includes(device)) {
        console.log('[driveSlice] Device already unmounted, skipping')
        return state
      }

      // Check if there's an active transfer - don't clear scannedFiles during transfer
      // This allows retry logic to work and keeps the queue visible to users
      const isTransferring = (state as DriveSlice & CrossSliceState).isTransferring || false

      const update = {
        unmountedDrives: [...state.unmountedDrives, device],
        // Deselect the drive when it's unmounted
        selectedDrive: state.selectedDrive?.device === device ? null : state.selectedDrive,
        // Only clear scan data if NOT transferring - preserve queue during retry
        scannedFiles:
          state.selectedDrive?.device === device && !isTransferring ? [] : state.scannedFiles
      }

      console.log('[driveSlice] Returning update with unmountedDrives:', update.unmountedDrives)
      console.log(
        '[driveSlice] isTransferring:',
        isTransferring,
        'scannedFiles preserved:',
        state.selectedDrive?.device === device && isTransferring
      )

      return update
    }),

  isDriveUnmounted: (device) => {
    const result = get().unmountedDrives.includes(device)
    console.log('[driveSlice] isDriveUnmounted called for:', device, 'result:', result)
    return result
  }
})
