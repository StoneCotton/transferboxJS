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

/**
 * Hook to initialize the app
 * Loads config, sets up IPC listeners
 */
export function useAppInit() {
  const ipc = useIpc()

  useEffect(() => {
    // Initialize sound manager
    initSoundManager()

    // Load initial configuration
    const loadConfig = async () => {
      const store = useStore.getState()
      store.setLoading(true)
      try {
        const config = await ipc.getConfig()
        store.setConfig(config)
      } catch (error) {
        console.error('Failed to load config:', error)
        store.setError(error instanceof Error ? error.message : 'Failed to load configuration')
      }
    }

    // Load transfer history
    const loadHistory = async () => {
      try {
        const history = await ipc.getHistory()
        useStore.getState().setHistory(history)
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }

    // Load existing drives and handle them based on transfer mode
    const loadExistingDrives = async () => {
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

          // Play error sound if no valid files found
          if (result.files.length === 0) {
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
          store.setScanError(error instanceof Error ? error.message : 'Auto-transfer failed')
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

          // Play error sound if no valid files found
          if (result.files.length === 0) {
            console.log('[Mode 1] No valid files found on drive - playing error sound')
            playErrorSound()
          }
          // UI will show files and user can set destination then click transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          store.setScanError(error instanceof Error ? error.message : 'Auto-scan failed')
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

          // Play error sound if no valid files found
          if (result.files.length === 0) {
            console.log('[Mode 2] No valid files found on drive - playing error sound')
            playErrorSound()
          }
          // UI will show confirmation dialog before starting transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          store.setScanError(error instanceof Error ? error.message : 'Auto-scan failed')
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
      useStore.getState().removeDrive(device)
    })

    const unsubTransferProgress = ipc.onTransferProgress((progress) => {
      useStore.getState().updateProgress(progress)
    })

    const unsubTransferComplete = ipc.onTransferComplete((data) => {
      console.log('Transfer complete:', data)
      const store = useStore.getState()
      store.completeTransfer()

      // Play success or error sound based on transfer status
      if (data.status === 'complete') {
        console.log('[SoundManager] Transfer completed successfully - playing success sound')
        playSuccessSound()
      } else {
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
      useStore.getState().failTransfer(error)

      // Play error sound when transfer fails
      console.log('[SoundManager] Transfer failed - playing error sound')
      playErrorSound()
    })

    const unsubLogEntry = ipc.onLogEntry((entry) => {
      useStore.getState().addLog(entry)
    })

    // Cleanup on unmount
    return () => {
      unsubDriveDetected()
      unsubDriveRemoved()
      unsubTransferProgress()
      unsubTransferComplete()
      unsubTransferError()
      unsubLogEntry()
      cleanupSoundManager()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  return null
}
