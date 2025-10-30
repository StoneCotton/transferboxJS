/**
 * App Initialization Hook
 * Loads initial data and sets up event listeners
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'
import {
  initSoundManager,
  playErrorSound,
  playSuccessSound,
  cleanupSoundManager
} from '../utils/soundManager'
import { TransferErrorType } from '../../../shared/types'

/**
 * Hook to initialize the app
 * Loads config, sets up IPC listeners
 */
export function useAppInit(): null {
  const ipc = useIpc()

  useEffect(() => {
    // Initialize sound manager
    initSoundManager()

    // Load initial configuration
    const loadConfig = async (): Promise<void> => {
      const store = useStore.getState()
      store.setConfigLoading(true)
      try {
        const config = await ipc.getConfig()
        store.setConfig(config)
      } catch (error) {
        console.error('Failed to load config:', error)
        store.setConfigError(
          error instanceof Error ? error.message : 'Failed to load configuration'
        )
      }
    }

    // Load transfer history
    const loadHistory = async (): Promise<void> => {
      try {
        const history = await ipc.getHistory()
        useStore.getState().setHistory(history)
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }

    // Load existing drives and handle them based on transfer mode
    const loadExistingDrives = async (): Promise<void> => {
      try {
        const drives = await ipc.listDrives()
        const store = useStore.getState()

        // Mark these as existing drives (present at startup)
        store.setExistingDrives(drives)

        // Handle existing drives based on transfer mode
        const config = store.config
        if (config.transferMode === 'manual' || config.transferMode === 'confirm-transfer') {
          // In confirmation modes, show existing drives for manual selection
          store.setDetectedDrives(drives)
          console.log(
            `[${config.transferMode}] Found ${drives.length} existing drives available for selection`
          )
        } else {
          // In auto-transfer modes, show existing drives for manual selection
          // but don't auto-scan them to prevent accidental transfers
          store.setDetectedDrives(drives)
          store.selectDrive(null)
          store.clearScan()
          console.log(
            `[${config.transferMode}] Found ${drives.length} existing drives - available for manual selection (no auto-scan)`
          )
        }
      } catch (error) {
        console.error('Failed to load existing drives:', error)
      }
    }

    // Initialize
    loadConfig()
    loadHistory()
    loadExistingDrives()

    // Set up event listeners
    const unsubDriveDetected = ipc.onDriveDetected(async (drive) => {
      console.log('Drive detected:', drive)
      const store = useStore.getState()

      // Check if this is an existing drive (was present at startup)
      const isExisting = store.isExistingDrive(drive.device)

      // Add drive to detected drives
      store.addDrive(drive)

      // Show toast notification (logs are already created in main process)
      store.addToast({
        type: 'info',
        message: `Drive detected: ${drive.displayName}`,
        duration: 3000
      })

      // Get current config to determine transfer mode
      const config = store.config

      // For existing drives in auto-transfer modes, don't auto-scan to prevent accidental transfers
      // But still add them to the UI so user can manually select them
      if (
        isExisting &&
        (config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer')
      ) {
        console.log(
          `[${config.transferMode}] Existing drive detected - available for manual selection (no auto-scan)`
        )
        return
      }

      // Mode-based auto-transfer logic (only for newly inserted drives)
      if (config.transferMode === 'fully-autonomous' && config.defaultDestination) {
        // Mode 3: Fully autonomous - auto-scan and auto-transfer
        console.log('[Mode 3] Fully autonomous transfer starting...')
        try {
          store.setScanInProgress(true)
          const result = await ipc.scanDrive(drive.device)
          store.setScannedFiles(result.files)

          // Show toast notification for scan complete
          if (result.files.length > 0) {
            store.addToast({
              type: 'success',
              message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
              duration: 3000
            })
          } else {
            store.addToast({
              type: 'warning',
              message: 'Scan complete: No valid files found on drive',
              duration: 4000
            })
            console.log('[Mode 3] No valid files found on drive - playing error sound')
            playErrorSound()
          }

          if (result.files.length > 0) {
            // Auto-start transfer without confirmation
            const request = {
              driveInfo: drive,
              sourceRoot: drive.mountpoints[0] || '',
              destinationRoot: config.defaultDestination,
              files: result.files
            }
            await ipc.startTransfer(request)
            // Show toast notification (logs are already created in main process)
            store.addToast({
              type: 'info',
              message: `Transfer started: ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
              duration: 3000
            })
            store.startTransfer({
              id: `transfer-${Date.now()}`,
              driveId: drive.device,
              driveName: drive.displayName,
              sourceRoot: request.sourceRoot,
              destinationRoot: config.defaultDestination,
              startTime: Date.now(),
              endTime: null,
              status: 'transferring',
              fileCount: result.files.length,
              totalBytes: 0,
              files: []
            })
          }
        } catch (error) {
          console.error('Auto-transfer failed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Auto-transfer failed'
          store.setScanError(errorMessage)
          // Show toast notification (logs are already created in main process)
          store.addToast({
            type: 'error',
            message: `Scan failed: ${errorMessage}`,
            duration: 5000
          })
          // Play error sound when auto-transfer fails
          playErrorSound()
        } finally {
          store.setScanInProgress(false)
        }
      } else if (config.transferMode === 'auto-transfer') {
        // Mode 1: Auto-scan, but ask for destination
        console.log('[Mode 1] Auto-scanning drive, waiting for destination...')
        try {
          store.setScanInProgress(true)
          const result = await ipc.scanDrive(drive.device)
          store.setScannedFiles(result.files)
          store.selectDrive(drive)

          // Show toast notification for scan complete
          if (result.files.length > 0) {
            store.addToast({
              type: 'success',
              message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
              duration: 3000
            })
          } else {
            store.addToast({
              type: 'warning',
              message: 'Scan complete: No valid files found on drive',
              duration: 4000
            })
            console.log('[Mode 1] No valid files found on drive - playing error sound')
            playErrorSound()
          }
          // UI will show files and user can set destination then click transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Auto-scan failed'
          store.setScanError(errorMessage)
          // Show toast notification (logs are already created in main process)
          store.addToast({
            type: 'error',
            message: `Scan failed: ${errorMessage}`,
            duration: 5000
          })
          // Play error sound when scan fails
          playErrorSound()
        } finally {
          store.setScanInProgress(false)
        }
      } else if (config.transferMode === 'confirm-transfer') {
        // Mode 2: Auto-scan, require confirmation
        console.log('[Mode 2] Auto-scanning drive, will require confirmation...')
        try {
          store.setScanInProgress(true)
          const result = await ipc.scanDrive(drive.device)
          store.setScannedFiles(result.files)
          store.selectDrive(drive)

          // Show toast notification for scan complete
          if (result.files.length > 0) {
            store.addToast({
              type: 'success',
              message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
              duration: 3000
            })
          } else {
            store.addToast({
              type: 'warning',
              message: 'Scan complete: No valid files found on drive',
              duration: 4000
            })
            console.log('[Mode 2] No valid files found on drive - playing error sound')
            playErrorSound()
          }
          // UI will show confirmation dialog before starting transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Auto-scan failed'
          store.setScanError(errorMessage)
          // Show toast notification (logs are already created in main process)
          store.addToast({
            type: 'error',
            message: `Scan failed: ${errorMessage}`,
            duration: 5000
          })
          // Play error sound when scan fails
          playErrorSound()
        } finally {
          store.setScanInProgress(false)
        }
      }
      // Mode 'manual': Do nothing, user manually selects everything
    })

    const unsubDriveRemoved = ipc.onDriveRemoved((device) => {
      console.log('Drive removed:', device)
      const store = useStore.getState()
      const drive = store.detectedDrives.find((d) => d.device === device)
      store.removeDrive(device)
      // Show toast notification (logs are already created in main process)
      store.addToast({
        type: 'info',
        message: drive ? `Drive removed: ${drive.displayName}` : 'Drive removed',
        duration: 3000
      })
    })

    const unsubDriveUnmounted = ipc.onDriveUnmounted((device) => {
      console.log('[useAppInit] Drive unmounted event received:', device)
      const store = useStore.getState()
      console.log(
        '[useAppInit] Current detectedDrives:',
        store.detectedDrives.map((d) => d.device)
      )
      console.log('[useAppInit] Current unmountedDrives before:', store.unmountedDrives)
      store.markDriveAsUnmounted(device)
      console.log('[useAppInit] Current unmountedDrives after:', store.unmountedDrives)
    })

    const unsubTransferProgress = ipc.onTransferProgress((progress) => {
      const store = useStore.getState()
      store.updateProgress(progress)

      // Track file-level errors from completed files
      if (progress.completedFiles) {
        progress.completedFiles.forEach((file) => {
          if (file.status === 'error' && file.errorType) {
            store.setFileError(file.sourcePath, file.error || 'Unknown error', file.errorType)

            // Add to error list if critical
            if (
              [
                TransferErrorType.INSUFFICIENT_SPACE,
                TransferErrorType.DRIVE_DISCONNECTED,
                TransferErrorType.PERMISSION_DENIED
              ].includes(file.errorType)
            ) {
              store.addTransferError(file.error || 'Transfer error', file.errorType, {
                filename: file.fileName,
                path: file.sourcePath
              })
            }
          }
        })
      }
    })

    const unsubTransferComplete = ipc.onTransferComplete((data) => {
      console.log('Transfer complete:', data)
      const store = useStore.getState()
      store.completeTransfer()

      // Show toast notification and play sound based on transfer status
      if (data.status === 'complete') {
        const fileCount = store.progress?.totalFiles || 0
        store.addToast({
          type: 'success',
          message: `Transfer completed successfully${fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''}`,
          duration: 5000
        })
        console.log('[SoundManager] Transfer completed successfully - playing success sound')
        playSuccessSound()
      } else {
        const failedCount = store.progress?.failedFiles || 0
        store.addToast({
          type: 'error',
          message: `Transfer completed with errors${failedCount > 0 ? ` (${failedCount} file${failedCount === 1 ? '' : 's'} failed)` : ''}`,
          duration: 6000
        })
        console.log('[SoundManager] Transfer completed with errors - playing error sound')
        playErrorSound()
      }

      // In auto modes, after transfer completes, go back to waiting for new drives
      const config = store.config
      if (config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer') {
        console.log(`[${config.transferMode}] Transfer complete - ready for next drive`)
        // Clear current selection to prepare for next drive
        store.selectDrive(null)
        store.clearScan()
      }
    })

    const unsubTransferError = ipc.onTransferError((error) => {
      console.error('Transfer error:', error)
      const store = useStore.getState()

      // Try to categorize error from message
      const errorType = categorizeErrorFromMessage(error)
      store.failTransfer(error, errorType || undefined)

      if (errorType) {
        store.setErrorDetails({
          type: errorType,
          retryable: isErrorRetryable(errorType),
          affectedFiles: []
        })
      }

      // Show toast notification (logs are already created in main process)
      store.addToast({
        type: 'error',
        message: `Transfer failed: ${error}`,
        duration: 6000
      })

      // Play error sound when transfer fails
      console.log('[SoundManager] Transfer failed - playing error sound')
      playErrorSound()
    })

    const unsubLogEntry = ipc.onLogEntry((entry) => {
      useStore.getState().addLog(entry)
    })

    const unsubSystemSuspend = ipc.onSystemSuspend(() => {
      console.log('[useAppInit] System suspending')
      const store = useStore.getState()
      store.setSystemSleeping(true)

      // Show warning if transfer is active
      if (store.isTransferring) {
        console.log('[useAppInit] Transfer active during suspend - warning user')
        store.addToast({
          type: 'warning',
          message: 'System is suspending - transfer may be interrupted',
          duration: 5000
        })
      }
    })

    const unsubSystemResume = ipc.onSystemResume(() => {
      console.log('[useAppInit] System resumed')
      const store = useStore.getState()
      store.setSystemSleeping(false)

      // Notify user that system resumed
      store.addToast({
        type: 'info',
        message: 'System resumed - checking transfer status',
        duration: 5000
      })
    })

    const unsubMenuOpenSettings = ipc.onMenuOpenSettings(() => {
      console.log('[useAppInit] Menu: Open Settings')
      const store = useStore.getState()
      if (!store.showSettings) {
        store.toggleSettings()
      }
    })

    const unsubMenuOpenHistory = ipc.onMenuOpenHistory(() => {
      console.log('[useAppInit] Menu: Open History')
      const store = useStore.getState()
      if (!store.showHistory) {
        store.toggleHistory()
      }
    })

    const unsubMenuNewTransfer = ipc.onMenuNewTransfer(() => {
      console.log('[useAppInit] Menu: New Transfer - focusing on drive selector')
      const store = useStore.getState()
      // Reset current transfer state
      store.selectDrive(null)
      store.clearScan()
      store.setSelectedDestination(null)
      // Close any open modals
      store.closeAllModals()
    })

    const unsubMenuSelectDestination = ipc.onMenuSelectDestination(() => {
      console.log('[useAppInit] Menu: Select Destination - opening folder picker')
      const store = useStore.getState()

      // Replicate the folder selection logic from DestinationSelector
      const handleSelectFolder = async (): Promise<void> => {
        try {
          const folder = await ipc.selectFolder()
          if (folder) {
            // Validate the path
            const validation = await ipc.validatePath({ path: folder })

            if (validation.isValid) {
              store.setSelectedDestination(folder)
              // Auto-transfer logic is handled by DestinationSelector's useEffect
            } else {
              store.addToast({
                type: 'error',
                message: validation.error || 'Invalid destination folder',
                duration: 5000
              })
            }
          }
        } catch (error) {
          console.error('Failed to select folder:', error)
          store.addToast({
            type: 'error',
            message: 'Failed to select destination folder',
            duration: 5000
          })
        }
      }

      handleSelectFolder()
    })

    const unsubConfigMigrated = ipc.onConfigMigrated((data) => {
      console.log('[useAppInit] Config migrated:', data)
      const store = useStore.getState()
      store.addToast({
        type: 'success',
        message: `Configuration updated from version ${data.fromVersion} to ${data.toVersion}`,
        duration: 6000
      })
    })

    // Cleanup on unmount
    return () => {
      unsubDriveDetected()
      unsubDriveRemoved()
      unsubDriveUnmounted()
      unsubTransferProgress()
      unsubTransferComplete()
      unsubTransferError()
      unsubLogEntry()
      unsubSystemSuspend()
      unsubSystemResume()
      unsubMenuOpenSettings()
      unsubMenuOpenHistory()
      unsubMenuNewTransfer()
      unsubMenuSelectDestination()
      unsubConfigMigrated()
      cleanupSoundManager()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  return null
}

/**
 * Helper function to categorize errors from error messages
 */
function categorizeErrorFromMessage(message: string): TransferErrorType | null {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('space') || lowerMessage.includes('enospc')) {
    return TransferErrorType.INSUFFICIENT_SPACE
  }
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('eacces') ||
    lowerMessage.includes('eperm')
  ) {
    return TransferErrorType.PERMISSION_DENIED
  }
  if (lowerMessage.includes('checksum')) {
    return TransferErrorType.CHECKSUM_MISMATCH
  }
  if (
    lowerMessage.includes('disconnected') ||
    lowerMessage.includes('enoent') ||
    lowerMessage.includes('eio')
  ) {
    return TransferErrorType.DRIVE_DISCONNECTED
  }
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('econnreset')
  ) {
    return TransferErrorType.NETWORK_ERROR
  }
  if (lowerMessage.includes('cancel')) {
    return TransferErrorType.CANCELLED
  }

  return null
}

/**
 * Helper function to determine if an error type is retryable
 */
function isErrorRetryable(errorType: TransferErrorType): boolean {
  return errorType === TransferErrorType.NETWORK_ERROR
}
