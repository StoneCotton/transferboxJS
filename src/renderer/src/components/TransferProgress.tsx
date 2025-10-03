/**
 * Transfer Progress Component
 */

import { CheckCircle2, XCircle, Loader2, Clock, Zap } from 'lucide-react'
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
        'border-2',
        hasError ? 'border-red-500 dark:border-red-700' : 'border-blue-500 dark:border-blue-700'
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasError ? (
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            ) : isTransferring ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            )}
            <CardTitle>
              {hasError
                ? 'Transfer Failed'
                : isTransferring
                  ? 'Transfer in Progress'
                  : 'Transfer Complete'}
            </CardTitle>
          </div>
          {isTransferring && (
            <Button variant="danger" size="sm" onClick={cancelTransfer}>
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasError ? (
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Overall Progress</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.round(percentage)}%
                </span>
              </div>
              <Progress value={percentage} size="lg" />
            </div>

            {/* Stats */}
            {progress && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {/* Files */}
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Files</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {progress.completedFiles}/{progress.totalFiles}
                  </p>
                </div>

                {/* Size */}
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-3 w-3" />
                    <span>Size</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatBytes(progress.transferredBytes)}
                  </p>
                </div>

                {/* Speed */}
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Zap className="h-3 w-3" />
                    <span>Speed</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatSpeed(progress.transferSpeed)}
                  </p>
                </div>

                {/* ETA */}
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>Remaining</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {progress.eta > 0 ? formatTime(progress.eta) : '--'}
                  </p>
                </div>
              </div>
            )}

            {/* Current File */}
            {progress?.currentFile && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs text-gray-500 dark:text-gray-400">Current File</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {progress.currentFile.fileName}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
