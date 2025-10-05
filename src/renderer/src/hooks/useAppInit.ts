/**
 * App Initialization Hook
 * Loads initial data and sets up event listeners
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'

/**
 * Hook to initialize the app
 * Loads config, sets up IPC listeners
 */
export function useAppInit() {
  const ipc = useIpc()

  useEffect(() => {
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

    // Initialize
    loadConfig()
    loadHistory()

    // Set up event listeners
    const unsubDriveDetected = ipc.onDriveDetected(async (drive) => {
      console.log('Drive detected:', drive)
      const store = useStore.getState()
      store.addDrive(drive)

      // Get current config to determine transfer mode
      const config = store.config

      // Mode-based auto-transfer logic
      if (config.transferMode === 'fully-autonomous' && config.defaultDestination) {
        // Mode 3: Fully autonomous - auto-scan and auto-transfer
        console.log('[Mode 3] Fully autonomous transfer starting...')
        try {
          store.setScanInProgress(true)
          const result = await ipc.scanDrive(drive.device)
          store.setScannedFiles(result.files)

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
          // UI will show files and user can set destination then click transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          store.setScanError(error instanceof Error ? error.message : 'Auto-scan failed')
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
          // UI will show confirmation dialog before starting transfer
        } catch (error) {
          console.error('Auto-scan failed:', error)
          store.setScanError(error instanceof Error ? error.message : 'Auto-scan failed')
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
      useStore.getState().completeTransfer()
    })

    const unsubTransferError = ipc.onTransferError((error) => {
      console.error('Transfer error:', error)
      useStore.getState().failTransfer(error)
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  return null
}
