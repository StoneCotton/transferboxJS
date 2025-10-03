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
          : 'bg-gradient-to-br from-blue-50/90 to-indigo-50/90 shadow-blue-500/20 dark:from-blue-950/90 dark:to-indigo-950/90'
      )}
    >
      {/* Animated background gradient */}
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          !hasError && 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-pulse'
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
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
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
            {/* Progress Bar */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Overall Progress
                </span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {Math.round(percentage)}%
                </span>
              </div>
              <div className="relative">
                <Progress value={percentage} size="lg" className="h-4" />
              </div>
            </div>

            {/* Stats Grid */}
            {progress && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {/* Files */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 p-4 shadow-lg dark:from-blue-900/30 dark:to-blue-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <FileCheck className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      <FileCheck className="h-4 w-4" />
                      <span>Files</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">
                      {progress.completedFiles}/{progress.totalFiles}
                    </p>
                  </div>
                </div>

                {/* Size */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 p-4 shadow-lg dark:from-indigo-900/30 dark:to-indigo-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <HardDriveDownload className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <HardDriveDownload className="h-4 w-4" />
                      <span>Transferred</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-indigo-900 dark:text-indigo-100">
                      {formatBytes(progress.transferredBytes)}
                    </p>
                  </div>
                </div>

                {/* Speed */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 p-4 shadow-lg dark:from-purple-900/30 dark:to-purple-950/30">
                  <div className="absolute right-2 top-2 opacity-10">
                    <Zap className="h-12 w-12" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                      <Zap className="h-4 w-4" />
                      <span>Speed</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-purple-900 dark:text-purple-100">
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

            {/* Current File */}
            {progress?.currentFile && (
              <div className="rounded-xl border-2 border-blue-300 bg-white/90 p-4 dark:border-blue-700 dark:bg-gray-900/90">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                      Current File
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">
                      {progress.currentFile.fileName}
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
