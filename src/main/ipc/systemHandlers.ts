/**
 * System IPC Handlers
 * Handles SYSTEM_*, APP_*, and MENU_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getConfig } from '../configManager'
import { getLogger } from '../logger'
import { updateMenuForTransferState } from '../menu'
import { getTransferService } from '../services/transferService'

/**
 * Setup all system-related IPC handlers
 */
export function setupSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_SHUTDOWN, async () => {
    const { app } = await import('electron')
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.APP_VERSION, async () => {
    const { app } = await import('electron')
    return app.getVersion()
  })

  ipcMain.handle(IPC_CHANNELS.MENU_OPEN_DESTINATION, async () => {
    const config = getConfig()
    if (config.defaultDestination) {
      const { shell } = await import('electron')
      await shell.openPath(config.defaultDestination)
    }
  })

  ipcMain.handle(IPC_CHANNELS.MENU_CANCEL_TRANSFER, async () => {
    const transferService = getTransferService()
    if (transferService.isTransferring()) {
      await transferService.stop()
      getLogger().info('Transfer cancelled by user via menu')
    }
  })

  ipcMain.handle(IPC_CHANNELS.MENU_CHECK_UPDATES, async () => {
    const { dialog, shell } = await import('electron')
    const currentVersion = (await import('electron')).app.getVersion()

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Check for Updates',
      message: 'Check for Updates',
      detail: `Current version: ${currentVersion}\n\nVisit the releases page to check for updates?`,
      buttons: ['Visit Releases', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      await shell.openExternal('https://github.com/tylersaari/transferbox/releases')
    }
  })
}
