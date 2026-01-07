/**
 * Transfer Event Handlers Hook
 * Handles transfer progress, completion, errors, and pause/resume events
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'
import { playErrorSound, playSuccessSound } from '../utils/soundManager'
import { TransferErrorType } from '../../../shared/types'

/**
 * Helper function to determine if an error type is retryable
 */
function isErrorRetryable(errorType: TransferErrorType): boolean {
  return errorType === TransferErrorType.NETWORK_ERROR
}

/**
 * Hook to handle transfer-related events
 */
export function useTransferEvents(): void {
  const ipc = useIpc()

  useEffect(() => {
    const unsubTransferProgress = ipc.onTransferProgress((progress) => {
      const store = useStore.getState()
      store.updateProgress(progress)

      // Track file-level errors from completed files
      if (progress.completedFiles) {
        progress.completedFiles.forEach((file) => {
          if (file.status === 'error' && file.errorType) {
            store.setFileError(file.sourcePath, file.error || 'Unknown error', file.errorType)

            // Add to error list if critical
            if (
              [
                TransferErrorType.INSUFFICIENT_SPACE,
                TransferErrorType.DRIVE_DISCONNECTED,
                TransferErrorType.PERMISSION_DENIED
              ].includes(file.errorType)
            ) {
              store.addTransferError(file.error || 'Transfer error', file.errorType, {
                filename: file.fileName,
                path: file.sourcePath
              })
            }
          }
        })
      }
    })

    const unsubTransferComplete = ipc.onTransferComplete((data) => {
      console.log('[useTransferEvents] Transfer complete:', data)
      const store = useStore.getState()
      store.completeTransfer()

      if (data.status === 'complete') {
        const fileCount = store.progress?.totalFiles || 0
        store.addToast({
          type: 'success',
          message: `Transfer completed successfully${fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''}`,
          duration: 5000
        })
        console.log('[SoundManager] Transfer completed successfully - playing success sound')
        playSuccessSound()
      } else {
        const failedCount = store.progress?.failedFiles || 0
        store.addToast({
          type: 'error',
          message: `Transfer completed with errors${failedCount > 0 ? ` (${failedCount} file${failedCount === 1 ? '' : 's'} failed)` : ''}`,
          duration: 6000
        })
        console.log('[SoundManager] Transfer completed with errors - playing error sound')
        playErrorSound()
      }

      // In auto modes, after transfer completes, go back to waiting for new drives
      const config = store.config
      if (config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer') {
        console.log(`[${config.transferMode}] Transfer complete - ready for next drive`)
        store.selectDrive(null)
        store.clearScan()
      }
    })

    const unsubTransferError = ipc.onTransferError((error) => {
      console.error('[useTransferEvents] Transfer error:', error)
      const store = useStore.getState()

      const errorType = error.type
      store.failTransfer(error.message, errorType)

      store.setErrorDetails({
        type: errorType,
        retryable: isErrorRetryable(errorType),
        affectedFiles: []
      })

      store.addToast({
        type: 'error',
        message: `Transfer failed: ${error.message}`,
        duration: 6000
      })

      console.log('[SoundManager] Transfer failed - playing error sound')
      playErrorSound()
    })

    const unsubTransferPaused = ipc.onTransferPaused(() => {
      console.log('[useTransferEvents] Transfer paused')
      const store = useStore.getState()
      store.pauseTransfer()
      store.addToast({
        type: 'info',
        message: 'Transfer paused',
        duration: 3000
      })
    })

    const unsubTransferResumed = ipc.onTransferResumed(() => {
      console.log('[useTransferEvents] Transfer resumed')
      const store = useStore.getState()
      store.resumeTransfer()
      store.addToast({
        type: 'info',
        message: 'Transfer resumed',
        duration: 3000
      })
    })

    return () => {
      unsubTransferProgress()
      unsubTransferComplete()
      unsubTransferError()
      unsubTransferPaused()
      unsubTransferResumed()
    }
  }, [ipc])
}
