/**
 * Transfer Store Slice
 * Manages file transfer state and history
 */

import type { StateCreator } from 'zustand'
import type { TransferState } from '../types'
import type { TransferSession, TransferProgress } from '../../../../shared/types'

export interface TransferSlice extends TransferState {
  // Actions
  startTransfer: (session: TransferSession) => void
  updateProgress: (progress: TransferProgress) => void
  completeTransfer: () => void
  failTransfer: (error: string) => void
  cancelTransfer: () => void
  clearError: () => void
  setHistory: (history: TransferSession[]) => void
  addToHistory: (session: TransferSession) => void
}

export const createTransferSlice: StateCreator<TransferSlice> = (set) => ({
  // Initial state
  currentSession: null,
  progress: null,
  isTransferring: false,
  error: null,
  history: [],

  // Actions
  startTransfer: (session) =>
    set({
      currentSession: session,
      progress: null,
      isTransferring: true,
      error: null
    }),

  updateProgress: (progress) => set({ progress }),

  completeTransfer: () =>
    set((state) => ({
      isTransferring: false,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'complete' }, ...state.history]
        : state.history
    })),

  failTransfer: (error) =>
    set((state) => ({
      isTransferring: false,
      error,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'error', errorMessage: error }, ...state.history]
        : state.history
    })),

  cancelTransfer: () =>
    set((state) => ({
      isTransferring: false,
      currentSession: null,
      progress: null,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'cancelled' }, ...state.history]
        : state.history
    })),

  clearError: () => set({ error: null }),

  setHistory: (history) => set({ history }),

  addToHistory: (session) =>
    set((state) => ({
      history: [session, ...state.history]
    }))
})
