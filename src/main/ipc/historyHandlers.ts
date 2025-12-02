/**
 * History IPC Handlers
 * Handles all HISTORY_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getDatabaseManager } from '../databaseManager'
import { getLogger } from '../logger'
import { validateSessionId } from '../utils/ipcValidator'

/**
 * Setup all history-related IPC handlers
 */
export function setupHistoryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_ALL, async () => {
    const db = getDatabaseManager()
    return db.getAllTransferSessions()
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_BY_ID, async (_, id: unknown) => {
    const validatedId = validateSessionId(id)
    const db = getDatabaseManager()
    return db.getTransferSession(validatedId)
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async () => {
    try {
      const db = getDatabaseManager()
      const deletedCount = db.clearTransferSessions()
      getLogger().info('Transfer history cleared', { deletedCount })
      return { success: true, deletedCount }
    } catch (error) {
      getLogger().error('Failed to clear transfer history', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  })
}
