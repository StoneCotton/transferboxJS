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
  const {
    setConfig,
    setLoading,
    setError,
    addDrive,
    removeDrive,
    updateProgress,
    completeTransfer,
    failTransfer,
    setHistory
  } = useStore()

  useEffect(() => {
    // Load initial configuration
    const loadConfig = async () => {
      setLoading(true)
      try {
        const config = await ipc.getConfig()
        setConfig(config)
      } catch (error) {
        console.error('Failed to load config:', error)
        setError(error instanceof Error ? error.message : 'Failed to load configuration')
      }
    }

    // Load transfer history
    const loadHistory = async () => {
      try {
        const history = await ipc.getHistory()
        setHistory(history)
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }

    // Initialize
    loadConfig()
    loadHistory()

    // Set up event listeners
    const unsubDriveDetected = ipc.onDriveDetected((drive) => {
      console.log('Drive detected:', drive)
      addDrive(drive)
    })

    const unsubDriveRemoved = ipc.onDriveRemoved((device) => {
      console.log('Drive removed:', device)
      removeDrive(device)
    })

    const unsubTransferProgress = ipc.onTransferProgress((progress) => {
      updateProgress(progress)
    })

    const unsubTransferComplete = ipc.onTransferComplete((data) => {
      console.log('Transfer complete:', data)
      completeTransfer()
    })

    const unsubTransferError = ipc.onTransferError((error) => {
      console.error('Transfer error:', error)
      failTransfer(error)
    })

    // Cleanup on unmount
    return () => {
      unsubDriveDetected()
      unsubDriveRemoved()
      unsubTransferProgress()
      unsubTransferComplete()
      unsubTransferError()
    }
  }, [ipc]) // Only run once on mount

  return null
}
