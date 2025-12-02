/**
 * Path IPC Handlers
 * Handles all PATH_* IPC channels
 */

import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { validatePath } from '../pathValidator'
import { validatePathValidationRequest } from '../utils/ipcValidator'

/**
 * Setup all path-related IPC handlers
 */
export function setupPathHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PATH_VALIDATE, async (_, request: unknown) => {
    const validatedPath = validatePathValidationRequest(request)
    return validatePath(validatedPath)
  })

  ipcMain.handle(IPC_CHANNELS.PATH_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })
}

