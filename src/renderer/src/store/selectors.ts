/**
 * Store Selectors
 * Reusable selectors for complex state queries
 */

import { useStore } from './index'
import { TransferErrorType } from '../../../shared/types'
import type { ErrorInfo } from './slices/errorSlice'

// Transfer selectors
export const useIsTransferActive = (): boolean =>
  useStore((state) => state.isTransferring && !state.isPaused)

export const useIsTransferPaused = (): boolean => useStore((state) => state.isPaused)

export const useHasRetryableErrors = (): boolean =>
  useStore((state) => {
    if (state.errorDetails?.retryable) {
      return true
    }

    // Check file states for retryable errors
    return Array.from(state.fileStates.values()).some(
      (f) => f.status === 'error' && isRetryableErrorType(f.errorType)
    )
  })

export const useFailedFiles = (): Array<{
  path: string
  error: string
  errorType?: TransferErrorType
}> =>
  useStore((state) => {
    const failed: Array<{ path: string; error: string; errorType?: TransferErrorType }> = []

    state.fileStates.forEach((fileState, path) => {
      if (fileState.status === 'error') {
        failed.push({
          path,
          error: 'Transfer failed',
          errorType: fileState.errorType
        })
      }
    })

    return failed
  })

export const useRetryableFiles = (): Array<{
  path: string
  error: string
  errorType?: TransferErrorType
}> => {
  const failedFiles = useFailedFiles()
  return failedFiles.filter((f) => isRetryableErrorType(f.errorType))
}

export const useTransferStatistics = (): {
  total: number
  completed: number
  failed: number
  skipped: number
  inProgress: number
  pending: number
} | null =>
  useStore((state) => {
    if (!state.progress) return null

    return {
      total: state.progress.totalFiles,
      completed: state.progress.completedFilesCount,
      failed: state.progress.failedFiles,
      skipped: state.progress.skippedFiles,
      inProgress: state.progress.activeFiles.length,
      pending:
        state.progress.totalFiles - state.progress.completedFilesCount - state.progress.failedFiles
    }
  })

export const useHasSpaceWarning = (): boolean =>
  useStore((state) => !!(state.validationState && !state.validationState.hasEnoughSpace))

export const useHasNetworkWarning = (): boolean =>
  useStore((state) => state.systemState.isNetworkDestination)

export const useCriticalErrors = (): ErrorInfo[] =>
  useStore((state) => state.errors?.filter((e) => e.severity === 'critical' && !e.dismissed) || [])

// UI selectors
export const useActiveModals = (): string[] =>
  useStore((state) => {
    if (!state.modals) return []
    return Object.entries(state.modals)
      .filter(([, isOpen]) => isOpen)
      .map(([name]) => name)
  })

export const useVisibleToasts = (): Array<{
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  duration?: number
}> => useStore((state) => state.toasts || [])

export const useIsAnyModalOpen = (): boolean =>
  useStore((state) => {
    if (!state.modals) return false
    return Object.values(state.modals).some(Boolean)
  })

// Helper function
function isRetryableErrorType(errorType?: TransferErrorType): boolean {
  if (!errorType) return false
  return errorType === TransferErrorType.NETWORK_ERROR
}
