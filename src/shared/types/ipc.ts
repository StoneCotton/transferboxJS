/**
 * IPC channel definitions and payloads
 * Used for type-safe communication between main and renderer processes
 */

import type { AppConfig } from './config'
import type { TransferProgress, TransferSession } from './transfer'
import type { DriveInfo, ScannedMedia } from './drive'

// IPC Channel names
export const IPC_CHANNELS = {
  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  CONFIG_RESET: 'config:reset',
  CONFIG_MIGRATE: 'config:migrate',
  CONFIG_VERSION_INFO: 'config:version-info',
  CONFIG_NEWER_WARNING: 'config:newer-warning',
  CONFIG_HANDLE_NEWER: 'config:handle-newer',
  CONFIG_CLEAR_NEWER_WARNING: 'config:clear-newer-warning',
  CONFIG_MIGRATED: 'config:migrated', // Event from main to renderer

  // Path validation
  PATH_VALIDATE: 'path:validate',
  PATH_SELECT_FOLDER: 'path:select-folder',

  // Drive operations
  DRIVE_LIST: 'drive:list',
  DRIVE_SCAN: 'drive:scan',
  DRIVE_UNMOUNT: 'drive:unmount',
  DRIVE_DETECTED: 'drive:detected', // Event from main to renderer
  DRIVE_REMOVED: 'drive:removed', // Event from main to renderer
  DRIVE_UNMOUNTED: 'drive:unmounted', // Event from main to renderer when drive is unmounted but still connected

  // Transfer operations
  TRANSFER_VALIDATE: 'transfer:validate', // Pre-transfer validation
  TRANSFER_START: 'transfer:start',
  TRANSFER_STOP: 'transfer:stop',
  TRANSFER_STATUS: 'transfer:status',
  TRANSFER_PROGRESS: 'transfer:progress', // Event from main to renderer
  TRANSFER_COMPLETE: 'transfer:complete', // Event from main to renderer
  TRANSFER_ERROR: 'transfer:error', // Event from main to renderer

  // Transfer history
  HISTORY_GET_ALL: 'history:get-all',
  HISTORY_GET_BY_ID: 'history:get-by-id',
  HISTORY_CLEAR: 'history:clear',

  // Logging
  LOG_GET_RECENT: 'log:get-recent',
  LOG_CLEAR: 'log:clear',
  LOG_ENTRY: 'log:entry', // Event from main to renderer

  // System
  SYSTEM_SHUTDOWN: 'system:shutdown',
  SYSTEM_SUSPEND: 'system:suspend', // Event from main to renderer
  SYSTEM_RESUME: 'system:resume', // Event from main to renderer
  APP_VERSION: 'app:version',

  // Menu actions
  MENU_OPEN_SETTINGS: 'menu:open-settings', // Event from main to renderer
  MENU_OPEN_HISTORY: 'menu:open-history', // Event from main to renderer
  MENU_OPEN_DESTINATION: 'menu:open-destination',
  MENU_CANCEL_TRANSFER: 'menu:cancel-transfer',
  MENU_NEW_TRANSFER: 'menu:new-transfer', // Event from main to renderer
  MENU_SELECT_DESTINATION: 'menu:select-destination', // Event from main to renderer
  MENU_CHECK_UPDATES: 'menu:check-updates',

  // Update checking
  UPDATE_CHECK: 'update:check', // Invoke to check for updates
  UPDATE_AVAILABLE: 'update:available', // Event from main to renderer
  UPDATE_OPEN_RELEASES: 'update:open-releases' // Open GitHub releases page
} as const

// Request/Response types for each IPC channel

export interface PathValidationRequest {
  path: string
}

export interface PathValidationResponse {
  isValid: boolean
  exists: boolean
  isWritable: boolean
  isSystem: boolean
  hasSpace: boolean
  availableSpace: number
  error?: string
}

export interface TransferStartRequest {
  sourceRoot: string
  destinationRoot: string
  driveInfo: DriveInfo
  files: string[]
  conflictResolutions?: Record<string, ConflictResolutionChoice>
}

/**
 * Conflict resolution choice for a specific file
 */
export type ConflictResolutionChoice = 'skip' | 'rename' | 'overwrite'

/**
 * File conflict information
 */
export interface FileConflictInfo {
  sourcePath: string
  destinationPath: string
  fileName: string
  sourceSize: number
  sourceModified: number
  existingSize: number
  existingModified: number
}

/**
 * Validation warning types
 */
export type ValidationWarningType =
  | 'same_directory'
  | 'nested_source_in_dest'
  | 'nested_dest_in_source'
  | 'insufficient_space'
  | 'file_conflicts'

/**
 * Validation warning structure
 */
export interface ValidationWarning {
  type: ValidationWarningType
  message: string
  details?: Record<string, unknown>
}

/**
 * Pre-transfer validation request
 */
export interface TransferValidateRequest {
  sourceRoot: string
  destinationRoot: string
  driveInfo: DriveInfo
  files: string[]
}

/**
 * Pre-transfer validation response
 */
export interface TransferValidateResponse {
  isValid: boolean
  canProceed: boolean
  requiresConfirmation: boolean
  warnings: ValidationWarning[]
  conflicts: FileConflictInfo[]
  spaceRequired: number
  spaceAvailable: number
  error?: string
}

export interface TransferStatusResponse {
  isTransferring: boolean
}

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  context?: Record<string, unknown>
}

/** Update check result */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string | null
  publishedAt: string | null
}

// Type definitions for IPC handlers
export interface IpcHandlers {
  [IPC_CHANNELS.CONFIG_GET]: () => Promise<AppConfig>
  [IPC_CHANNELS.CONFIG_UPDATE]: (config: Partial<AppConfig>) => Promise<AppConfig>
  [IPC_CHANNELS.CONFIG_RESET]: () => Promise<AppConfig>
  [IPC_CHANNELS.CONFIG_MIGRATE]: () => Promise<AppConfig>
  [IPC_CHANNELS.CONFIG_VERSION_INFO]: () => Promise<{
    appVersion: string
    configVersion: string
    isUpToDate: boolean
    needsMigration: boolean
    hasNewerConfigWarning: boolean
  }>
  [IPC_CHANNELS.CONFIG_NEWER_WARNING]: () => Promise<{
    configVersion: string
    appVersion: string
    timestamp: number
  } | null>
  [IPC_CHANNELS.CONFIG_HANDLE_NEWER]: (choice: 'continue' | 'reset') => Promise<AppConfig>
  [IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING]: () => Promise<void>

  [IPC_CHANNELS.PATH_VALIDATE]: (request: PathValidationRequest) => Promise<PathValidationResponse>
  [IPC_CHANNELS.PATH_SELECT_FOLDER]: () => Promise<string | null>

  [IPC_CHANNELS.DRIVE_LIST]: () => Promise<DriveInfo[]>
  [IPC_CHANNELS.DRIVE_SCAN]: (device: string) => Promise<ScannedMedia>
  [IPC_CHANNELS.DRIVE_UNMOUNT]: (device: string) => Promise<boolean>

  [IPC_CHANNELS.TRANSFER_VALIDATE]: (request: TransferValidateRequest) => Promise<TransferValidateResponse>
  [IPC_CHANNELS.TRANSFER_START]: (request: TransferStartRequest) => Promise<void>
  [IPC_CHANNELS.TRANSFER_STOP]: () => Promise<void>
  [IPC_CHANNELS.TRANSFER_STATUS]: () => Promise<TransferStatusResponse>

  [IPC_CHANNELS.HISTORY_GET_ALL]: () => Promise<TransferSession[]>
  [IPC_CHANNELS.HISTORY_GET_BY_ID]: (id: string) => Promise<TransferSession | null>
  [IPC_CHANNELS.HISTORY_CLEAR]: () => Promise<void>

  [IPC_CHANNELS.LOG_GET_RECENT]: (limit?: number) => Promise<LogEntry[]>
  [IPC_CHANNELS.LOG_CLEAR]: () => Promise<void>

  [IPC_CHANNELS.SYSTEM_SHUTDOWN]: () => Promise<void>
  [IPC_CHANNELS.APP_VERSION]: () => Promise<string>

  [IPC_CHANNELS.MENU_OPEN_DESTINATION]: () => Promise<void>
  [IPC_CHANNELS.MENU_CANCEL_TRANSFER]: () => Promise<void>
  [IPC_CHANNELS.MENU_CHECK_UPDATES]: () => Promise<void>

  [IPC_CHANNELS.UPDATE_CHECK]: () => Promise<UpdateCheckResult>
  [IPC_CHANNELS.UPDATE_OPEN_RELEASES]: () => Promise<void>
}

// Event listeners (main -> renderer)
export interface IpcEvents {
  [IPC_CHANNELS.DRIVE_DETECTED]: (driveInfo: DriveInfo) => void
  [IPC_CHANNELS.DRIVE_REMOVED]: (device: string) => void
  [IPC_CHANNELS.DRIVE_UNMOUNTED]: (device: string) => void
  [IPC_CHANNELS.TRANSFER_PROGRESS]: (progress: TransferProgress) => void
  [IPC_CHANNELS.TRANSFER_COMPLETE]: (session: TransferSession) => void
  [IPC_CHANNELS.TRANSFER_ERROR]: (error: string) => void
  [IPC_CHANNELS.LOG_ENTRY]: (entry: LogEntry) => void
  [IPC_CHANNELS.SYSTEM_SUSPEND]: () => void
  [IPC_CHANNELS.SYSTEM_RESUME]: () => void
  [IPC_CHANNELS.MENU_OPEN_SETTINGS]: () => void
  [IPC_CHANNELS.MENU_OPEN_HISTORY]: () => void
  [IPC_CHANNELS.MENU_NEW_TRANSFER]: () => void
  [IPC_CHANNELS.MENU_SELECT_DESTINATION]: () => void
  [IPC_CHANNELS.CONFIG_MIGRATED]: (data: { fromVersion: string; toVersion: string }) => void
  [IPC_CHANNELS.UPDATE_AVAILABLE]: (result: UpdateCheckResult) => void
}
