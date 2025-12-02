/**
 * Update IPC Handlers
 * Handles all UPDATE_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { checkForUpdates, getReleasesUrl } from '../updateChecker'

/**
 * Setup all update-related IPC handlers
 */
export function setupUpdateHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async (_, forceRefresh?: boolean) => {
    return checkForUpdates(forceRefresh ?? false)
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_OPEN_RELEASES, async () => {
    const { shell } = await import('electron')
    await shell.openExternal(getReleasesUrl())
  })
}
