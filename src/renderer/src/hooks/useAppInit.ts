/**
 * App Initialization Hook
 * Orchestrates initial data loading and sets up event listeners
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'
import { useDriveEvents } from './useDriveEvents'
import { useTransferEvents } from './useTransferEvents'
import { useMenuEvents } from './useMenuEvents'
import { useSystemEvents } from './useSystemEvents'
import { useConfigEvents } from './useConfigEvents'
import { initSoundManager, cleanupSoundManager } from '../utils/soundManager'

/**
 * Hook to initialize the app
 * Loads config, history, drives and sets up all event listeners
 */
export function useAppInit(): null {
  const ipc = useIpc()

  // Set up domain-specific event listeners
  useDriveEvents()
  useTransferEvents()
  useMenuEvents()
  useSystemEvents()
  useConfigEvents()

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

    // Cleanup on unmount
    return () => {
      cleanupSoundManager()
    }
  }, [ipc])

  return null
}
