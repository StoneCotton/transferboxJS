/**
 * Shared IPC State Module
 * Holds global state shared across all IPC handlers
 */

import type { BrowserWindow } from 'electron'
import type { DriveMonitor } from '../driveMonitor'

/**
 * Global state shared across IPC handlers
 * This module provides centralized state management for the IPC layer
 * Note: TransferEngine and PathProcessor are managed by TransferService
 */
interface IpcState {
  driveMonitor: DriveMonitor | null
  mainWindow: BrowserWindow | null
}

// Module-level state (singleton pattern)
const state: IpcState = {
  driveMonitor: null,
  mainWindow: null
}

/**
 * Get drive monitor instance
 */
export function getDriveMonitor(): DriveMonitor | null {
  return state.driveMonitor
}

/**
 * Set drive monitor instance
 */
export function setDriveMonitor(monitor: DriveMonitor | null): void {
  state.driveMonitor = monitor
}

/**
 * Get main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

/**
 * Set main window instance
 */
export function setMainWindow(window: BrowserWindow | null): void {
  state.mainWindow = window
}

/**
 * Reset all state (useful for cleanup)
 */
export function resetIpcState(): void {
  state.driveMonitor = null
  state.mainWindow = null
}
