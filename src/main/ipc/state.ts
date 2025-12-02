/**
 * Shared IPC State Module
 * Holds global state shared across all IPC handlers
 */

import type { BrowserWindow } from 'electron'
import type { DriveMonitor } from '../driveMonitor'
import type { FileTransferEngine } from '../fileTransfer'
import type { PathProcessor } from '../pathProcessor'

/**
 * Global state shared across IPC handlers
 * This module provides centralized state management for the IPC layer
 */
export interface IpcState {
  driveMonitor: DriveMonitor | null
  transferEngine: FileTransferEngine | null
  pathProcessor: PathProcessor | null
  mainWindow: BrowserWindow | null
}

// Module-level state (singleton pattern)
const state: IpcState = {
  driveMonitor: null,
  transferEngine: null,
  pathProcessor: null,
  mainWindow: null
}

/**
 * Get the current IPC state
 */
export function getIpcState(): IpcState {
  return state
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
 * Get transfer engine instance
 */
export function getTransferEngine(): FileTransferEngine | null {
  return state.transferEngine
}

/**
 * Set transfer engine instance
 */
export function setTransferEngine(engine: FileTransferEngine | null): void {
  state.transferEngine = engine
}

/**
 * Get path processor instance
 */
export function getPathProcessor(): PathProcessor | null {
  return state.pathProcessor
}

/**
 * Set path processor instance
 */
export function setPathProcessor(processor: PathProcessor | null): void {
  state.pathProcessor = processor
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
  state.transferEngine = null
  state.pathProcessor = null
  state.mainWindow = null
}

