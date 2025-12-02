/**
 * Configuration IPC Handlers
 * Handles all CONFIG_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import {
  getConfig,
  updateConfig,
  resetConfig,
  forceMigration,
  getVersionInfo,
  getNewerConfigWarning,
  handleNewerConfigChoice,
  clearNewerConfigWarning
} from '../configManager'
import { getLogger } from '../logger'
import { validateLogLevel } from '../utils/ipcValidator'

/**
 * Setup all configuration-related IPC handlers
 */
export function setupConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, async (_, config: unknown) => {
    if (!config || typeof config !== 'object') {
      throw new Error('Config must be an object')
    }
    const configObj = config as Record<string, unknown>
    const updated = updateConfig(configObj as Partial<typeof configObj>)

    // If logLevel changed, apply to logger immediately
    if (configObj && 'logLevel' in configObj && configObj.logLevel) {
      const validatedLogLevel = validateLogLevel(configObj.logLevel)
      const logger = getLogger()
      const previous = logger.getLevel()
      logger.setLevel(validatedLogLevel)
      if (previous !== validatedLogLevel) {
        logger.info('Log level set', { from: previous, to: validatedLogLevel })
      }
    }
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async () => {
    return resetConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_MIGRATE, async () => {
    return forceMigration()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_VERSION_INFO, async () => {
    return getVersionInfo()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_NEWER_WARNING, async () => {
    return getNewerConfigWarning()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_HANDLE_NEWER, async (_, choice: unknown) => {
    if (choice !== 'continue' && choice !== 'reset') {
      throw new Error('Invalid choice. Must be "continue" or "reset"')
    }
    return handleNewerConfigChoice(choice)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING, async () => {
    clearNewerConfigWarning()
  })
}
