/**
 * Store Selectors
 * Reusable selectors for complex state queries
 */

import { useStore } from './index'
import { TransferErrorType } from '../../../shared/types'

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

/**
 * Get all failed files from the current transfer
 * Used for retry functionality and failed files list display
 */
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

/**
 * Get files that failed with retryable errors (network, disconnect)
 * Used for "Retry Failed Files" functionality
 */
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

// Helper function
function isRetryableErrorType(errorType?: TransferErrorType): boolean {
  if (!errorType) return false
  // Include drive disconnection and network errors as retryable
  return (
    errorType === TransferErrorType.NETWORK_ERROR ||
    errorType === TransferErrorType.DRIVE_DISCONNECTED
  )
}
