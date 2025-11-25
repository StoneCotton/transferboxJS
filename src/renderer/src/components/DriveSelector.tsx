/**
 * Drive Selector Component
 */

import { HardDrive, Loader2, Usb, Check, Sparkles, Clock, PowerOff } from 'lucide-react'
import { useDriveStore, useConfigStore, useStore, useTransferStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { useUiDensity } from '../hooks/useUiDensity'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { Tooltip } from './ui/Tooltip'
import { formatBytes, cn } from '../lib/utils'
import type { DriveInfo } from '../../../shared/types'
import { playErrorSound } from '../utils/soundManager'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function DriveSelector() {
  const {
    detectedDrives,
    selectedDrive,
    selectDrive,
    scanInProgress,
    setScanInProgress,
    setScannedFiles,
    setScanError,
    isExistingDrive,
    isDriveUnmounted
  } = useDriveStore()
  const { config } = useConfigStore()
  const { isTransferring } = useTransferStore()
  const { isCondensed } = useUiDensity()
  const ipc = useIpc()

  const handleSelectDrive = async (drive: DriveInfo): Promise<void> => {
    // Don't allow selection of unmounted drives
    if (isDriveUnmounted(drive.device)) {
      console.log('[DriveSelector] Cannot select unmounted drive')
      setScanError('Drive is unmounted. Please reconnect the drive.')
      playErrorSound()
      return
    }

    // Don't allow drive selection during active transfer
    if (isTransferring) {
      console.log('[DriveSelector] Cannot select drive during active transfer')
      setScanError('Cannot select drive while transfer is in progress.')
      playErrorSound()
      return
    }

    // Select the drive
    selectDrive(drive)

    // Start scanning immediately
    try {
      setScanInProgress(true)
      setScanError(null)
      const result = await ipc.scanDrive(drive.device)
      setScannedFiles(result.files)
      console.log(`Found ${result.files.length} media files on ${drive.displayName}`)

      // Show toast notification (logs are already created in main process)
      if (result.files.length > 0) {
        useStore.getState().addToast({
          type: 'success',
          message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'} on ${drive.displayName}`,
          duration: 3000
        })
      } else {
        useStore.getState().addToast({
          type: 'warning',
          message: `Scan complete: No valid files found on ${drive.displayName}`,
          duration: 4000
        })
        console.log('[DriveSelector] No valid files found on drive - playing error sound')
        playErrorSound()
      }
    } catch (error) {
      console.error('Failed to scan drive:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan drive'
      setScanError(errorMessage)
      setScannedFiles([])
      // Show toast notification (logs are already created in main process)
      useStore.getState().addToast({
        type: 'error',
        message: `Scan failed: ${errorMessage}`,
        duration: 5000
      })
      // Play error sound when scan fails
      playErrorSound()
    } finally {
      setScanInProgress(false)
    }
  }

  if (detectedDrives.length === 0) {
    const isAutoMode =
      config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer'

    return (
      <Card className="h-full border-2 border-dashed border-gray-300 bg-white/50 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/50">
        <CardContent
          className={cn(
            'flex flex-col items-center justify-center',
            isCondensed ? 'py-8' : 'py-16'
          )}
        >
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-20" />
            <div
              className={cn(
                'relative flex items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-orange-100 dark:from-brand-900/30 dark:to-orange-900/30',
                isCondensed ? 'h-14 w-14' : 'h-20 w-20'
              )}
            >
              <HardDrive
                className={
                  isCondensed
                    ? 'h-7 w-7 text-brand-600 dark:text-brand-400'
                    : 'h-10 w-10 text-brand-600 dark:text-brand-400'
                }
              />
            </div>
          </div>
          <p
            className={cn(
              'font-bold text-gray-900 dark:text-white',
              isCondensed ? 'mt-4 text-base' : 'mt-6 text-xl'
            )}
          >
            {isAutoMode ? 'Waiting for New Drive' : 'No Drives Detected'}
          </p>
          <p
            className={cn(
              'text-center text-gray-600 dark:text-gray-400',
              isCondensed ? 'mt-1 text-xs' : 'mt-2 text-sm'
            )}
          >
            {isAutoMode
              ? 'Insert a new SD card or USB drive to begin auto-transfer'
              : 'Insert an SD card or USB drive to begin'}
          </p>
          {!isCondensed && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <Sparkles className="h-3 w-3" />
              <span>
                {isAutoMode
                  ? 'Auto-transfer mode active - monitoring for new devices...'
                  : 'Monitoring for new devices...'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full border-0 bg-white/70 shadow-xl shadow-brand-500/10 backdrop-blur-sm dark:bg-gray-900/70">
      <CardHeader className={isCondensed ? 'p-3' : undefined}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/30',
              isCondensed ? 'h-6 w-6' : 'h-8 w-8'
            )}
          >
            <HardDrive className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
          </div>
          <div>
            <CardTitle className={isCondensed ? 'text-sm' : 'text-lg'}>Source Drives</CardTitle>
            <CardDescription className="text-xs">
              {detectedDrives.length} {detectedDrives.length === 1 ? 'drive' : 'drives'} detected
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={isCondensed ? 'p-3 pt-0' : undefined}>
        <div className={isCondensed ? 'space-y-2' : 'space-y-3'}>
          {detectedDrives.map((drive) => {
            const isSelected = selectedDrive?.device === drive.device
            const isScanningThis = scanInProgress && isSelected
            const isExisting = isExistingDrive(drive.device)
            const isUnmounted = isDriveUnmounted(drive.device)
            const isDisabled = isUnmounted || isTransferring
            const isAutoMode =
              config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer'

            // Debug logging
            if (isUnmounted) {
              console.log(
                '[DriveSelector] Rendering unmounted drive:',
                drive.device,
                drive.displayName
              )
            }

            return (
              <button
                key={drive.device}
                onClick={() => handleSelectDrive(drive)}
                disabled={isDisabled}
                className={cn(
                  'group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all duration-300',
                  isCondensed ? 'p-2' : 'p-4',
                  !isDisabled && 'hover:shadow-lg hover:shadow-brand-500/20',
                  isDisabled
                    ? 'cursor-not-allowed border-red-300 bg-gradient-to-br from-red-50/50 to-orange-50/50 opacity-70 dark:border-red-800 dark:from-red-950/30 dark:to-orange-950/30'
                    : isSelected
                      ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-orange-50 dark:border-brand-400 dark:from-brand-950/50 dark:to-orange-950/50'
                      : isExisting && isAutoMode
                        ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-600 dark:from-amber-950/50 dark:to-yellow-950/50'
                        : 'border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-600'
                )}
              >
                {/* Status indicators */}
                {isUnmounted ? (
                  <Tooltip
                    content="Drive disconnected. Please reconnect to use this drive."
                    position="left"
                  >
                    <div
                      className={cn(
                        'absolute flex items-center justify-center rounded-full bg-red-500 text-white shadow-lg',
                        isCondensed ? 'right-2 top-2 h-5 w-5' : 'right-3 top-3 h-7 w-7'
                      )}
                    >
                      <PowerOff className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={2.5} />
                    </div>
                  </Tooltip>
                ) : isSelected ? (
                  <Tooltip content="Currently selected drive for transfer" position="left">
                    <div
                      className={cn(
                        'absolute flex items-center justify-center rounded-full bg-brand-500 text-white shadow-lg',
                        isCondensed ? 'right-2 top-2 h-4 w-4' : 'right-3 top-3 h-6 w-6'
                      )}
                    >
                      <Check className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={3} />
                    </div>
                  </Tooltip>
                ) : isExisting && isAutoMode ? (
                  <Tooltip
                    content="Already connected drive. Click to scan manually."
                    position="left"
                  >
                    <div
                      className={cn(
                        'absolute flex items-center justify-center rounded-full bg-amber-500 text-white shadow-lg',
                        isCondensed ? 'right-2 top-2 h-4 w-4' : 'right-3 top-3 h-6 w-6'
                      )}
                    >
                      <Clock className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={3} />
                    </div>
                  </Tooltip>
                ) : null}

                <div className={cn('flex items-center', isCondensed ? 'gap-2' : 'gap-4')}>
                  {/* Icon */}
                  <div
                    className={cn(
                      'relative flex flex-shrink-0 items-center justify-center rounded-xl transition-all',
                      isCondensed ? 'h-10 w-10' : 'h-14 w-14',
                      isUnmounted
                        ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                        : isSelected
                          ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30'
                          : 'bg-gray-100 text-gray-600 group-hover:bg-brand-100 group-hover:text-brand-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {isScanningThis ? (
                      <Loader2
                        className={isCondensed ? 'h-5 w-5 animate-spin' : 'h-7 w-7 animate-spin'}
                      />
                    ) : drive.busType === 'USB' ? (
                      <Usb className={isCondensed ? 'h-5 w-5' : 'h-7 w-7'} />
                    ) : (
                      <HardDrive className={isCondensed ? 'h-5 w-5' : 'h-7 w-7'} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className={cn(
                        'truncate font-bold',
                        isCondensed ? 'text-sm' : 'text-base',
                        isUnmounted
                          ? 'text-red-700 dark:text-red-300'
                          : isSelected
                            ? 'text-brand-900 dark:text-brand-100'
                            : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {drive.displayName}
                      {isUnmounted && (
                        <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">
                          (Unmounted)
                        </span>
                      )}
                    </h3>
                    <p
                      className={cn(
                        'font-medium',
                        isCondensed ? 'text-xs' : 'mt-1 text-sm',
                        isUnmounted
                          ? 'text-red-600 dark:text-red-400'
                          : isSelected
                            ? 'text-brand-700 dark:text-brand-300'
                            : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {drive.description} •{' '}
                      {formatBytes(drive.size, config?.unitSystem || 'decimal')}
                    </p>
                    {!isCondensed && (
                      <p
                        className={cn(
                          'mt-1 truncate text-xs',
                          isUnmounted
                            ? 'text-red-500 dark:text-red-500'
                            : isSelected
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-gray-500 dark:text-gray-500'
                        )}
                      >
                        {drive.mountpoints[0] || drive.device}
                      </p>
                    )}
                    {isUnmounted && !isCondensed ? (
                      <div className="mt-2 flex items-center gap-2">
                        <PowerOff className="h-3 w-3 text-red-600 dark:text-red-400" />
                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                          Drive unmounted - please reconnect to use
                        </span>
                      </div>
                    ) : isScanningThis ? (
                      <div className={cn('flex items-center gap-2', isCondensed ? 'mt-1' : 'mt-2')}>
                        <div
                          className={cn(
                            'flex-1 overflow-hidden rounded-full bg-brand-200 dark:bg-brand-900',
                            isCondensed ? 'h-1' : 'h-1.5'
                          )}
                        >
                          <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-brand-500 to-orange-500" />
                        </div>
                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                          Scanning...
                        </span>
                      </div>
                    ) : isExisting && isAutoMode && !isSelected && !isCondensed ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          Already connected - click to scan manually
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
