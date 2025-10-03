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
  HardDriveDownload
} from 'lucide-react'
import { useTransferStore } from '../store'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import { Progress } from './ui/Progress'
import { Button } from './ui/Button'
import { formatBytes, formatSpeed, formatTime, cn } from '../lib/utils'

export function TransferProgress() {
  const { isTransferring, progress, error, cancelTransfer } = useTransferStore()

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

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl shadow-lg',
                hasError
                  ? 'bg-red-500 text-white'
                  : isTransferring
                    ? 'bg-gradient-to-br from-brand-500 to-orange-600 text-white'
                    : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
              )}
            >
              {hasError ? (
                <XCircle className="h-6 w-6" />
              ) : isTransferring ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl">
                {hasError
                  ? 'Transfer Failed'
                  : isTransferring
                    ? 'Transfer in Progress'
                    : 'Transfer Complete'}
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isTransferring
                  ? 'Please wait while files are being transferred'
                  : 'Operation completed'}
              </p>
            </div>
          </div>
          {isTransferring && (
            <Button
              variant="danger"
              size="sm"
              onClick={cancelTransfer}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Cancel Transfer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative">
        {hasError ? (
          <div className="rounded-xl border-2 border-red-400 bg-red-100 p-6 dark:border-red-600 dark:bg-red-900/50">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-base font-bold text-red-900 dark:text-red-100">Error Occurred</p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Progress Bar */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Overall Progress
                  </span>
                  {progress && (
                    <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                      {formatBytes(progress.transferredBytes)} of {formatBytes(progress.totalBytes)}
                    </p>
                  )}
                </div>
                <span className="text-2xl font-black text-brand-600 dark:text-brand-400">
                  {Math.round(percentage)}%
                </span>
              </div>
              <div className="relative">
                <Progress value={percentage} size="lg" className="h-4" />
              </div>
            </div>

            {/* Current File Progress Bar */}
            {progress?.currentFile && (
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
                    {formatBytes(progress.currentFile.bytesTransferred)} /{' '}
                    {formatBytes(progress.currentFile.fileSize)}
                  </p>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            {progress && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {/* Files */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 p-4 shadow-lg dark:from-brand-900/30 dark:to-brand-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <FileCheck className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
                      <FileCheck className="h-4 w-4" />
                      <span>Files</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-brand-900 dark:text-brand-100">
                      {progress.completedFiles}/{progress.totalFiles}
                    </p>
                  </div>
                </div>

                {/* Size */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 p-4 shadow-lg dark:from-slate-900/30 dark:to-slate-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <HardDriveDownload className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <HardDriveDownload className="h-4 w-4" />
                      <span>Transferred</span>
                    </div>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                      {formatBytes(progress.transferredBytes)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      of {formatBytes(progress.totalBytes)}
                    </p>
                  </div>
                </div>

                {/* Speed */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 p-4 shadow-lg dark:from-orange-900/30 dark:to-orange-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <Zap className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      <Zap className="h-4 w-4" />
                      <span>Speed</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-orange-900 dark:text-orange-100">
                      {formatSpeed(progress.transferSpeed)}
                    </p>
                  </div>
                </div>

                {/* ETA */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-pink-50 p-4 shadow-lg dark:from-pink-900/30 dark:to-pink-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <Clock className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-pink-600 dark:text-pink-400">
                      <Clock className="h-4 w-4" />
                      <span>Remaining</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-pink-900 dark:text-pink-100">
                      {progress.eta > 0 ? formatTime(progress.eta) : '--'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
