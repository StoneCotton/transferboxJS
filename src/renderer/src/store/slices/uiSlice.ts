/**
 * UI Store Slice
 * Manages UI state, modals, toasts, and panels
 */

import type { StateCreator } from 'zustand'
import type { UIState } from '../types'

export interface UISlice extends UIState {
  // Existing actions
  setSelectedDestination: (destination: string | null) => void
  setIsSelectingDestination: (isSelecting: boolean) => void
  toggleSettings: () => void
  toggleLogs: () => void
  toggleHistory: () => void
  closeAllModals: () => void

  // NEW: Modal management
  openModal: (modal: keyof UIState['modals']) => void
  closeModal: (modal: keyof UIState['modals']) => void

  // NEW: Toast management
  addToast: (toast: Omit<UIState['toasts'][0], 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // NEW: Loading state management
  setLoading: (key: keyof UIState['loadingStates'], loading: boolean) => void

  // NEW: Panel management
  togglePanel: (panel: keyof UIState['panels']) => void
  closeAllPanels: () => void
}

export const createUISlice: StateCreator<UISlice> = (set, get) => ({
  // Initial state
  selectedDestination: null,
  isSelectingDestination: false,
  showSettings: false,
  showLogs: false,
  showHistory: false,

  // NEW: Modals
  modals: {
    confirmTransfer: false,
    retryFailedFiles: false,
    insufficientSpace: false,
    networkWarning: false,
    fileConflicts: false,
    sanitizationWarning: false
  },

  // NEW: Toasts
  toasts: [],

  // NEW: Loading states
  loadingStates: {
    validating: false,
    scanning: false,
    transferring: false,
    retrying: false
  },

  // NEW: Panels
  panels: {
    errorDetails: false,
    fileList: false,
    retryQueue: false
  },

  // Existing actions
  setSelectedDestination: (destination) => set({ selectedDestination: destination }),

  setIsSelectingDestination: (isSelecting) => set({ isSelectingDestination: isSelecting }),

  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  toggleLogs: () => set((state) => ({ showLogs: !state.showLogs })),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

  closeAllModals: () =>
    set({
      showSettings: false,
      showLogs: false,
      showHistory: false,
      modals: {
        confirmTransfer: false,
        retryFailedFiles: false,
        insufficientSpace: false,
        networkWarning: false,
        fileConflicts: false,
        sanitizationWarning: false
      }
    }),

  // NEW: Modal management
  openModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: true }
    })),

  closeModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: false }
    })),

  // NEW: Toast management
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`
    const newToast = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, newToast]
    }))

    // Auto-remove toast after duration
    if (toast.duration) {
      setTimeout(() => {
        get().removeToast(id)
      }, toast.duration)
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),

  clearToasts: () => set({ toasts: [] }),

  // NEW: Loading state management
  setLoading: (key, loading) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [key]: loading }
    })),

  // NEW: Panel management
  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] }
    })),

  closeAllPanels: () =>
    set({
      panels: {
        errorDetails: false,
        fileList: false,
        retryQueue: false
      }
    })
})
