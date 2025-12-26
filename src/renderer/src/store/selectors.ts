/**
 * Store Selectors
 * Reusable selectors for complex state queries
 */

import { useStore } from './index'

// Transfer selectors
export const useIsTransferActive = (): boolean =>
  useStore((state) => state.isTransferring && !state.isPaused)

export const useIsTransferPaused = (): boolean => useStore((state) => state.isPaused)

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
