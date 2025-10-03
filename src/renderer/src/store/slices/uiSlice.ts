/**
 * UI Store Slice
 * Manages UI state and modals
 */

import type { StateCreator } from 'zustand'
import type { UIState } from '../types'

export interface UISlice extends UIState {
  // Actions
  setSelectedDestination: (destination: string | null) => void
  setIsSelectingDestination: (isSelecting: boolean) => void
  toggleSettings: () => void
  toggleLogs: () => void
  toggleHistory: () => void
  closeAllModals: () => void
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  // Initial state
  selectedDestination: null,
  isSelectingDestination: false,
  showSettings: false,
  showLogs: false,
  showHistory: false,

  // Actions
  setSelectedDestination: (destination) => set({ selectedDestination: destination }),

  setIsSelectingDestination: (isSelecting) => set({ isSelectingDestination: isSelecting }),

  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  toggleLogs: () => set((state) => ({ showLogs: !state.showLogs })),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

  closeAllModals: () =>
    set({
      showSettings: false,
      showLogs: false,
      showHistory: false
    })
})
