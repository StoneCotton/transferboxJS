/**
 * System Event Handlers Hook
 * Handles system suspend/resume and other system-level events
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'

/**
 * Hook to handle system power events
 */
export function useSystemEvents(): void {
  const ipc = useIpc()

  useEffect(() => {
    const unsubSystemSuspend = ipc.onSystemSuspend(() => {
      console.log('[useSystemEvents] System suspending')
      const store = useStore.getState()
      store.setSystemSleeping(true)

      // Show warning if transfer is active
      if (store.isTransferring) {
        console.log('[useSystemEvents] Transfer active during suspend - warning user')
        store.addToast({
          type: 'warning',
          message: 'System is suspending - transfer may be interrupted',
          duration: 5000
        })
      }
    })

    const unsubSystemResume = ipc.onSystemResume(() => {
      console.log('[useSystemEvents] System resumed')
      const store = useStore.getState()
      store.setSystemSleeping(false)

      store.addToast({
        type: 'info',
        message: 'System resumed - checking transfer status',
        duration: 5000
      })
    })

    return () => {
      unsubSystemSuspend()
      unsubSystemResume()
    }
  }, [ipc])
}
