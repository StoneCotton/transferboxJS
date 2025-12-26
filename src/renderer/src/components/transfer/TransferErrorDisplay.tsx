/**
 * Transfer Error Display Component
 * Shows error details and failed files list
 */

import { XCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import type { FileTransferInfo } from '../../../../shared/types'

export interface TransferErrorDisplayProps {
  error: string
  completedFiles?: FileTransferInfo[]
  isCondensed: boolean
  hasRetryableFiles: boolean
  retryableFilesCount: number
  isRetrying: boolean
  canRetry: boolean
  onRetry: () => void
}

export function TransferErrorDisplay({
  error,
  completedFiles,
  isCondensed,
  hasRetryableFiles,
  retryableFilesCount,
  isRetrying,
  canRetry,
  onRetry
}: TransferErrorDisplayProps): React.ReactElement {
  const failedFiles = completedFiles?.filter((f) => f.status === 'error') || []

  return (
    <div className={isCondensed ? 'space-y-2' : 'space-y-4'}>
      {/* Error Message */}
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
      {failedFiles.length > 0 && (
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
            Failed Files ({failedFiles.length})
          </h4>
          <div
            className={cn(
              'overflow-y-auto',
              isCondensed ? 'max-h-32 space-y-1' : 'max-h-60 space-y-2'
            )}
          >
            {failedFiles.map((file) => (
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
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{file.error}</p>
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

      {/* Retry Button for retryable errors */}
      {hasRetryableFiles && canRetry && (
        <div className={cn('flex justify-center', isCondensed ? 'pt-2' : 'pt-4')}>
          <Button
            variant="primary"
            size={isCondensed ? 'sm' : 'md'}
            onClick={onRetry}
            disabled={isRetrying}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
          >
            {isRetrying ? (
              <>
                <Loader2 className={cn('mr-2 animate-spin', isCondensed ? 'h-3 w-3' : 'h-4 w-4')} />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className={cn('mr-2', isCondensed ? 'h-3 w-3' : 'h-4 w-4')} />
                Retry {retryableFilesCount} Failed File{retryableFilesCount > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
