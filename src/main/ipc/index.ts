/**
 * IPC Communication Setup
 * Orchestrates all IPC handlers between main and renderer processes
 */

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { DriveMonitor } from '../driveMonitor'
import { getLogger, onLogEntry } from '../logger'
import { checkForUpdates } from '../updateChecker'
import { updateMenuForTransferState } from '../menu'
import { getTransferService } from '../services/transferService'

// Import handler modules
import { setupConfigHandlers } from './configHandlers'
import { setupPathHandlers } from './pathHandlers'
import { setupDriveHandlers } from './driveHandlers'
import { setupTransferHandlers } from './transferHandlers'
import { setupHistoryHandlers } from './historyHandlers'
import { setupLogHandlers } from './logHandlers'
import { setupSystemHandlers } from './systemHandlers'
import { setupUpdateHandlers } from './updateHandlers'

// Import state management
import {
  getDriveMonitor,
  setDriveMonitor,
  getMainWindow,
  setMainWindow,
  resetIpcState
} from './state'

/**
 * Setup all IPC handlers
 * Call this once when the app starts
 */
export function setupIpcHandlers(): void {
  // Setup all handler modules
  setupConfigHandlers()
  setupPathHandlers()
  setupDriveHandlers()
  setupTransferHandlers()
  setupHistoryHandlers()
  setupLogHandlers()
  setupSystemHandlers()
  setupUpdateHandlers()
}

/**
 * Start drive monitoring with IPC events
 */
export function startDriveMonitoring(window: BrowserWindow): void {
  let monitor = getDriveMonitor()
  if (monitor) {
    monitor.stop()
  }

  monitor = new DriveMonitor()
  setDriveMonitor(monitor)
  setMainWindow(window)

  // Stream log entries to renderer
  try {
    const unsubscribe = onLogEntry((entry) => {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry)
      }
    })
    // Ensure we clean up when window is destroyed
    window.once('closed', () => unsubscribe())
  } catch {
    // No-op if streaming setup fails
  }

  // Check for updates on startup and notify renderer if available
  checkForUpdates()
    .then((result) => {
      const mainWindow = getMainWindow()
      if (result.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        getLogger().info('Update available', {
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        })
        mainWindow.webContents.send(IPC_CHANNELS.UPDATE_AVAILABLE, result)
      }
    })
    .catch((error) => {
      getLogger().warn('Startup update check failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    })

  monitor
    .start({
      pollingInterval: 2000,
      onDriveAdded: (drive) => {
        getLogger().logDriveDetected(drive.device, drive.displayName)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_DETECTED, drive)
        }
      },
      onDriveRemoved: (device) => {
        getLogger().logDriveRemoved(device)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DRIVE_REMOVED, device)
        }
      }
    })
    .catch((error) => {
      getLogger().error('Failed to start drive monitoring', { error: error.message })
    })
}

/**
 * Stop drive monitoring
 */
export function stopDriveMonitoring(): void {
  const monitor = getDriveMonitor()
  if (monitor) {
    try {
      monitor.stop()
    } catch (error) {
      getLogger().warn('Error stopping drive monitor', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    setDriveMonitor(null)
  }
}

/**
 * Check if transfers are currently in progress
 */
export function isTransferInProgress(): boolean {
  return getTransferService().isTransferring()
}

/**
 * Cancel the current transfer (for use by menu or other main process code)
 */
export async function cancelCurrentTransfer(): Promise<void> {
  const transferService = getTransferService()
  await transferService.stop()
  getLogger().info('Transfer cancelled by user via menu')
  updateMenuForTransferState(false)
}

/**
 * Cleanup IPC handlers
 * Call this when the app is closing
 */
export async function cleanupIpc(): Promise<void> {
  stopDriveMonitoring()

  const transferService = getTransferService()
  await transferService.stop()

  // Reset state
  resetIpcState()

  // Remove all handlers
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel)
  })
}

// Re-export state functions for external use
export { getMainWindow, setMainWindow } from './state'

