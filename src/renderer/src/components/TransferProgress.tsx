/**
 * Transfer Progress Component
 */

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, AlertCircle, Pause, Play } from 'lucide-react'
import { useTransferStore, useConfigStore, useStore, useDriveStore } from '../store'
import { useUiDensity } from '../hooks/useUiDensity'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Progress } from './ui/Progress'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { formatBytes, cn } from '../lib/utils'
import { useIpc } from '../hooks/useIpc'
import { playErrorSound } from '../utils/soundManager'
import { TransferErrorType } from '../../../shared/types'
import { TransferStatsGrid, ActiveFileProgress, TransferErrorDisplay } from './transfer'

export function TransferProgress() {
  const {
    isTransferring,
    isPaused,
    progress,
    error,
    cancelTransfer,
    startTransfer,
    pauseTransfer,
    resumeTransfer
  } = useTransferStore()
  const { selectedDrive } = useDriveStore()
  const { config } = useConfigStore()
  const { isCondensed } = useUiDensity()
  const ipc = useIpc()
  const [isRetrying, setIsRetrying] = useState(false)
  const [isPauseToggling, setIsPauseToggling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Get retryable failed files (network errors and drive disconnection)
  const getRetryableFiles = () => {
    if (!progress?.completedFiles) return []
    return progress.completedFiles.filter(
      (f) =>
        f.status === 'error' &&
        (f.errorType === TransferErrorType.NETWORK_ERROR ||
          f.errorType === TransferErrorType.DRIVE_DISCONNECTED)
    )
  }

  const retryableFiles = getRetryableFiles()
  const hasRetryableFiles = retryableFiles.length > 0

  // Handle retry of failed files
  const handleRetryFailedFiles = async () => {
    if (!selectedDrive || retryableFiles.length === 0) {
      useStore.getState().addToast({
        type: 'error',
        message: 'Cannot retry: drive not available or no retryable files',
        duration: 4000
      })
      return
    }

    setIsRetrying(true)
    try {
      // Prepare retry request with source and destination paths
      const filesToRetry = retryableFiles.map((f) => ({
        sourcePath: f.sourcePath,
        destinationPath: f.destinationPath
      }))

      // Call IPC to retry transfer
      await ipc.retryTransfer({
        files: filesToRetry,
        driveInfo: selectedDrive
      })

      // Start transfer state in UI
      startTransfer({
        id: `retry-${Date.now()}`,
        driveId: selectedDrive.device,
        driveName: selectedDrive.displayName,
        sourceRoot: selectedDrive.mountpoints[0] || selectedDrive.device,
        destinationRoot: config?.defaultDestination || '',
        status: 'transferring',
        startTime: Date.now(),
        endTime: null,
        fileCount: filesToRetry.length,
        totalBytes: retryableFiles.reduce((sum, f) => sum + f.fileSize, 0),
        files: []
      })

      useStore.getState().addToast({
        type: 'info',
        message: `Retrying ${filesToRetry.length} failed file${filesToRetry.length > 1 ? 's' : ''}...`,
        duration: 3000
      })
    } catch (error) {
      console.error('Failed to retry files:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry files'
      useStore.getState().addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle pause/resume toggle
  const handlePauseResume = async () => {
    setIsPauseToggling(true)
    try {
      if (isPaused) {
        await ipc.resumeTransfer()
        resumeTransfer()
      } else {
        await ipc.pauseTransfer()
        pauseTransfer()
      }
    } catch (error) {
      console.error('Failed to toggle pause:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle pause'
      useStore.getState().addToast({
        type: 'error',
        message: errorMessage,
        duration: 4000
      })
    } finally {
      setIsPauseToggling(false)
    }
  }

  // Build confirmation message with transfer progress info
  const getCancelConfirmationMessage = (): string => {
    if (!progress) {
      return 'Are you sure you want to cancel the transfer? This action cannot be undone.'
    }
    const completed = progress.completedFilesCount || 0
    const total = progress.totalFiles || 0
    const remaining = total - completed

    if (remaining <= 0) {
      return 'The transfer is almost complete. Are you sure you want to cancel?'
    }

    return `${completed} of ${total} files transferred. Cancelling will stop ${remaining} remaining file${remaining !== 1 ? 's' : ''}. This action cannot be undone.`
  }

  // Execute the actual transfer cancellation
  const executeCancelTransfer = async () => {
    setIsCancelling(true)
    try {
      // Stop the transfer via IPC
      await ipc.stopTransfer()
      // Show toast notification (logs are already created in main process)
      useStore.getState().addToast({
        type: 'warning',
        message: 'Transfer cancelled by user',
        duration: 4000
      })
      // Play error sound for cancellation
      playErrorSound()
      // Update store state
      cancelTransfer()
    } catch (error) {
      console.error('Failed to cancel transfer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transfer'
      // Show toast notification for cancellation error
      useStore.getState().addToast({
        type: 'error',
        message: `Failed to cancel transfer: ${errorMessage}`,
        duration: 5000
      })
    } finally {
      setIsCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  // Show cancel confirmation dialog
  const handleCancelTransfer = () => {
    setShowCancelConfirm(true)
  }

  // Handle closing the cancel confirmation dialog
  const handleCancelConfirmClose = () => {
    if (!isCancelling) {
      setShowCancelConfirm(false)
    }
  }

  if (!isTransferring && !error) {
    return null
  }

  const percentage = progress?.overallPercentage || 0
  const hasError = !!error

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden border-0 shadow-2xl backdrop-blur-sm',
          hasError
            ? 'bg-red-50/90 shadow-red-500/20 dark:bg-red-950/90'
            : 'bg-gradient-to-br from-brand-50/90 to-orange-50/90 shadow-brand-500/20 dark:from-brand-950/90 dark:to-orange-950/90'
        )}
      >
        {/* Animated background gradient */}
        <div
          className={cn(
            'absolute inset-0 opacity-30',
            !hasError && 'bg-gradient-to-r from-brand-400 via-orange-400 to-brand-400 animate-pulse'
          )}
        />

        <CardHeader className={cn('relative', isCondensed && 'p-3')}>
          <div className="flex items-center justify-between">
            <div className={cn('flex items-center', isCondensed ? 'gap-2' : 'gap-4')}>
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl shadow-lg',
                  isCondensed ? 'h-8 w-8' : 'h-12 w-12',
                  hasError
                    ? 'bg-red-500 text-white'
                    : isTransferring
                      ? isPaused
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                        : 'bg-gradient-to-br from-brand-500 to-orange-600 text-white'
                      : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                )}
              >
                {hasError ? (
                  <XCircle className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
                ) : isTransferring ? (
                  isPaused ? (
                    <Pause className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
                  ) : (
                    <Loader2 className={cn('animate-spin', isCondensed ? 'h-4 w-4' : 'h-6 w-6')} />
                  )
                ) : (
                  <CheckCircle2 className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
                )}
              </div>
              <div>
                <CardTitle className={isCondensed ? 'text-sm' : 'text-xl'}>
                  {hasError
                    ? 'Transfer Failed'
                    : isTransferring
                      ? isPaused
                        ? 'Transfer Paused'
                        : 'Transfer in Progress'
                      : 'Transfer Complete'}
                </CardTitle>
                {!isCondensed && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isTransferring
                      ? isPaused
                        ? 'Transfer is paused - click Resume to continue'
                        : 'Please wait while files are being transferred'
                      : 'Operation completed'}
                  </p>
                )}
              </div>
            </div>
            {isTransferring && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size={isCondensed ? 'xs' : 'sm'}
                  onClick={handlePauseResume}
                  disabled={isPauseToggling}
                  className={cn(
                    'transition-colors',
                    isPaused
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                >
                  {isPauseToggling ? (
                    <Loader2 className={cn('animate-spin', isCondensed ? 'h-3 w-3' : 'h-4 w-4')} />
                  ) : isPaused ? (
                    <>
                      <Play
                        className={cn(isCondensed ? 'h-3 w-3' : 'h-4 w-4', !isCondensed && 'mr-1')}
                      />
                      {!isCondensed && 'Resume'}
                    </>
                  ) : (
                    <>
                      <Pause
                        className={cn(isCondensed ? 'h-3 w-3' : 'h-4 w-4', !isCondensed && 'mr-1')}
                      />
                      {!isCondensed && 'Pause'}
                    </>
                  )}
                </Button>
                <Button
                  variant="danger"
                  size={isCondensed ? 'xs' : 'sm'}
                  onClick={handleCancelTransfer}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  {isCondensed ? 'Cancel' : 'Cancel Transfer'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn('relative', isCondensed && 'p-3 pt-0')}>
          {hasError ? (
            <TransferErrorDisplay
              error={error}
              completedFiles={progress?.completedFiles}
              isCondensed={isCondensed}
              hasRetryableFiles={hasRetryableFiles}
              retryableFilesCount={retryableFiles.length}
              isRetrying={isRetrying}
              canRetry={!!selectedDrive && !isTransferring}
              onRetry={handleRetryFailedFiles}
            />
          ) : (
            <div className={isCondensed ? 'space-y-3' : 'space-y-6'}>
              {/* Stats Grid */}
              {progress && (
                <TransferStatsGrid
                  progress={progress}
                  unitSystem={config.unitSystem}
                  isCondensed={isCondensed}
                />
              )}

              {/* Overall Progress Bar */}
              <div>
                <div
                  className={cn('flex items-center justify-between', isCondensed ? 'mb-1' : 'mb-3')}
                >
                  <div>
                    <span
                      className={cn(
                        'font-semibold text-gray-700 dark:text-gray-300',
                        isCondensed ? 'text-xs' : 'text-sm'
                      )}
                    >
                      Overall Progress
                    </span>
                    {!isCondensed && progress && (
                      <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {formatBytes(progress.transferredBytes, config?.unitSystem || 'decimal')} of{' '}
                        {formatBytes(progress.totalBytes, config?.unitSystem || 'decimal')}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'font-black text-brand-600 dark:text-brand-400',
                      isCondensed ? 'text-base' : 'text-2xl'
                    )}
                  >
                    {Math.round(percentage)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={percentage}
                    size={isCondensed ? 'md' : 'lg'}
                    className={isCondensed ? 'h-2' : 'h-4'}
                  />
                </div>
              </div>

              {/* Active Files Progress Bars */}
              {progress?.activeFiles && progress.activeFiles.length > 0 && (
                <ActiveFileProgress
                  activeFiles={progress.activeFiles}
                  unitSystem={config?.unitSystem || 'decimal'}
                  isCondensed={isCondensed}
                />
              )}

              {/* Large File Warning */}
              {progress?.activeFiles &&
                progress.activeFiles.some((file) => file.fileSize > 1024 * 1024 * 1024) && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Large file detected - progress updates may be less frequent to maintain
                      performance
                    </span>
                  </div>
                )}

              {/* Fallback: Current File Progress Bar (for backward compatibility) */}
              {progress?.currentFile &&
                (!progress.activeFiles || progress.activeFiles.length === 0) && (
                  <div className="rounded-xl border-2 border-brand-300 bg-white/90 p-4 dark:border-brand-700 dark:bg-gray-900/90">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                          {progress.currentFile.status === 'verifying'
                            ? 'Verifying Checksum'
                            : 'Transferring File'}
                        </span>
                      </div>
                      <span className="text-lg font-black text-brand-900 dark:text-brand-100">
                        {Math.round(progress.currentFile.percentage || 0)}%
                      </span>
                    </div>
                    <div className="relative mb-3">
                      <Progress
                        value={progress.currentFile.percentage || 0}
                        size="md"
                        className={cn(
                          'h-3',
                          progress.currentFile.status === 'verifying' && 'animate-pulse'
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                        {progress.currentFile.fileName}
                      </p>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {formatBytes(progress.currentFile.bytesTransferred, config.unitSystem)} /{' '}
                        {formatBytes(progress.currentFile.fileSize, config.unitSystem)}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Transfer Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={handleCancelConfirmClose}
        onConfirm={executeCancelTransfer}
        title="Cancel Transfer?"
        message={getCancelConfirmationMessage()}
        confirmText="Cancel Transfer"
        cancelText="Continue Transfer"
        variant="danger"
        isLoading={isCancelling}
      />
    </>
  )
}
