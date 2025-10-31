/**
 * Transfer Actions Component
 */

import { Play, Loader2, Rocket, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useDriveStore, useTransferStore, useUIStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { cn } from '../lib/utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function TransferActions() {
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { isTransferring, startTransfer } = useTransferStore()
  const { selectedDestination } = useUIStore()
  const ipc = useIpc()
  const [isStarting, setIsStarting] = useState(false)

  const canTransfer =
    selectedDrive && scannedFiles.length > 0 && selectedDestination && !isTransferring

  const handleStartTransfer = async (): Promise<void> => {
    if (!canTransfer || !selectedDrive || !selectedDestination) return

    // Start transfer directly - no additional confirmation needed
    // The user is already confirming by clicking "Start Transfer"
    await performTransfer()
  }

  const performTransfer = async (): Promise<void> => {
    if (!selectedDrive || !selectedDestination) return

    try {
      setIsStarting(true)

      // Create transfer request
      // Extract file paths from ScannedFile objects
      const request = {
        driveInfo: selectedDrive,
        sourceRoot: selectedDrive.mountpoints[0] || '',
        destinationRoot: selectedDestination,
        files: scannedFiles.map((file) => file.path)
      }

      // Start the transfer via IPC
      await ipc.startTransfer(request)

      // Show toast notification (logs are already created in main process)
      const store = useStore.getState()
      store.addToast({
        type: 'info',
        message: `Transfer started: ${scannedFiles.length} file${scannedFiles.length === 1 ? '' : 's'}`,
        duration: 3000
      })

      // Update store
      startTransfer({
        id: `transfer-${Date.now()}`,
        driveId: selectedDrive.device,
        driveName: selectedDrive.displayName,
        sourceRoot: request.sourceRoot,
        destinationRoot: selectedDestination,
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: scannedFiles.length,
        totalBytes: 0,
        files: []
      })
    } catch (error) {
      console.error('Failed to start transfer:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      // Show toast notification (logs are already created in main process)
      const store = useStore.getState()
      store.addToast({
        type: 'error',
        message: `Failed to start transfer: ${errorMessage}`,
        duration: 5000
      })
      alert(`Failed to start transfer: ${errorMessage}`)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white/80 to-gray-50/80 shadow-xl backdrop-blur-sm dark:from-gray-900/80 dark:to-gray-800/80">
      {canTransfer && (
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-blue-400/10 to-purple-400/10 animate-pulse" />
      )}
      <CardContent className="relative p-8">
        <div className="space-y-4">
          {/* Main Transfer Button */}
          <Button
            onClick={handleStartTransfer}
            disabled={!canTransfer || isStarting}
            className={cn(
              'group relative h-16 w-full overflow-hidden text-lg font-bold shadow-2xl transition-all',
              canTransfer
                ? 'bg-gradient-to-r from-brand-500 via-brand-400 to-orange-500 text-white hover:from-brand-600 hover:via-brand-500 hover:to-orange-600 hover:shadow-brand-500/50'
                : 'bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
            )}
            size="lg"
          >
            {/* Animated background on hover */}
            {canTransfer && (
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            )}

            <div className="relative flex items-center justify-center gap-3">
              {isStarting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Initializing Transfer...</span>
                </>
              ) : canTransfer ? (
                <>
                  <Rocket className="h-6 w-6" />
                  <span>Start Transfer</span>
                  <Play className="h-6 w-6" />
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5" />
                  <span>Complete Setup to Start</span>
                </>
              )}
            </div>
          </Button>

          {/* Status Message */}
          <div
            className={cn(
              'rounded-lg border-2 p-4 text-center transition-all',
              canTransfer
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50'
                : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
            )}
          >
            {canTransfer ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <p className="text-sm font-bold text-green-900 dark:text-green-100">
                  Ready to Transfer {scannedFiles.length} File{scannedFiles.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : isTransferring ? (
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Transfer in progress...
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Setup Required
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1',
                      selectedDrive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {selectedDrive ? '✓ Drive Selected' : '○ Select Drive'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1',
                      selectedDestination
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {selectedDestination ? '✓ Destination Set' : '○ Set Destination'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1',
                      scannedFiles.length > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {scannedFiles.length > 0 ? '✓ Files Found' : '○ No Files'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
