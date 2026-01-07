/**
 * Error State Slice
 * Dedicated error management for the application
 */

import type { StateCreator } from 'zustand'
import type { TransferErrorType } from '../../../../shared/types'

export interface ErrorInfo {
  id: string
  message: string
  errorType: TransferErrorType
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
  context?: Record<string, unknown>
  dismissed: boolean
  actions?: Array<{
    label: string
    action: () => unknown
  }>
}

export interface ErrorState {
  errors: ErrorInfo[]
  criticalError: ErrorInfo | null
  dismissedErrors: string[]
}

export interface ErrorSlice extends ErrorState {
  addError: (error: Omit<ErrorInfo, 'id' | 'timestamp' | 'dismissed'>) => void
  dismissError: (id: string) => void
  clearError: (id: string) => void
  clearAllErrors: () => void
  setCriticalError: (error: ErrorInfo | null) => void

  // Helper to create errors with context
  addTransferError: (
    message: string,
    errorType: TransferErrorType,
    fileInfo?: { filename: string; path: string }
  ) => void
}

export const createErrorSlice: StateCreator<ErrorSlice> = (set, get) => ({
  errors: [],
  criticalError: null,
  dismissedErrors: [],

  addError: (error) => {
    const id = `${Date.now()}-${Math.random()}`
    const newError: ErrorInfo = {
      ...error,
      id,
      timestamp: Date.now(),
      dismissed: false
    }

    set((state) => ({
      errors: [...state.errors, newError]
    }))

    // Auto-dismiss low severity errors after 5 seconds
    if (error.severity === 'low') {
      setTimeout(() => {
        get().dismissError(id)
      }, 5000)
    }
  },

  dismissError: (id) =>
    set((state) => ({
      errors: state.errors.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
      dismissedErrors: state.dismissedErrors.includes(id)
        ? state.dismissedErrors
        : [...state.dismissedErrors, id]
    })),

  clearError: (id) =>
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id)
    })),

  clearAllErrors: () =>
    set({
      errors: [],
      dismissedErrors: []
    }),

  setCriticalError: (error) => set({ criticalError: error }),

  addTransferError: (message, errorType, fileInfo) => {
    const severity =
      errorType === 'INSUFFICIENT_SPACE' || errorType === 'DRIVE_DISCONNECTED'
        ? 'critical'
        : errorType === 'PERMISSION_DENIED'
          ? 'high'
          : errorType === 'CHECKSUM_MISMATCH'
            ? 'medium'
            : 'low'

    get().addError({
      message,
      errorType,
      severity,
      context: fileInfo
    })
  }
})
