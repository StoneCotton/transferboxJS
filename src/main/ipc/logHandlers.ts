/**
 * Log IPC Handlers
 * Handles all LOG_* IPC channels
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getLogger } from '../logger'
import { validateLimit, validateLogLevel } from '../utils/ipcValidator'

/**
 * Setup all logging-related IPC handlers
 */
export function setupLogHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LOG_GET_RECENT, async (_, limit?: unknown) => {
    const validatedLimit = validateLimit(limit, 10000)
    return getLogger().getRecent(validatedLimit)
  })

  ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, async () => {
    getLogger().clear()
  })

  // Log range export handler
  ipcMain.handle(IPC_CHANNELS.LOG_GET_RANGE, async (_e, args: unknown) => {
    const logger = getLogger()
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments')
    }
    const argObj = args as Record<string, unknown>
    const startTime = argObj.startTime
    const endTime = argObj.endTime
    const level = argObj.level

    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
      throw new Error('Invalid date range')
    }

    // Validate date range values
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
      throw new Error('Invalid date range values')
    }

    if (level !== undefined) {
      const validatedLevel = validateLogLevel(level)
      // Filter by level within range
      const range = logger.getByDateRange(startTime, endTime)
      return range.filter((l) => l.level === validatedLevel)
    }
    return logger.getByDateRange(startTime, endTime)
  })
}
