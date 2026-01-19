/**
 * Tests for IPC handlers
 * Tests communication between main and renderer processes
 */

import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/types'

// Mock all dependencies before importing the module under test
jest.mock('electron')
jest.mock('../../src/main/configManager')
jest.mock('../../src/main/driveMonitor')
jest.mock('../../src/main/fileTransfer')
jest.mock('../../src/main/databaseManager')
jest.mock('../../src/main/logger')
jest.mock('../../src/main/pathProcessor')
jest.mock('../../src/main/pathValidator')
jest.mock('../../src/main/transferValidator')
jest.mock('../../src/main/menu')
jest.mock('../../src/main/updateChecker')
jest.mock('../../src/main/utils/ipcValidator')
jest.mock('../../src/main/utils/filenameUtils')
jest.mock('fs/promises')

import {
  getConfig,
  updateConfig,
  resetConfig,
  forceMigration,
  getVersionInfo,
  getNewerConfigWarning,
  handleNewerConfigChoice,
  clearNewerConfigWarning
} from '../../src/main/configManager'
import { DriveMonitor } from '../../src/main/driveMonitor'
import { FileTransferEngine } from '../../src/main/fileTransfer'
import { getDatabaseManager } from '../../src/main/databaseManager'
import { getLogger, onLogEntry } from '../../src/main/logger'
import { createPathProcessor } from '../../src/main/pathProcessor'
import { validatePath, hasEnoughSpace, checkDiskSpace } from '../../src/main/pathValidator'
import { validateTransfer } from '../../src/main/transferValidator'
import { updateMenuForTransferState } from '../../src/main/menu'
import { checkForUpdates, getReleasesUrl } from '../../src/main/updateChecker'
import {
  validateTransferStartRequest,
  validatePathValidationRequest,
  validateDeviceId,
  validateSessionId,
  validateLimit,
  validateLogLevel
} from '../../src/main/utils/ipcValidator'
import { stat } from 'fs/promises'

// Import the module under test after mocks are set up
import {
  setupIpcHandlers,
  startDriveMonitoring,
  stopDriveMonitoring,
  isTransferInProgress,
  cancelCurrentTransfer,
  cleanupIpc
} from '../../src/main/ipc'

// Type for captured handler
type IpcHandler = (event: any, ...args: any[]) => Promise<any>

// Store handlers for testing
const handlers: Map<string, IpcHandler> = new Map()

// Mock ipcMain to capture handlers
const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>
mockIpcMain.handle.mockImplementation((channel: string, handler: IpcHandler) => {
  handlers.set(channel, handler)
  return undefined as any
})

// Mock dialog
const mockDialog = dialog as jest.Mocked<typeof dialog>

// Mock configManager
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>
const mockUpdateConfig = updateConfig as jest.MockedFunction<typeof updateConfig>
const mockResetConfig = resetConfig as jest.MockedFunction<typeof resetConfig>
const mockForceMigration = forceMigration as jest.MockedFunction<typeof forceMigration>
const mockGetVersionInfo = getVersionInfo as jest.MockedFunction<typeof getVersionInfo>
const mockGetNewerConfigWarning = getNewerConfigWarning as jest.MockedFunction<
  typeof getNewerConfigWarning
>
const mockHandleNewerConfigChoice = handleNewerConfigChoice as jest.MockedFunction<
  typeof handleNewerConfigChoice
>
const mockClearNewerConfigWarning = clearNewerConfigWarning as jest.MockedFunction<
  typeof clearNewerConfigWarning
>

// Mock DriveMonitor
const mockDriveMonitor = {
  listRemovableDrives: jest.fn(),
  listSourceDrives: jest.fn(),
  scanForMedia: jest.fn(),
  unmountDrive: jest.fn(),
  start: jest.fn(),
  stop: jest.fn()
}
;(DriveMonitor as jest.Mock).mockImplementation(() => mockDriveMonitor)

// Mock FileTransferEngine
const mockTransferEngine = {
  transferFile: jest.fn(),
  transferFiles: jest.fn(),
  isTransferring: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn()
}
;(FileTransferEngine as jest.Mock).mockImplementation(() => mockTransferEngine)

// Mock DatabaseManager
const mockDb = {
  createTransferSession: jest.fn(),
  addFileToSession: jest.fn(),
  updateFileStatus: jest.fn(),
  updateTransferSession: jest.fn(),
  getAllTransferSessions: jest.fn(),
  getTransferSession: jest.fn(),
  clearTransferSessions: jest.fn(),
  getFilesByStatus: jest.fn()
}
;(getDatabaseManager as jest.Mock).mockReturnValue(mockDb)

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
  getRecent: jest.fn(),
  clear: jest.fn(),
  getByDateRange: jest.fn(),
  logTransferStart: jest.fn(),
  logTransferComplete: jest.fn(),
  logTransferError: jest.fn(),
  logDriveDetected: jest.fn(),
  logDriveRemoved: jest.fn()
}
;(getLogger as jest.Mock).mockReturnValue(mockLogger)
;(onLogEntry as jest.Mock).mockReturnValue(() => {})

// Mock pathProcessor
const mockPathProcessor = {
  processFilePath: jest.fn(),
  shouldTransferFile: jest.fn()
}
;(createPathProcessor as jest.Mock).mockReturnValue(mockPathProcessor)

// Mock validators
const mockValidatePath = validatePath as jest.MockedFunction<typeof validatePath>
const mockHasEnoughSpace = hasEnoughSpace as jest.MockedFunction<typeof hasEnoughSpace>
const mockCheckDiskSpace = checkDiskSpace as jest.MockedFunction<typeof checkDiskSpace>
const mockValidateTransfer = validateTransfer as jest.MockedFunction<typeof validateTransfer>
const _mockUpdateMenuForTransferState = updateMenuForTransferState as jest.MockedFunction<
  typeof updateMenuForTransferState
>
const mockCheckForUpdates = checkForUpdates as jest.MockedFunction<typeof checkForUpdates>
const mockGetReleasesUrl = getReleasesUrl as jest.MockedFunction<typeof getReleasesUrl>

// Mock IPC validators
const mockValidateTransferStartRequest = validateTransferStartRequest as jest.MockedFunction<
  typeof validateTransferStartRequest
>
const mockValidatePathValidationRequest = validatePathValidationRequest as jest.MockedFunction<
  typeof validatePathValidationRequest
>
const mockValidateDeviceId = validateDeviceId as jest.MockedFunction<typeof validateDeviceId>
const mockValidateSessionId = validateSessionId as jest.MockedFunction<typeof validateSessionId>
const mockValidateLimit = validateLimit as jest.MockedFunction<typeof validateLimit>
const mockValidateLogLevel = validateLogLevel as jest.MockedFunction<typeof validateLogLevel>

// Mock fs/promises
const mockStat = stat as jest.MockedFunction<typeof stat>

describe('IPC Handlers', () => {
  // Create mock event
  const mockEvent = {
    sender: {
      send: jest.fn()
    }
  }

  beforeAll(() => {
    // Setup handlers once
    setupIpcHandlers()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock returns
    mockGetConfig.mockReturnValue({
      defaultDestination: '/test/dest',
      mediaExtensions: ['.mp4', '.mov'],
      verifyChecksums: true,
      conflictResolution: 'ask',
      bufferSize: 64 * 1024
    } as any)

    mockValidateLogLevel.mockImplementation((level) => level as any)
    mockValidateLimit.mockImplementation((limit, defaultVal) =>
      typeof limit === 'number' ? limit : defaultVal
    )
    mockValidatePathValidationRequest.mockImplementation((req) => (req as any).path)
    mockValidateDeviceId.mockImplementation((id) => id as string)
    mockValidateSessionId.mockImplementation((id) => id as string)
  })

  describe('Configuration Handlers', () => {
    it('should handle CONFIG_GET', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_GET)
      expect(handler).toBeDefined()

      const mockConfig = { defaultDestination: '/test' }
      mockGetConfig.mockReturnValue(mockConfig as any)

      const result = await handler!(mockEvent)
      expect(result).toEqual(mockConfig)
      expect(mockGetConfig).toHaveBeenCalled()
    })

    it('should handle CONFIG_UPDATE with valid config', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_UPDATE)
      expect(handler).toBeDefined()

      const newConfig = { defaultDestination: '/new/dest' }
      const updatedConfig = { ...newConfig, mediaExtensions: ['.mp4'] }
      mockUpdateConfig.mockReturnValue(updatedConfig as any)
      mockLogger.getLevel.mockReturnValue('info')

      const result = await handler!(mockEvent, newConfig)
      expect(result).toEqual(updatedConfig)
      expect(mockUpdateConfig).toHaveBeenCalledWith(newConfig)
    })

    it('should handle CONFIG_UPDATE with logLevel change', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_UPDATE)

      const newConfig = { logLevel: 'debug' }
      mockUpdateConfig.mockReturnValue(newConfig as any)
      mockLogger.getLevel.mockReturnValue('info')

      await handler!(mockEvent, newConfig)

      expect(mockValidateLogLevel).toHaveBeenCalledWith('debug')
      expect(mockLogger.setLevel).toHaveBeenCalledWith('debug')
      expect(mockLogger.info).toHaveBeenCalledWith('Log level set', { from: 'info', to: 'debug' })
    })

    it('should throw error for invalid config in CONFIG_UPDATE', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_UPDATE)

      await expect(handler!(mockEvent, null)).rejects.toThrow('Config must be an object')
      await expect(handler!(mockEvent, 'string')).rejects.toThrow('Config must be an object')
    })

    it('should handle CONFIG_RESET', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_RESET)
      expect(handler).toBeDefined()

      const defaultConfig = { defaultDestination: '' }
      mockResetConfig.mockReturnValue(defaultConfig as any)

      const result = await handler!(mockEvent)
      expect(result).toEqual(defaultConfig)
      expect(mockResetConfig).toHaveBeenCalled()
    })

    it('should handle CONFIG_MIGRATE', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_MIGRATE)
      expect(handler).toBeDefined()

      const migratedConfig = { version: '2.0.0' }
      mockForceMigration.mockReturnValue(migratedConfig as any)

      const result = await handler!(mockEvent)
      expect(result).toEqual(migratedConfig)
      expect(mockForceMigration).toHaveBeenCalled()
    })

    it('should handle CONFIG_VERSION_INFO', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_VERSION_INFO)
      expect(handler).toBeDefined()

      const versionInfo = {
        appVersion: '2.0.0',
        configVersion: '2.0.0',
        isUpToDate: true
      }
      mockGetVersionInfo.mockReturnValue(versionInfo as any)

      const result = await handler!(mockEvent)
      expect(result).toEqual(versionInfo)
    })

    it('should handle CONFIG_NEWER_WARNING', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_NEWER_WARNING)
      expect(handler).toBeDefined()

      const warning = { configVersion: '3.0.0', appVersion: '2.0.0', timestamp: Date.now() }
      mockGetNewerConfigWarning.mockReturnValue(warning)

      const result = await handler!(mockEvent)
      expect(result).toEqual(warning)
    })

    it('should handle CONFIG_HANDLE_NEWER with valid choice', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_HANDLE_NEWER)
      expect(handler).toBeDefined()

      const config = { defaultDestination: '/test' }
      mockHandleNewerConfigChoice.mockReturnValue(config as any)

      const result = await handler!(mockEvent, 'continue')
      expect(result).toEqual(config)
      expect(mockHandleNewerConfigChoice).toHaveBeenCalledWith('continue')

      await handler!(mockEvent, 'reset')
      expect(mockHandleNewerConfigChoice).toHaveBeenCalledWith('reset')
    })

    it('should throw error for invalid choice in CONFIG_HANDLE_NEWER', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_HANDLE_NEWER)

      await expect(handler!(mockEvent, 'invalid')).rejects.toThrow(
        'Invalid choice. Must be "continue" or "reset"'
      )
    })

    it('should handle CONFIG_CLEAR_NEWER_WARNING', async () => {
      const handler = handlers.get(IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING)
      expect(handler).toBeDefined()

      await handler!(mockEvent)
      expect(mockClearNewerConfigWarning).toHaveBeenCalled()
    })
  })

  describe('Path Validation Handlers', () => {
    it('should handle PATH_VALIDATE', async () => {
      const handler = handlers.get(IPC_CHANNELS.PATH_VALIDATE)
      expect(handler).toBeDefined()

      const validationResult = { isValid: true, exists: true }
      mockValidatePath.mockResolvedValue(validationResult as any)

      const result = await handler!(mockEvent, { path: '/test/path' })
      expect(result).toEqual(validationResult)
      expect(mockValidatePathValidationRequest).toHaveBeenCalledWith({ path: '/test/path' })
    })

    it('should handle PATH_SELECT_FOLDER when user selects a folder', async () => {
      const handler = handlers.get(IPC_CHANNELS.PATH_SELECT_FOLDER)
      expect(handler).toBeDefined()

      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/folder']
      })

      const result = await handler!(mockEvent)
      expect(result).toBe('/selected/folder')
    })

    it('should handle PATH_SELECT_FOLDER when user cancels', async () => {
      const handler = handlers.get(IPC_CHANNELS.PATH_SELECT_FOLDER)

      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      })

      const result = await handler!(mockEvent)
      expect(result).toBeNull()
    })
  })

  describe('Drive Operation Handlers', () => {
    it('should handle DRIVE_LIST', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_LIST)
      expect(handler).toBeDefined()

      const drives = [{ device: '/dev/disk1', displayName: 'USB Drive' }]
      mockDriveMonitor.listSourceDrives.mockResolvedValue(drives)

      const result = await handler!(mockEvent)
      expect(result).toEqual(drives)
    })

    it('should handle DRIVE_SCAN successfully', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_SCAN)
      expect(handler).toBeDefined()

      const drives = [{ device: '/dev/disk1', displayName: 'USB', mountpoints: ['/Volumes/USB'] }]
      mockDriveMonitor.listSourceDrives.mockResolvedValue(drives)
      mockDriveMonitor.scanForMedia.mockResolvedValue({
        files: ['/Volumes/USB/video.mp4'],
        fileCount: 1
      })

      const result = await handler!(mockEvent, '/dev/disk1')
      expect(result).toHaveProperty('driveInfo')
      expect(result).toHaveProperty('fileCount', 1)
    })

    it('should handle DRIVE_SCAN when drive not found', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_SCAN)

      mockDriveMonitor.listSourceDrives.mockResolvedValue([])

      await expect(handler!(mockEvent, '/dev/disk99')).rejects.toThrow('Drive not found')
    })

    it('should handle DRIVE_SCAN with retry when not mounted', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_SCAN)

      // First call - not mounted, second call - mounted
      const unmountedDrive = { device: '/dev/disk1', displayName: 'USB', mountpoints: [] }
      const mountedDrive = {
        device: '/dev/disk1',
        displayName: 'USB',
        mountpoints: ['/Volumes/USB']
      }

      mockDriveMonitor.listSourceDrives
        .mockResolvedValueOnce([unmountedDrive])
        .mockResolvedValueOnce([mountedDrive])

      mockDriveMonitor.scanForMedia.mockResolvedValue({
        files: [],
        fileCount: 0
      })

      const result = await handler!(mockEvent, '/dev/disk1')
      expect(result).toHaveProperty('driveInfo')
    })

    it('should handle DRIVE_UNMOUNT successfully', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_UNMOUNT)
      expect(handler).toBeDefined()

      mockDriveMonitor.unmountDrive.mockResolvedValue(true)

      const result = await handler!(mockEvent, '/dev/disk1')
      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('Drive unmounted successfully', {
        device: '/dev/disk1'
      })
    })

    it('should handle DRIVE_UNMOUNT failure', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_UNMOUNT)

      mockDriveMonitor.unmountDrive.mockResolvedValue(false)

      const result = await handler!(mockEvent, '/dev/disk1')
      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to unmount drive', {
        device: '/dev/disk1'
      })
    })

    it('should handle DRIVE_UNMOUNT error', async () => {
      const handler = handlers.get(IPC_CHANNELS.DRIVE_UNMOUNT)

      mockDriveMonitor.unmountDrive.mockRejectedValue(new Error('Device busy'))

      const result = await handler!(mockEvent, '/dev/disk1')
      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('Transfer Validation Handler', () => {
    it('should handle TRANSFER_VALIDATE', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_VALIDATE)
      expect(handler).toBeDefined()

      mockPathProcessor.processFilePath.mockResolvedValue({
        destinationPath: '/dest/file.mp4'
      })

      mockValidateTransfer.mockResolvedValue({
        isValid: true,
        canProceed: true,
        requiresConfirmation: false,
        warnings: [],
        conflicts: []
      } as any)

      const request = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/file.mp4'],
        driveInfo: { displayName: 'USB' }
      }

      const result = await handler!(mockEvent, request)
      expect(result.isValid).toBe(true)
    })

    it('should throw error for invalid TRANSFER_VALIDATE request', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_VALIDATE)

      await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid validation request')
      await expect(handler!(mockEvent, { sourceRoot: 123 })).rejects.toThrow(
        'sourceRoot is required'
      )
      await expect(handler!(mockEvent, { sourceRoot: '/src' })).rejects.toThrow(
        'destinationRoot is required'
      )
      await expect(
        handler!(mockEvent, { sourceRoot: '/src', destinationRoot: '/dest' })
      ).rejects.toThrow('files must be an array')
    })
  })

  describe('Transfer Status Handler', () => {
    it('should handle TRANSFER_STATUS when not transferring', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_STATUS)
      expect(handler).toBeDefined()

      mockTransferEngine.isTransferring.mockReturnValue(false)

      const result = await handler!(mockEvent)
      expect(result).toEqual({ isTransferring: false, isPaused: false })
    })
  })

  describe('Transfer Start Handler', () => {
    it('should handle TRANSFER_START successfully', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)
      expect(handler).toBeDefined()

      // Setup mocks for full transfer flow
      const validatedRequest = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/video.mp4'],
        driveInfo: { device: '/dev/disk1', displayName: 'USB Drive' }
      }
      mockValidateTransferStartRequest.mockReturnValue(validatedRequest)

      mockPathProcessor.shouldTransferFile.mockReturnValue(true)
      mockPathProcessor.processFilePath.mockResolvedValue({
        destinationPath: '/dest/video.mp4'
      })

      mockStat.mockResolvedValue({ size: 1000 } as any)
      mockHasEnoughSpace.mockResolvedValue(true)

      mockDb.createTransferSession.mockReturnValue('session-123')
      mockDb.getFilesByStatus.mockReturnValue([])

      // Mock transfer to resolve successfully
      mockTransferEngine.transferFiles.mockResolvedValue([
        {
          success: true,
          sourcePath: '/source/video.mp4',
          destPath: '/dest/video.mp4',
          bytesTransferred: 1000,
          sourceChecksum: 'abc123'
        }
      ])
      mockTransferEngine.isTransferring.mockReturnValue(false)

      await handler!(mockEvent, validatedRequest)

      expect(mockValidateTransferStartRequest).toHaveBeenCalledWith(validatedRequest)
      expect(mockDb.createTransferSession).toHaveBeenCalled()
      expect(mockTransferEngine.transferFiles).toHaveBeenCalled()
    })

    it('should reject TRANSFER_START when transfer already in progress', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)

      mockTransferEngine.isTransferring.mockReturnValue(true)

      await expect(handler!(mockEvent, {})).rejects.toThrow('transfer is already in progress')
    })

    it('should handle TRANSFER_START with insufficient space', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)

      const validatedRequest = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/big-video.mp4'],
        driveInfo: { device: '/dev/disk1', displayName: 'USB Drive' }
      }
      mockValidateTransferStartRequest.mockReturnValue(validatedRequest)
      mockTransferEngine.isTransferring.mockReturnValue(false)

      mockPathProcessor.shouldTransferFile.mockReturnValue(true)
      mockPathProcessor.processFilePath.mockResolvedValue({
        destinationPath: '/dest/big-video.mp4'
      })

      mockStat.mockResolvedValue({ size: 10 * 1024 * 1024 * 1024 } as any) // 10GB
      mockHasEnoughSpace.mockResolvedValue(false)
      mockCheckDiskSpace.mockResolvedValue({
        freeSpace: 1 * 1024 * 1024 * 1024,
        totalSpace: 10 * 1024 * 1024 * 1024
      }) // 1GB free

      await expect(handler!(mockEvent, validatedRequest)).rejects.toThrow('Insufficient disk space')
    })

    it('should handle TRANSFER_START validation error', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)

      mockTransferEngine.isTransferring.mockReturnValue(false)
      mockValidateTransferStartRequest.mockImplementation(() => {
        throw new Error('Invalid request format')
      })

      await expect(handler!(mockEvent, {})).rejects.toThrow('Invalid request format')
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[IPC] Transfer request validation failed',
        expect.any(Object)
      )
    })

    it('should handle path processing fallback', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)

      const validatedRequest = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/video.mp4'],
        driveInfo: { device: '/dev/disk1', displayName: 'USB Drive' }
      }
      mockValidateTransferStartRequest.mockReturnValue(validatedRequest)
      mockTransferEngine.isTransferring.mockReturnValue(false)

      mockPathProcessor.shouldTransferFile.mockReturnValue(true)
      mockPathProcessor.processFilePath.mockRejectedValue(new Error('Path processing failed'))

      mockStat.mockResolvedValue({ size: 1000 } as any)
      mockHasEnoughSpace.mockResolvedValue(true)
      mockDb.createTransferSession.mockReturnValue('session-123')
      mockDb.getFilesByStatus.mockReturnValue([])

      mockTransferEngine.transferFiles.mockResolvedValue([
        {
          success: true,
          sourcePath: '/source/video.mp4',
          destPath: '/dest/video.mp4',
          bytesTransferred: 1000
        }
      ])

      await handler!(mockEvent, validatedRequest)

      // Should use fallback path
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to process path', expect.any(Object))
    })

    it('should handle conflict resolution skip', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_START)

      const validatedRequest = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/video.mp4'],
        driveInfo: { device: '/dev/disk1', displayName: 'USB Drive' },
        conflictResolutions: { '/source/video.mp4': 'skip' }
      }
      mockValidateTransferStartRequest.mockReturnValue(validatedRequest)
      mockTransferEngine.isTransferring.mockReturnValue(false)

      mockPathProcessor.shouldTransferFile.mockReturnValue(true)
      mockPathProcessor.processFilePath.mockResolvedValue({
        destinationPath: '/dest/video.mp4'
      })

      mockStat.mockResolvedValue({ size: 1000 } as any)
      mockHasEnoughSpace.mockResolvedValue(true)
      mockDb.createTransferSession.mockReturnValue('session-123')
      mockDb.getFilesByStatus.mockReturnValue([])

      // When file is skipped, transferFiles gets empty array
      mockTransferEngine.transferFiles.mockResolvedValue([])

      await handler!(mockEvent, validatedRequest)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TransferService] Skipping file due to conflict resolution',
        expect.any(Object)
      )
    })
  })

  describe('Transfer Retry Handler', () => {
    it('should handle TRANSFER_RETRY successfully', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_RETRY)
      expect(handler).toBeDefined()

      const request = {
        files: [{ sourcePath: '/source/video.mp4', destinationPath: '/dest/video.mp4' }],
        driveInfo: { device: '/dev/disk1', displayName: 'USB Drive' }
      }

      mockTransferEngine.isTransferring.mockReturnValue(false)
      mockStat.mockResolvedValue({ size: 1000 } as any)
      mockDb.createTransferSession.mockReturnValue('retry-session-123')

      mockTransferEngine.transferFiles.mockResolvedValue([
        {
          success: true,
          sourcePath: '/source/video.mp4',
          destPath: '/dest/video.mp4',
          bytesTransferred: 1000
        }
      ])

      await handler!(mockEvent, request)

      expect(mockDb.createTransferSession).toHaveBeenCalled()
      expect(mockTransferEngine.transferFiles).toHaveBeenCalled()
    })

    it('should reject TRANSFER_RETRY when transfer in progress', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_RETRY)

      mockTransferEngine.isTransferring.mockReturnValue(true)

      await expect(handler!(mockEvent, { files: [], driveInfo: {} })).rejects.toThrow(
        'transfer is already in progress'
      )
    })

    it('should throw error for invalid TRANSFER_RETRY request', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_RETRY)

      mockTransferEngine.isTransferring.mockReturnValue(false)

      await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid retry request')
      await expect(handler!(mockEvent, { files: [] })).rejects.toThrow('No files to retry')
      await expect(handler!(mockEvent, { files: [{}] })).rejects.toThrow('Invalid drive info')
    })
  })

  describe('Transfer Stop Handler', () => {
    it('should handle TRANSFER_STOP when no transfer is running', async () => {
      const handler = handlers.get(IPC_CHANNELS.TRANSFER_STOP)
      expect(handler).toBeDefined()

      // When no transfer engine exists, handler should complete without error
      await handler!(mockEvent)
      // No error thrown means success
    })
  })

  describe('History Handlers', () => {
    it('should handle HISTORY_GET_ALL', async () => {
      const handler = handlers.get(IPC_CHANNELS.HISTORY_GET_ALL)
      expect(handler).toBeDefined()

      const sessions = [{ id: '1', status: 'complete' }]
      mockDb.getAllTransferSessions.mockReturnValue(sessions)

      const result = await handler!(mockEvent)
      expect(result).toEqual(sessions)
    })

    it('should handle HISTORY_GET_BY_ID', async () => {
      const handler = handlers.get(IPC_CHANNELS.HISTORY_GET_BY_ID)
      expect(handler).toBeDefined()

      const session = { id: '123', status: 'complete' }
      mockDb.getTransferSession.mockReturnValue(session)

      const result = await handler!(mockEvent, '123')
      expect(result).toEqual(session)
      expect(mockValidateSessionId).toHaveBeenCalledWith('123')
    })

    it('should handle HISTORY_CLEAR', async () => {
      const handler = handlers.get(IPC_CHANNELS.HISTORY_CLEAR)
      expect(handler).toBeDefined()

      mockDb.clearTransferSessions.mockReturnValue(5)

      const result = await handler!(mockEvent)
      expect(result).toEqual({ success: true, deletedCount: 5 })
      expect(mockLogger.info).toHaveBeenCalledWith('Transfer history cleared', { deletedCount: 5 })
    })

    it('should handle HISTORY_CLEAR error', async () => {
      const handler = handlers.get(IPC_CHANNELS.HISTORY_CLEAR)

      mockDb.clearTransferSessions.mockImplementation(() => {
        throw new Error('Database error')
      })

      await expect(handler!(mockEvent)).rejects.toThrow('Database error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('Logging Handlers', () => {
    it('should handle LOG_GET_RECENT', async () => {
      const handler = handlers.get(IPC_CHANNELS.LOG_GET_RECENT)
      expect(handler).toBeDefined()

      const logs = [{ level: 'info', message: 'test' }]
      mockLogger.getRecent.mockReturnValue(logs)

      const result = await handler!(mockEvent, 100)
      expect(result).toEqual(logs)
      expect(mockValidateLimit).toHaveBeenCalledWith(100, 10000)
    })

    it('should handle LOG_CLEAR', async () => {
      const handler = handlers.get(IPC_CHANNELS.LOG_CLEAR)
      expect(handler).toBeDefined()

      await handler!(mockEvent)
      expect(mockLogger.clear).toHaveBeenCalled()
    })

    it('should handle log:get-range', async () => {
      const handler = handlers.get('log:get-range')
      expect(handler).toBeDefined()

      const logs = [{ level: 'info', message: 'test', timestamp: 1000 }]
      mockLogger.getByDateRange.mockReturnValue(logs)

      const result = await handler!(mockEvent, { startTime: 0, endTime: 2000 })
      expect(result).toEqual(logs)
    })

    it('should handle log:get-range with level filter', async () => {
      const handler = handlers.get('log:get-range')

      const logs = [
        { level: 'info', message: 'info log', timestamp: 1000 },
        { level: 'error', message: 'error log', timestamp: 1500 }
      ]
      mockLogger.getByDateRange.mockReturnValue(logs)

      const result = await handler!(mockEvent, { startTime: 0, endTime: 2000, level: 'error' })
      expect(result).toEqual([{ level: 'error', message: 'error log', timestamp: 1500 }])
    })

    it('should throw error for invalid log:get-range arguments', async () => {
      const handler = handlers.get('log:get-range')

      await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid arguments')
      await expect(handler!(mockEvent, { startTime: 'invalid' })).rejects.toThrow(
        'Invalid date range'
      )
      await expect(handler!(mockEvent, { startTime: 100, endTime: 50 })).rejects.toThrow(
        'Invalid date range values'
      )
    })
  })

  describe('System Handlers', () => {
    it('should handle APP_VERSION', async () => {
      const handler = handlers.get(IPC_CHANNELS.APP_VERSION)
      expect(handler).toBeDefined()

      const result = await handler!(mockEvent)
      expect(result).toBe('2.0.1-beta.0')
    })
  })

  describe('Menu Action Handlers', () => {
    it('should handle MENU_OPEN_DESTINATION', async () => {
      const handler = handlers.get(IPC_CHANNELS.MENU_OPEN_DESTINATION)
      expect(handler).toBeDefined()

      mockGetConfig.mockReturnValue({ defaultDestination: '/test/dest' } as any)

      await handler!(mockEvent)
      // shell.openPath should be called (mocked in electron mock)
    })

    it('should handle MENU_CANCEL_TRANSFER when no transfer is running', async () => {
      const handler = handlers.get(IPC_CHANNELS.MENU_CANCEL_TRANSFER)
      expect(handler).toBeDefined()

      // When no transfer engine exists, handler should complete without error
      await handler!(mockEvent)
      // No error thrown means success
    })

    it('should handle MENU_CHECK_UPDATES', async () => {
      const handler = handlers.get(IPC_CHANNELS.MENU_CHECK_UPDATES)
      expect(handler).toBeDefined()

      mockDialog.showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false }) // Cancel

      await handler!(mockEvent)
      expect(mockDialog.showMessageBox).toHaveBeenCalled()
    })
  })

  describe('Update Handlers', () => {
    it('should handle UPDATE_CHECK', async () => {
      const handler = handlers.get(IPC_CHANNELS.UPDATE_CHECK)
      expect(handler).toBeDefined()

      const updateResult = { hasUpdate: true, latestVersion: '3.0.0' }
      mockCheckForUpdates.mockResolvedValue(updateResult as any)

      const result = await handler!(mockEvent, true)
      expect(result).toEqual(updateResult)
      expect(mockCheckForUpdates).toHaveBeenCalledWith(true)
    })

    it('should handle UPDATE_OPEN_RELEASES', async () => {
      const handler = handlers.get(IPC_CHANNELS.UPDATE_OPEN_RELEASES)
      expect(handler).toBeDefined()

      mockGetReleasesUrl.mockReturnValue('https://github.com/test/releases')

      await handler!(mockEvent)
      expect(mockGetReleasesUrl).toHaveBeenCalled()
    })
  })
})

describe('IPC Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('startDriveMonitoring', () => {
    it('should start drive monitoring with callbacks', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)
      ;(onLogEntry as jest.Mock).mockReturnValue(jest.fn())

      startDriveMonitoring(mockWindow)

      expect(DriveMonitor).toHaveBeenCalled()
      expect(mockDriveMonitor.start).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingInterval: 2000,
          onDriveAdded: expect.any(Function),
          onDriveRemoved: expect.any(Function)
        })
      )
    })

    it('should stop existing monitor before starting new one', () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      // Start once
      startDriveMonitoring(mockWindow)

      // Start again - should stop existing
      startDriveMonitoring(mockWindow)

      expect(mockDriveMonitor.stop).toHaveBeenCalled()
    })

    it('should send update available notification when update exists', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      const updateResult = { hasUpdate: true, latestVersion: '3.0.0', currentVersion: '2.0.0' }
      mockCheckForUpdates.mockResolvedValue(updateResult as any)

      startDriveMonitoring(mockWindow)

      // Wait for the async update check
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.UPDATE_AVAILABLE,
        updateResult
      )
    })

    it('should handle drive monitoring start error', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockRejectedValue(new Error('Failed to start'))
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      startDriveMonitoring(mockWindow)

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start drive monitoring',
        expect.any(Object)
      )
    })

    it('should handle update check failure gracefully', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      mockCheckForUpdates.mockRejectedValue(new Error('Network error'))

      startDriveMonitoring(mockWindow)

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Startup update check failed',
        expect.any(Object)
      )
    })

    it('should trigger onDriveAdded callback', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      let capturedOnDriveAdded: ((drive: any) => void) | undefined
      mockDriveMonitor.start.mockImplementation(async (options: any) => {
        capturedOnDriveAdded = options.onDriveAdded
      })
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      startDriveMonitoring(mockWindow)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Simulate drive added
      const drive = { device: '/dev/disk1', displayName: 'USB Drive' }
      capturedOnDriveAdded!(drive)

      expect(mockLogger.logDriveDetected).toHaveBeenCalledWith('/dev/disk1', 'USB Drive')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.DRIVE_DETECTED, drive)
    })

    it('should trigger onDriveRemoved callback', async () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      let capturedOnDriveRemoved: ((device: string) => void) | undefined
      mockDriveMonitor.start.mockImplementation(async (options: any) => {
        capturedOnDriveRemoved = options.onDriveRemoved
      })
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      startDriveMonitoring(mockWindow)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Simulate drive removed
      capturedOnDriveRemoved!('/dev/disk1')

      expect(mockLogger.logDriveRemoved).toHaveBeenCalledWith('/dev/disk1')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.DRIVE_REMOVED,
        '/dev/disk1'
      )
    })
  })

  describe('stopDriveMonitoring', () => {
    it('should stop drive monitoring', () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      startDriveMonitoring(mockWindow)
      stopDriveMonitoring()

      expect(mockDriveMonitor.stop).toHaveBeenCalled()
    })

    it('should handle stop error gracefully', () => {
      const mockWindow = {
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        once: jest.fn()
      } as any

      mockDriveMonitor.start.mockResolvedValue(undefined)
      mockDriveMonitor.stop.mockImplementation(() => {
        throw new Error('Stop error')
      })
      mockCheckForUpdates.mockResolvedValue({ hasUpdate: false } as any)

      startDriveMonitoring(mockWindow)
      stopDriveMonitoring()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error stopping drive monitor',
        expect.any(Object)
      )
    })
  })

  describe('isTransferInProgress', () => {
    it('should return false when no engine', () => {
      expect(isTransferInProgress()).toBe(false)
    })
  })

  describe('cancelCurrentTransfer', () => {
    it('should cancel transfer if engine exists', async () => {
      mockTransferEngine.stop.mockResolvedValue(undefined)

      // Need to trigger a transfer to create engine instance
      // For now just test the function doesn't throw
      await cancelCurrentTransfer()
    })
  })

  describe('cleanupIpc', () => {
    it('should cleanup all resources', async () => {
      mockTransferEngine.stop.mockResolvedValue(undefined)

      await cleanupIpc()

      expect(mockIpcMain.removeHandler).toHaveBeenCalled()
    })
  })
})
