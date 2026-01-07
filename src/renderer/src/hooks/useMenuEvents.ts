/**
 * Menu Event Handlers Hook
 * Sets up listeners for menu-triggered actions
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'

/**
 * Hook to handle menu events from the main process
 */
export function useMenuEvents(): void {
  const ipc = useIpc()

  useEffect(() => {
    const unsubMenuOpenSettings = ipc.onMenuOpenSettings(() => {
      console.log('[useMenuEvents] Menu: Open Settings')
      const store = useStore.getState()
      if (!store.showSettings) {
        store.toggleSettings()
      }
    })

    const unsubMenuOpenHistory = ipc.onMenuOpenHistory(() => {
      console.log('[useMenuEvents] Menu: Open History')
      const store = useStore.getState()
      if (!store.showHistory) {
        store.toggleHistory()
      }
    })

    const unsubMenuNewTransfer = ipc.onMenuNewTransfer(() => {
      console.log('[useMenuEvents] Menu: New Transfer - focusing on drive selector')
      const store = useStore.getState()
      // Reset current transfer state
      store.selectDrive(null)
      store.clearScan()
      store.setSelectedDestination(null)
      // Close any open modals
      store.closeAllModals()
    })

    const unsubMenuSelectDestination = ipc.onMenuSelectDestination(() => {
      console.log('[useMenuEvents] Menu: Select Destination - opening folder picker')
      const store = useStore.getState()

      const handleSelectFolder = async (): Promise<void> => {
        try {
          const folder = await ipc.selectFolder()
          if (folder) {
            const validation = await ipc.validatePath({ path: folder })

            if (validation.isValid) {
              store.setSelectedDestination(folder)
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

    return () => {
      unsubMenuOpenSettings()
      unsubMenuOpenHistory()
      unsubMenuNewTransfer()
      unsubMenuSelectDestination()
    }
  }, [ipc])
}
