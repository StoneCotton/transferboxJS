/**
 * Active File Progress Component
 * Displays progress bars for files currently being transferred
 */

import { Loader2, FileCheck, CheckCircle2, Clock } from 'lucide-react'
import { Progress } from '../ui/Progress'
import { formatBytes, formatSpeed, formatDuration, formatRemainingTime, cn } from '../../lib/utils'
import type { UnitSystem, FileTransferInfo } from '../../../../shared/types'

export interface ActiveFileProgressProps {
  activeFiles: FileTransferInfo[]
  unitSystem: UnitSystem
  isCondensed: boolean
}

export function ActiveFileProgress({
  activeFiles,
  unitSystem,
  isCondensed
}: ActiveFileProgressProps): React.ReactElement {
  return (
    <div className={isCondensed ? 'space-y-2' : 'space-y-3'}>
      <h3
        className={cn(
          'font-semibold text-gray-700 dark:text-gray-300',
          isCondensed ? 'text-xs' : 'text-sm'
        )}
      >
        Active Transfers ({activeFiles.length})
      </h3>
      {activeFiles.map((file, index) => (
        <div
          key={`${file.sourcePath}-${index}`}
          className={cn(
            'rounded-xl border-2 border-brand-300 bg-white/90 dark:border-brand-700 dark:bg-gray-900/90',
            isCondensed ? 'p-2' : 'p-4'
          )}
        >
          <div className={cn('flex items-center justify-between', isCondensed ? 'mb-1' : 'mb-3')}>
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
                {formatBytes(file.bytesTransferred, unitSystem)} /{' '}
                {formatBytes(file.fileSize, unitSystem)}
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
  )
}
