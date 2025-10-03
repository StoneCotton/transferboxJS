/**
 * Status Bar Component
 */

import { CheckCircle2, Info } from 'lucide-react'
import { useDriveStore, useTransferStore, useUIStore } from '../store'
import { cn } from '../lib/utils'

export function StatusBar() {
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { isTransferring } = useTransferStore()
  const { selectedDestination } = useUIStore()

  const canTransfer = selectedDrive && scannedFiles.length > 0 && selectedDestination

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t px-6 py-3',
        canTransfer
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'
      )}
    >
      <div className="flex items-center gap-2">
        {canTransfer ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              Ready to Transfer
            </span>
          </>
        ) : (
          <>
            <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {!selectedDrive
                ? 'Insert a drive to begin'
                : !selectedDestination
                  ? 'Select a destination'
                  : scannedFiles.length === 0
                    ? 'No media files found'
                    : 'Ready'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {selectedDrive && (
          <span>
            Drive: <span className="font-medium">{selectedDrive.displayName}</span>
          </span>
        )}
        {scannedFiles.length > 0 && (
          <span>
            Files: <span className="font-medium">{scannedFiles.length}</span>
          </span>
        )}
        {isTransferring && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            <span className="font-medium text-blue-600 dark:text-blue-400">Transferring</span>
          </span>
        )}
      </div>
    </div>
  )
}
