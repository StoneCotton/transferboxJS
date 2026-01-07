/**
 * Transfer Store Slice
 * Manages file transfer state and history with enhanced error tracking
 */

import type { StateCreator } from 'zustand'
import type { TransferState } from '../types'
import type {
  TransferSession,
  TransferProgress,
  FileTransferInfo,
  TransferErrorType
} from '../../../../shared/types'

export interface TransferSlice extends TransferState {
  // Existing actions
  startTransfer: (session: TransferSession) => void
  updateProgress: (progress: TransferProgress) => void
  completeTransfer: () => void
  failTransfer: (error: string, errorType?: TransferErrorType) => void
  cancelTransfer: () => void
  clearError: () => void
  setHistory: (history: TransferSession[]) => void
  addToHistory: (session: TransferSession) => void

  // NEW: Pause/Resume actions
  pauseTransfer: () => void
  resumeTransfer: () => void

  // NEW: Retry actions
  setRetryState: (fileId: string, attempt: number, error: string) => void
  clearRetryState: () => void
  retryFailedFiles: (files: FileTransferInfo[]) => Promise<void>

  // NEW: Validation actions
  startValidation: () => void
  setValidationResult: (result: {
    hasEnoughSpace: boolean
    spaceRequired: number
    spaceAvailable: number
    warnings: Array<{
      type: 'space' | 'network' | 'sanitization' | 'conflict'
      message: string
      severity: 'low' | 'medium' | 'high'
    }>
  }) => void
  clearValidation: () => void

  // System state actions
  setSystemSleeping: (sleeping: boolean) => void

  // NEW: File-level actions
  updateFileState: (fileId: string, update: Partial<FileTransferInfo>) => void
  setFileError: (fileId: string, error: string, errorType: TransferErrorType) => void
  setFileRetrying: (fileId: string, attempt: number) => void
  clearFileStates: () => void

  // NEW: Enhanced error actions
  setErrorDetails: (details: {
    type: TransferErrorType
    retryable: boolean
    affectedFiles: FileTransferInfo[]
  }) => void
  clearErrorDetails: () => void
}

export const createTransferSlice: StateCreator<TransferSlice> = (set, get) => ({
  // Initial state
  currentSession: null,
  progress: null,
  isTransferring: false,
  isPaused: false,
  error: null,
  errorDetails: null,
  history: [],
  retryState: null,
  validationState: null,
  systemState: {
    isSleeping: false
  },
  fileStates: {},

  // Existing actions
  startTransfer: (session) =>
    set({
      currentSession: session,
      progress: null,
      isTransferring: true,
      isPaused: false,
      error: null,
      errorDetails: null,
      fileStates: {}
    }),

  updateProgress: (progress) => {
    set({ progress })

    // Update file states from progress
    if (progress.activeFiles) {
      const fileStates = { ...get().fileStates }
      progress.activeFiles.forEach((file) => {
        fileStates[file.sourcePath] = {
          status: file.status as
            | 'pending'
            | 'validating'
            | 'transferring'
            | 'verifying'
            | 'retrying'
            | 'complete'
            | 'error'
            | 'skipped',
          progress: file.percentage,
          errorType: file.errorType,
          retryCount: file.retryCount || 0
        }
      })
      set({ fileStates })
    }
  },

  completeTransfer: () =>
    set((state) => ({
      isTransferring: false,
      isPaused: false,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'complete' }, ...state.history]
        : state.history,
      retryState: null,
      validationState: null
    })),

  failTransfer: (error, errorType) =>
    set((state) => ({
      isTransferring: false,
      isPaused: false,
      error,
      errorDetails: errorType
        ? {
            type: errorType,
            retryable: false, // Will be updated by setErrorDetails
            affectedFiles: [],
            timestamp: Date.now()
          }
        : null,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'error', errorMessage: error }, ...state.history]
        : state.history
    })),

  cancelTransfer: () =>
    set((state) => ({
      isTransferring: false,
      isPaused: false,
      currentSession: null,
      progress: null,
      retryState: null,
      history: state.currentSession
        ? [{ ...state.currentSession, status: 'cancelled' }, ...state.history]
        : state.history
    })),

  clearError: () => set({ error: null, errorDetails: null }),

  setHistory: (history) => set({ history }),

  addToHistory: (session) =>
    set((state) => ({
      history: [session, ...state.history]
    })),

  // NEW: Pause/Resume
  pauseTransfer: () => {
    set({ isPaused: true })
  },

  resumeTransfer: () => {
    set({ isPaused: false })
  },

  // NEW: Retry logic
  setRetryState: (fileId, attempt, error) =>
    set((state) => {
      const retryState = state.retryState || {
        isRetrying: true,
        currentAttempt: 0,
        maxAttempts: 3,
        files: {}
      }

      return {
        retryState: {
          ...retryState,
          currentAttempt: attempt,
          files: {
            ...retryState.files,
            [fileId]: { attempts: attempt, lastError: error }
          }
        }
      }
    }),

  clearRetryState: () => set({ retryState: null }),

  retryFailedFiles: async (_files) => {
    // Trigger IPC to retry files - this will be called from the UI
    set({
      retryState: {
        isRetrying: true,
        currentAttempt: 1,
        maxAttempts: 3,
        files: {}
      }
    })
  },

  // NEW: Validation
  startValidation: () =>
    set({
      validationState: {
        isValidating: true,
        hasEnoughSpace: false,
        spaceRequired: 0,
        spaceAvailable: 0,
        warnings: []
      }
    }),

  setValidationResult: (result) =>
    set({
      validationState: {
        isValidating: false,
        ...result
      }
    }),

  clearValidation: () => set({ validationState: null }),

  // System state
  setSystemSleeping: (sleeping) =>
    set((state) => ({
      systemState: { ...state.systemState, isSleeping: sleeping }
    })),

  // NEW: File-level tracking
  updateFileState: (fileId, update) =>
    set((state) => {
      const current = state.fileStates[fileId] || {
        status: 'pending' as const,
        progress: 0,
        retryCount: 0
      }
      return {
        fileStates: {
          ...state.fileStates,
          [fileId]: { ...current, ...update }
        }
      }
    }),

  setFileError: (fileId, _error, errorType) =>
    set((state) => {
      const current = state.fileStates[fileId] || {
        status: 'pending' as const,
        progress: 0,
        retryCount: 0
      }
      return {
        fileStates: {
          ...state.fileStates,
          [fileId]: {
            ...current,
            status: 'error',
            errorType
          }
        }
      }
    }),

  setFileRetrying: (fileId, attempt) =>
    set((state) => {
      const current = state.fileStates[fileId] || {
        status: 'pending' as const,
        progress: 0,
        retryCount: 0
      }
      return {
        fileStates: {
          ...state.fileStates,
          [fileId]: {
            ...current,
            status: 'retrying',
            retryCount: attempt
          }
        }
      }
    }),

  clearFileStates: () => set({ fileStates: {} }),

  // NEW: Enhanced error tracking
  setErrorDetails: (details) =>
    set({
      errorDetails: {
        ...details,
        timestamp: Date.now()
      }
    }),

  clearErrorDetails: () => set({ errorDetails: null })
})
