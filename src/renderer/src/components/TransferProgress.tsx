/**
 * Transfer Progress Component
 */

import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  FileCheck,
  HardDriveDownload,
  AlertCircle
} from 'lucide-react'
import { useTransferStore, useConfigStore, useStore } from '../store'
import { useUiDensity } from '../hooks/useUiDensity'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Progress } from './ui/Progress'
import { Button } from './ui/Button'
import {
  formatBytes,
  formatSpeed,
  formatTime,
  formatDuration,
  formatRemainingTime,
  cn
} from '../lib/utils'
import { useIpc } from '../hooks/useIpc'
import { playErrorSound } from '../utils/soundManager'

export function TransferProgress() {
  const { isTransferring, progress, error, cancelTransfer } = useTransferStore()
  const { config } = useConfigStore()
  const { isCondensed } = useUiDensity()
  const ipc = useIpc()

  // Handle transfer cancellation
  const handleCancelTransfer = async () => {
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
      console.log('[SoundManager] Transfer cancelled - playing error sound')
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
    }
  }

  if (!isTransferring && !error) {
    return null
  }

  const percentage = progress?.overallPercentage || 0
  const hasError = !!error

  return (
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
                    ? 'bg-gradient-to-br from-brand-500 to-orange-600 text-white'
                    : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
              )}
            >
              {hasError ? (
                <XCircle className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
              ) : isTransferring ? (
                <Loader2 className={cn('animate-spin', isCondensed ? 'h-4 w-4' : 'h-6 w-6')} />
              ) : (
                <CheckCircle2 className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
              )}
            </div>
            <div>
              <CardTitle className={isCondensed ? 'text-sm' : 'text-xl'}>
                {hasError
                  ? 'Transfer Failed'
                  : isTransferring
                    ? 'Transfer in Progress'
                    : 'Transfer Complete'}
              </CardTitle>
              {!isCondensed && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isTransferring
                    ? 'Please wait while files are being transferred'
                    : 'Operation completed'}
                </p>
              )}
            </div>
          </div>
          {isTransferring && (
            <Button
              variant="danger"
              size={isCondensed ? 'xs' : 'sm'}
              onClick={handleCancelTransfer}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isCondensed ? 'Cancel' : 'Cancel Transfer'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('relative', isCondensed && 'p-3 pt-0')}>
        {hasError ? (
          <div className={isCondensed ? 'space-y-2' : 'space-y-4'}>
            <div
              className={cn(
                'rounded-xl border-2 border-red-400 bg-red-100 dark:border-red-600 dark:bg-red-900/50',
                isCondensed ? 'p-3' : 'p-6'
              )}
            >
              <div className={cn('flex items-start', isCondensed ? 'gap-2' : 'gap-3')}>
                <XCircle
                  className={cn(
                    'flex-shrink-0 text-red-600 dark:text-red-400',
                    isCondensed ? 'h-4 w-4' : 'h-6 w-6'
                  )}
                />
                <div>
                  <p
                    className={cn(
                      'font-bold text-red-900 dark:text-red-100',
                      isCondensed ? 'text-sm' : 'text-base'
                    )}
                  >
                    Error Occurred
                  </p>
                  <p
                    className={cn(
                      'text-red-700 dark:text-red-300',
                      isCondensed ? 'text-xs' : 'mt-1 text-sm'
                    )}
                  >
                    {error}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Failed Files List */}
            {progress &&
              progress.completedFiles &&
              progress.completedFiles.some((f) => f.status === 'error') && (
                <div
                  className={cn(
                    'rounded-xl border-2 border-red-300 bg-white dark:border-red-700 dark:bg-gray-900',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  <h4
                    className={cn(
                      'font-semibold text-gray-900 dark:text-white',
                      isCondensed ? 'mb-2 text-xs' : 'mb-3 text-sm'
                    )}
                  >
                    Failed Files (
                    {progress.completedFiles.filter((f) => f.status === 'error').length})
                  </h4>
                  <div
                    className={cn(
                      'overflow-y-auto',
                      isCondensed ? 'max-h-32 space-y-1' : 'max-h-60 space-y-2'
                    )}
                  >
                    {progress.completedFiles
                      .filter((f) => f.status === 'error')
                      .map((file) => (
                        <div
                          key={file.sourcePath}
                          className={cn(
                            'rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50',
                            isCondensed ? 'p-2' : 'p-3'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                'truncate font-medium text-gray-900 dark:text-white',
                                isCondensed ? 'text-xs' : 'text-sm'
                              )}
                            >
                              {file.fileName}
                            </span>
                            {file.errorType && (
                              <span
                                className={cn(
                                  'ml-2 rounded-full bg-red-200 font-bold text-red-800 dark:bg-red-900 dark:text-red-200',
                                  isCondensed ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
                                )}
                              >
                                {file.errorType}
                              </span>
                            )}
                          </div>
                          {!isCondensed && file.error && (
                            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                              {file.error}
                            </p>
                          )}
                          {!isCondensed && file.retryCount && file.retryCount > 0 && (
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              Retried {file.retryCount} time{file.retryCount > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <div className={isCondensed ? 'space-y-3' : 'space-y-6'}>
            {/* Stats Grid */}
            {progress && (
              <div
                className={cn(
                  'grid',
                  isCondensed
                    ? 'grid-cols-3 gap-2 md:grid-cols-5'
                    : 'grid-cols-2 gap-4 md:grid-cols-5'
                )}
              >
                {/* Files */}
                <div
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 shadow-lg dark:from-brand-900/30 dark:to-brand-950/30',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  {!isCondensed && (
                    <div className="absolute right-2 top-2 opacity-10">
                      <FileCheck className="h-12 w-12" />
                    </div>
                  )}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center font-semibold text-brand-600 dark:text-brand-400',
                        isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
                      )}
                    >
                      <FileCheck className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
                      <span>Files</span>
                    </div>
                    <p
                      className={cn(
                        'font-black text-brand-900 dark:text-brand-100',
                        isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
                      )}
                    >
                      {progress.completedFilesCount}/{progress.totalFiles}
                    </p>
                  </div>
                </div>

                {/* Size */}
                <div
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-lg dark:from-slate-900/30 dark:to-slate-950/30',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  {!isCondensed && (
                    <div className="absolute right-2 top-2 opacity-10">
                      <HardDriveDownload className="h-12 w-12" />
                    </div>
                  )}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center font-semibold text-slate-600 dark:text-slate-400',
                        isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
                      )}
                    >
                      <HardDriveDownload className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
                      <span>Size</span>
                    </div>
                    <p
                      className={cn(
                        'font-black text-slate-900 dark:text-slate-100',
                        isCondensed ? 'mt-1 text-xs' : 'mt-2 text-lg'
                      )}
                    >
                      {formatBytes(progress.transferredBytes, config.unitSystem)}
                    </p>
                    {!isCondensed && (
                      <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                        of {formatBytes(progress.totalBytes, config.unitSystem)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Speed */}
                <div
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 shadow-lg dark:from-orange-900/30 dark:to-orange-950/30',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  {!isCondensed && (
                    <div className="absolute right-2 top-2 opacity-10">
                      <Zap className="h-12 w-12" />
                    </div>
                  )}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center font-semibold text-orange-600 dark:text-orange-400',
                        isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
                      )}
                    >
                      <Zap className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
                      <span>Speed</span>
                    </div>
                    <p
                      className={cn(
                        'font-black text-orange-900 dark:text-orange-100',
                        isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
                      )}
                    >
                      {formatSpeed(progress.transferSpeed)}
                    </p>
                  </div>
                </div>

                {/* Elapsed Time */}
                <div
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 shadow-lg dark:from-purple-900/30 dark:to-purple-950/30',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  {!isCondensed && (
                    <div className="absolute right-2 top-2 opacity-10">
                      <Clock className="h-12 w-12" />
                    </div>
                  )}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center font-semibold text-purple-600 dark:text-purple-400',
                        isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
                      )}
                    >
                      <Clock className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
                      <span>{isCondensed ? 'Time' : 'Elapsed Time'}</span>
                    </div>
                    <p
                      className={cn(
                        'font-black text-purple-900 dark:text-purple-100',
                        isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
                      )}
                    >
                      {formatTime(progress.elapsedTime)}
                    </p>
                  </div>
                </div>

                {/* ETA */}
                <div
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-pink-50 shadow-lg dark:from-pink-900/30 dark:to-pink-950/30',
                    isCondensed ? 'p-2' : 'p-4'
                  )}
                >
                  {!isCondensed && (
                    <div className="absolute right-2 top-2 opacity-10">
                      <Clock className="h-12 w-12" />
                    </div>
                  )}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex items-center font-semibold text-pink-600 dark:text-pink-400',
                        isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
                      )}
                    >
                      <Clock className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
                      <span>{isCondensed ? 'ETA' : 'Remaining'}</span>
                    </div>
                    <p
                      className={cn(
                        'font-black text-pink-900 dark:text-pink-100',
                        isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
                      )}
                    >
                      {progress.eta > 0 ? formatTime(progress.eta) : '--'}
                    </p>
                  </div>
                </div>
              </div>
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
              <div className={isCondensed ? 'space-y-2' : 'space-y-3'}>
                <h3
                  className={cn(
                    'font-semibold text-gray-700 dark:text-gray-300',
                    isCondensed ? 'text-xs' : 'text-sm'
                  )}
                >
                  Active Transfers ({progress.activeFiles.length})
                </h3>
                {progress.activeFiles.map((file, index) => (
                  <div
                    key={`${file.sourcePath}-${index}`}
                    className={cn(
                      'rounded-xl border-2 border-brand-300 bg-white/90 dark:border-brand-700 dark:bg-gray-900/90',
                      isCondensed ? 'p-2' : 'p-4'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-between',
                        isCondensed ? 'mb-1' : 'mb-3'
                      )}
                    >
                      <div className={cn('flex items-center', isCondensed ? 'gap-1' : 'gap-2')}>
                        {file.status === 'transferring' ? (
                          <Loader2
                            className={cn(
                              'animate-spin text-brand-600 dark:text-brand-400',
                              isCondensed ? 'h-3 w-3' : 'h-4 w-4'
                            )}
                          />
                        ) : file.status === 'verifying' ? (
                          <FileCheck
                            className={cn(
                              'animate-pulse text-orange-600 dark:text-orange-400',
                              isCondensed ? 'h-3 w-3' : 'h-4 w-4'
                            )}
                          />
                        ) : (
                          <CheckCircle2
                            className={cn(
                              'text-green-600 dark:text-green-400',
                              isCondensed ? 'h-3 w-3' : 'h-4 w-4'
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            'font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400',
                            isCondensed ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          {file.status === 'verifying'
                            ? isCondensed
                              ? 'Verifying'
                              : 'Verifying Checksum'
                            : file.status === 'transferring'
                              ? isCondensed
                                ? 'Transferring'
                                : 'Transferring File'
                              : 'Completed'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            'font-black text-brand-900 dark:text-brand-100',
                            isCondensed ? 'text-sm' : 'text-lg'
                          )}
                        >
                          {Math.round(file.percentage || 0)}%
                        </span>
                        {!isCondensed && file.speed && file.speed > 0 && (
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {formatSpeed(file.speed)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={cn('relative', isCondensed ? 'mb-1' : 'mb-3')}>
                      <Progress
                        value={file.percentage || 0}
                        size={isCondensed ? 'sm' : 'md'}
                        className={cn(
                          isCondensed ? 'h-1.5' : 'h-3',
                          file.status === 'verifying' && 'animate-pulse'
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          'truncate font-bold text-gray-900 dark:text-white',
                          isCondensed ? 'text-xs' : 'text-sm'
                        )}
                      >
                        {file.fileName}
                      </p>
                      {!isCondensed && (
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {formatBytes(file.bytesTransferred, config?.unitSystem || 'decimal')} /{' '}
                          {formatBytes(file.fileSize, config?.unitSystem || 'decimal')}
                        </p>
                      )}
                    </div>

                    {/* Per-file duration and remaining time - hide in condensed mode */}
                    {!isCondensed && (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                          {file.duration !== undefined && file.duration > 0 && (
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              <span>Elapsed: {formatDuration(file.duration)}</span>
                            </div>
                          )}
                          {file.remainingTime !== undefined && file.remainingTime > 0 && (
                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                              <Clock className="h-3 w-3" />
                              <span>Remaining: {formatRemainingTime(file.remainingTime)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
  )
}
