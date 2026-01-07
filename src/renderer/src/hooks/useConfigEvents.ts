/**
 * Config & Update Event Handlers Hook
 * Handles config migration and update availability events
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'

/**
 * Hook to handle config and update events
 */
export function useConfigEvents(): void {
  const ipc = useIpc()

  useEffect(() => {
    const unsubConfigMigrated = ipc.onConfigMigrated((data) => {
      console.log('[useConfigEvents] Config migrated:', data)
      const store = useStore.getState()
      store.addToast({
        type: 'success',
        message: `Configuration updated from version ${data.fromVersion} to ${data.toVersion}`,
        duration: 6000
      })
    })

    const unsubUpdateAvailable = ipc.onUpdateAvailable((result) => {
      console.log('[useConfigEvents] Update available:', result)
      if (result.hasUpdate) {
        const store = useStore.getState()
        store.addToast({
          type: 'info',
          message: `Update available: v${result.latestVersion} — Click the download button in the header to get it!`,
          duration: 8000
        })
      }
    })

    const unsubLogEntry = ipc.onLogEntry((entry) => {
      useStore.getState().addLog(entry)
    })

    return () => {
      unsubConfigMigrated()
      unsubUpdateAvailable()
      unsubLogEntry()
    }
  }, [ipc])
}
