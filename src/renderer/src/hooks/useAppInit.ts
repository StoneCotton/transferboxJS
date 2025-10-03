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
    const unsubDriveDetected = ipc.onDriveDetected((drive) => {
      console.log('Drive detected:', drive)
      useStore.getState().addDrive(drive)
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

    // Cleanup on unmount
    return () => {
      unsubDriveDetected()
      unsubDriveRemoved()
      unsubTransferProgress()
      unsubTransferComplete()
      unsubTransferError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  return null
}
