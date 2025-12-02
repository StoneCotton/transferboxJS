/**
 * UI Store Slice
 * Manages UI state, toasts, and notification history
 */

import type { StateCreator } from 'zustand'
import type { UIState } from '../types'

export interface UISlice extends UIState {
  // Destination selection
  setSelectedDestination: (destination: string | null) => void
  setIsSelectingDestination: (isSelecting: boolean) => void

  // Modal toggles
  toggleSettings: () => void
  toggleLogs: () => void
  toggleHistory: () => void
  closeAllModals: () => void

  // Toast management
  addToast: (toast: Omit<UIState['toasts'][0], 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // Notification history management
  addNotificationToHistory: (
    notification: Omit<UIState['notificationHistory'][0], 'id' | 'timestamp'>
  ) => void
  clearNotificationHistory: () => void
}

export const createUISlice: StateCreator<UISlice> = (set, get) => ({
  // Initial state
  selectedDestination: null,
  isSelectingDestination: false,
  showSettings: false,
  showLogs: false,
  showHistory: false,

  // Toasts
  toasts: [],

  // Notification history
  notificationHistory: [],

  // Destination selection actions
  setSelectedDestination: (destination) => set({ selectedDestination: destination }),

  setIsSelectingDestination: (isSelecting) => set({ isSelectingDestination: isSelecting }),

  // Modal toggle actions
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  toggleLogs: () => set((state) => ({ showLogs: !state.showLogs })),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

  closeAllModals: () =>
    set({
      showSettings: false,
      showLogs: false,
      showHistory: false
    }),

  // Toast management actions
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`
    const newToast = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, newToast]
    }))

    // Save to notification history
    get().addNotificationToHistory({
      type: toast.type,
      message: toast.message,
      duration: toast.duration
    })

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

  // Notification history management actions
  addNotificationToHistory: (notification) => {
    const id = `${Date.now()}-${Math.random()}`
    const timestamp = Date.now()

    set((state) => ({
      notificationHistory: [
        {
          id,
          timestamp,
          ...notification
        },
        ...state.notificationHistory
      ].slice(0, 1000) // Keep last 1000 notifications
    }))
  },

  clearNotificationHistory: () => set({ notificationHistory: [] })
})
