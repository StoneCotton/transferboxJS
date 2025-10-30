/**
 * Destination Selector Component
 */

import { FolderOpen, CheckCircle2, AlertCircle, FolderPlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useUIStore, useDriveStore, useConfigStore, useTransferStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

export function DestinationSelector() {
  const { selectedDestination, setSelectedDestination, isSelectingDestination } = useUIStore()
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { config } = useConfigStore()
  const { isTransferring, startTransfer } = useTransferStore()
  const ipc = useIpc()
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const hasTriggeredAutoTransfer = useRef(false)

  const handleSelectFolder = async () => {
    try {
      const folder = await ipc.selectFolder()
      if (folder) {
        setIsValidating(true)
        setValidationError(null)

        // Validate the path
        const validation = await ipc.validatePath({ path: folder })

        if (validation.isValid) {
          setSelectedDestination(folder)
          setValidationError(null)
        } else {
          setValidationError(validation.error || 'Invalid destination')
          setSelectedDestination(null)
        }
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
      setValidationError('Failed to select folder')
    } finally {
      setIsValidating(false)
    }
  }

  // Auto-transfer for Mode 1: when destination is set AND drive/files are ready
  useEffect(() => {
    const shouldAutoTransfer =
      config.transferMode === 'auto-transfer' &&
      selectedDestination &&
      selectedDrive &&
      scannedFiles.length > 0 &&
      !isTransferring &&
      !hasTriggeredAutoTransfer.current

    if (shouldAutoTransfer) {
      hasTriggeredAutoTransfer.current = true
      console.log('[Mode 1] Auto-starting transfer after destination set')

      const performAutoTransfer = async () => {
        try {
          const request = {
            driveInfo: selectedDrive,
            sourceRoot: selectedDrive.mountpoints[0] || '',
            destinationRoot: selectedDestination,
            files: scannedFiles
          }

          await ipc.startTransfer(request)

          // Show toast notification (logs are already created in main process)
          useStore.getState().addToast({
            type: 'info',
            message: `Transfer started: ${scannedFiles.length} file${scannedFiles.length === 1 ? '' : 's'}`,
            duration: 3000
          })

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
          console.error('Auto-transfer failed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Auto-transfer failed'
          // Show toast notification (logs are already created in main process)
          useStore.getState().addToast({
            type: 'error',
            message: `Failed to start transfer: ${errorMessage}`,
            duration: 5000
          })
        }
      }

      performAutoTransfer()
    }
  }, [
    config.transferMode,
    selectedDestination,
    selectedDrive,
    scannedFiles,
    isTransferring,
    ipc,
    startTransfer
  ])

  // Reset auto-transfer flag when drive changes
  useEffect(() => {
    hasTriggeredAutoTransfer.current = false
  }, [selectedDrive?.device])

  return (
    <Card className="h-full border-0 bg-white/70 shadow-xl shadow-slate-500/10 backdrop-blur-sm dark:bg-gray-900/70">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg">Destination</CardTitle>
            <CardDescription className="text-xs">
              {selectedDestination ? 'Location configured' : 'Choose save location'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Selected Path Display */}
          {selectedDestination ? (
            <div
              className={cn(
                'relative overflow-hidden rounded-xl border-2 p-4 transition-all',
                validationError
                  ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100 dark:border-red-600 dark:from-red-950/50 dark:to-red-900/50'
                  : 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-600 dark:from-green-950/50 dark:to-emerald-950/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                    validationError ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  )}
                >
                  {validationError ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-bold',
                      validationError
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-green-900 dark:text-green-100'
                    )}
                  >
                    {validationError ? 'Invalid Destination' : 'Destination Ready'}
                  </p>
                  <p
                    className={cn(
                      'mt-1 break-all text-xs font-medium',
                      validationError
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-green-700 dark:text-green-300'
                    )}
                  >
                    {selectedDestination}
                  </p>
                  {validationError && (
                    <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                      {validationError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 p-12 text-center dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900/50">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-slate-400 opacity-20" />
                <FolderPlus className="relative mx-auto h-16 w-16 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
                No Destination Selected
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Click below to choose a folder
              </p>
            </div>
          )}

          {/* Select Button */}
          <Button
            onClick={handleSelectFolder}
            disabled={isValidating || isSelectingDestination}
            className="w-full bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30 transition-all hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-500/40"
            size="lg"
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            {isValidating
              ? 'Validating...'
              : selectedDestination
                ? 'Change Destination'
                : 'Select Destination'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
