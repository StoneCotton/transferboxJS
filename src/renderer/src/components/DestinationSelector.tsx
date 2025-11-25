/**
 * Destination Selector Component
 */

import { FolderOpen, CheckCircle2, AlertCircle, FolderPlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useUIStore, useDriveStore, useConfigStore, useTransferStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { useUiDensity } from '../hooks/useUiDensity'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

export function DestinationSelector() {
  const { selectedDestination, setSelectedDestination, isSelectingDestination } = useUIStore()
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { config } = useConfigStore()
  const { isTransferring, startTransfer } = useTransferStore()
  const { isCondensed } = useUiDensity()
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
          // Extract file paths from ScannedFile objects
          const filePaths = scannedFiles.map((file) => file.path)
          
          // Debug: Check for empty file paths
          const emptyPaths = filePaths.filter((path, index) => {
            if (!path || path.trim() === '') {
              console.error(`[Auto-transfer] Empty file path at index ${index}:`, scannedFiles[index])
              return true
            }
            return false
          })
          
          if (emptyPaths.length > 0) {
            console.error(`[Auto-transfer] Found ${emptyPaths.length} empty file paths!`)
            console.error('[Auto-transfer] All scanned files:', scannedFiles)
          }
          
          const request = {
            driveInfo: selectedDrive,
            sourceRoot: selectedDrive.mountpoints[0] || '',
            destinationRoot: selectedDestination,
            files: filePaths
          }

          console.log('[Auto-transfer] Starting transfer with request:', {
            ...request,
            fileCount: request.files.length,
            firstFile: request.files[0],
            lastFile: request.files[request.files.length - 1]
          })

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
      <CardHeader className={isCondensed ? 'p-3' : undefined}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30',
            isCondensed ? 'h-6 w-6' : 'h-8 w-8'
          )}>
            <FolderOpen className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
          </div>
          <div>
            <CardTitle className={isCondensed ? 'text-sm' : 'text-lg'}>Destination</CardTitle>
            <CardDescription className="text-xs">
              {selectedDestination ? 'Location configured' : 'Choose save location'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={isCondensed ? 'p-3 pt-0' : undefined}>
        <div className={isCondensed ? 'space-y-2' : 'space-y-4'}>
          {/* Selected Path Display */}
          {selectedDestination ? (
            <div
              className={cn(
                'relative overflow-hidden rounded-xl border-2 transition-all',
                isCondensed ? 'p-2' : 'p-4',
                validationError
                  ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100 dark:border-red-600 dark:from-red-950/50 dark:to-red-900/50'
                  : 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-600 dark:from-green-950/50 dark:to-emerald-950/50'
              )}
            >
              <div className={cn('flex items-start', isCondensed ? 'gap-2' : 'gap-3')}>
                <div
                  className={cn(
                    'flex flex-shrink-0 items-center justify-center rounded-lg',
                    isCondensed ? 'h-7 w-7' : 'h-10 w-10',
                    validationError ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  )}
                >
                  {validationError ? (
                    <AlertCircle className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  ) : (
                    <CheckCircle2 className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-bold',
                      isCondensed ? 'text-xs' : 'text-sm',
                      validationError
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-green-900 dark:text-green-100'
                    )}
                  >
                    {validationError ? 'Invalid Destination' : 'Destination Ready'}
                  </p>
                  <p
                    className={cn(
                      'break-all font-medium',
                      isCondensed ? 'text-[10px]' : 'mt-1 text-xs',
                      validationError
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-green-700 dark:text-green-300'
                    )}
                  >
                    {selectedDestination}
                  </p>
                  {validationError && !isCondensed && (
                    <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                      {validationError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={cn(
              'relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 text-center dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900/50',
              isCondensed ? 'p-6' : 'p-12'
            )}>
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-slate-400 opacity-20" />
                <FolderPlus className={cn('relative mx-auto text-slate-600 dark:text-slate-400', isCondensed ? 'h-10 w-10' : 'h-16 w-16')} />
              </div>
              <p className={cn('font-semibold text-gray-900 dark:text-white', isCondensed ? 'mt-2 text-xs' : 'mt-4 text-sm')}>
                No Destination Selected
              </p>
              {!isCondensed && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Click below to choose a folder
                </p>
              )}
            </div>
          )}

          {/* Select Button */}
          <Button
            onClick={handleSelectFolder}
            disabled={isValidating || isSelectingDestination || isTransferring}
            className="w-full bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30 transition-all hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-500/40"
            size={isCondensed ? 'sm' : 'lg'}
          >
            <FolderOpen className={cn('mr-2', isCondensed ? 'h-4 w-4' : 'h-5 w-5')} />
            {isValidating
              ? 'Validating...'
              : isTransferring
                ? 'Transfer in Progress...'
                : selectedDestination
                  ? 'Change Destination'
                  : 'Select Destination'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
