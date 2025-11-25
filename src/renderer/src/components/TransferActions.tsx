/**
 * Transfer Actions Component
 */

import { Play, Loader2, Rocket, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useDriveStore, useTransferStore, useUIStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { useUiDensity } from '../hooks/useUiDensity'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { FileConflictDialog } from './FileConflictDialog'
import { cn } from '../lib/utils'
import type { FileConflictInfo, ConflictResolutionChoice, TransferValidateResponse } from '../../../shared/types'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function TransferActions() {
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { isTransferring, startTransfer } = useTransferStore()
  const { selectedDestination } = useUIStore()
  const { isCondensed } = useUiDensity()
  const ipc = useIpc()
  const [isStarting, setIsStarting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [conflicts, setConflicts] = useState<FileConflictInfo[]>([])

  const canTransfer =
    selectedDrive && scannedFiles.length > 0 && selectedDestination && !isTransferring

  const handleStartTransfer = async (): Promise<void> => {
    if (!canTransfer || !selectedDrive || !selectedDestination) return

    // First, validate the transfer
    await validateAndTransfer()
  }

  const validateAndTransfer = async (): Promise<void> => {
    if (!selectedDrive || !selectedDestination) return

    const store = useStore.getState()

    try {
      setIsValidating(true)

      // Extract file paths from ScannedFile objects
      const filePaths = scannedFiles.map((file) => file.path)

      // Run pre-transfer validation
      const validationResult: TransferValidateResponse = await ipc.validateTransfer({
        driveInfo: selectedDrive,
        sourceRoot: selectedDrive.mountpoints[0] || '',
        destinationRoot: selectedDestination,
        files: filePaths
      })

      console.log('Validation result:', validationResult)

      // Check for blocking issues (same directory, nested directories, insufficient space)
      if (!validationResult.canProceed) {
        store.addToast({
          type: 'error',
          message: validationResult.error || 'Transfer validation failed',
          duration: 5000
        })
        return
      }

      // Check for file conflicts
      if (validationResult.conflicts.length > 0 && validationResult.requiresConfirmation) {
        // Show conflict resolution dialog
        setConflicts(validationResult.conflicts)
        setShowConflictDialog(true)
        return
      }

      // No conflicts or auto-resolution is configured - proceed with transfer
      await performTransfer()
    } catch (error) {
      console.error('Validation failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Validation failed'
      store.addToast({
        type: 'error',
        message: `Validation failed: ${errorMessage}`,
        duration: 5000
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleConflictResolution = async (resolutions: Record<string, ConflictResolutionChoice>): Promise<void> => {
    setShowConflictDialog(false)

    // Proceed with transfer, passing conflict resolutions
    await performTransfer(resolutions)
  }

  const handleConflictCancel = (): void => {
    setShowConflictDialog(false)
    setConflicts([])
  }

  const performTransfer = async (conflictResolutions?: Record<string, ConflictResolutionChoice>): Promise<void> => {
    if (!selectedDrive || !selectedDestination) return

    try {
      setIsStarting(true)

      // Create transfer request
      // Extract file paths from ScannedFile objects
      let filePaths = scannedFiles.map((file) => file.path)
      
      // If we have conflict resolutions, filter out skipped files
      if (conflictResolutions) {
        filePaths = filePaths.filter((filePath) => {
          const resolution = conflictResolutions[filePath]
          // Only include files that are not being skipped
          return resolution !== 'skip'
        })
        
        console.log('Filtered files after conflict resolution:', {
          original: scannedFiles.length,
          afterFilter: filePaths.length,
          skipped: scannedFiles.length - filePaths.length
        })
      }
      
      // Debug: Check for empty file paths
      const emptyPaths = filePaths.filter((path, index) => {
        if (!path || path.trim() === '') {
          console.error(`Empty file path at index ${index}:`, scannedFiles[index])
          return true
        }
        return false
      })
      
      if (emptyPaths.length > 0) {
        console.error(`Found ${emptyPaths.length} empty file paths!`)
        console.error('All scanned files:', scannedFiles)
      }
      
      const request = {
        driveInfo: selectedDrive,
        sourceRoot: selectedDrive.mountpoints[0] || '',
        destinationRoot: selectedDestination,
        files: filePaths,
        conflictResolutions: conflictResolutions
      }

      console.log('Starting transfer with request:', {
        ...request,
        fileCount: request.files.length,
        firstFile: request.files[0],
        lastFile: request.files[request.files.length - 1],
        hasConflictResolutions: !!conflictResolutions
      })

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
    <>
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white/80 to-gray-50/80 shadow-xl backdrop-blur-sm dark:from-gray-900/80 dark:to-gray-800/80">
        {canTransfer && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-blue-400/10 to-purple-400/10 animate-pulse" />
        )}
        <CardContent className={cn('relative', isCondensed ? 'p-3' : 'p-8')}>
          <div className={isCondensed ? 'space-y-2' : 'space-y-4'}>
            {/* Main Transfer Button */}
            <Button
              onClick={handleStartTransfer}
              disabled={!canTransfer || isStarting || isValidating}
              className={cn(
                'group relative w-full overflow-hidden font-bold shadow-2xl transition-all',
                isCondensed ? 'h-10 text-sm' : 'h-16 text-lg',
                canTransfer
                  ? 'bg-gradient-to-r from-brand-500 via-brand-400 to-orange-500 text-white hover:from-brand-600 hover:via-brand-500 hover:to-orange-600 hover:shadow-brand-500/50'
                  : 'bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
              )}
              size={isCondensed ? 'sm' : 'lg'}
            >
              {/* Animated background on hover */}
              {canTransfer && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              )}

              <div className={cn('relative flex items-center justify-center', isCondensed ? 'gap-2' : 'gap-3')}>
                {isValidating ? (
                  <>
                    <Loader2 className={cn('animate-spin', isCondensed ? 'h-4 w-4' : 'h-6 w-6')} />
                    <span>{isCondensed ? 'Validating...' : 'Checking for conflicts...'}</span>
                  </>
                ) : isStarting ? (
                  <>
                    <Loader2 className={cn('animate-spin', isCondensed ? 'h-4 w-4' : 'h-6 w-6')} />
                    <span>{isCondensed ? 'Starting...' : 'Initializing Transfer...'}</span>
                  </>
                ) : canTransfer ? (
                  <>
                    <Rocket className={isCondensed ? 'h-4 w-4' : 'h-6 w-6'} />
                    <span>Start Transfer</span>
                    {!isCondensed && <Play className="h-6 w-6" />}
                  </>
                ) : (
                  <>
                    <AlertCircle className={isCondensed ? 'h-4 w-4' : 'h-5 w-5'} />
                    <span>{isCondensed ? 'Setup Required' : 'Complete Setup to Start'}</span>
                  </>
                )}
              </div>
            </Button>

          {/* Status Message */}
          <div
            className={cn(
              'rounded-lg border-2 text-center transition-all',
              isCondensed ? 'p-2' : 'p-4',
              canTransfer
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50'
                : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
            )}
          >
            {canTransfer ? (
              <div className={cn('flex items-center justify-center', isCondensed ? 'gap-1' : 'gap-2')}>
                <div className={cn('animate-pulse rounded-full bg-green-500', isCondensed ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
                <p className={cn('font-bold text-green-900 dark:text-green-100', isCondensed ? 'text-xs' : 'text-sm')}>
                  Ready to Transfer {scannedFiles.length} File{scannedFiles.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : isTransferring ? (
              <p className={cn('font-semibold text-blue-900 dark:text-blue-100', isCondensed ? 'text-xs' : 'text-sm')}>
                Transfer in progress...
              </p>
            ) : (
              <div className={isCondensed ? 'space-y-1' : 'space-y-2'}>
                {!isCondensed && (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Setup Required
                  </p>
                )}
                <div className={cn('flex flex-wrap items-center justify-center', isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs')}>
                  <span
                    className={cn(
                      'rounded-full',
                      isCondensed ? 'px-2 py-0.5' : 'px-3 py-1',
                      selectedDrive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {selectedDrive ? '✓ Drive' : '○ Drive'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full',
                      isCondensed ? 'px-2 py-0.5' : 'px-3 py-1',
                      selectedDestination
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {selectedDestination ? '✓ Dest' : '○ Dest'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full',
                      isCondensed ? 'px-2 py-0.5' : 'px-3 py-1',
                      scannedFiles.length > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {scannedFiles.length > 0 ? '✓ Files' : '○ Files'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

      {/* File Conflict Dialog */}
      <FileConflictDialog
        isOpen={showConflictDialog}
        onConfirm={handleConflictResolution}
        onCancel={handleConflictCancel}
        conflicts={conflicts}
        driveName={selectedDrive?.displayName || 'Unknown Drive'}
        destination={selectedDestination || ''}
      />
    </>
  )
}
