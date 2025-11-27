/**
 * Preload API Tests
 * Tests for the preload script that exposes Electron APIs to the renderer
 */

import { ipcRenderer, contextBridge } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/types'

// Mock @electron-toolkit/preload
jest.mock('@electron-toolkit/preload', () => ({
  electronAPI: {
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      send: jest.fn()
    }
  }
}))

// Set contextIsolated to true before importing the preload module
Object.defineProperty(process, 'contextIsolated', {
  value: true,
  configurable: true
})

// Import the actual preload module to get coverage
// This will execute the module code and call contextBridge.exposeInMainWorld
import '../../src/preload/index'

// Helper to get the actual exposed API from contextBridge mock
const getExposedApi = () => {
  const calls = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls
  const apiCall = calls.find((call) => call[0] === 'api')
  return apiCall ? apiCall[1] : null
}

// These tests run BEFORE beforeEach clears mocks - they verify the initial module load
describe('Preload Module Loading', () => {
  it('should expose APIs via contextBridge when context isolated', () => {
    // The preload module was imported at the top of the file with contextIsolated = true
    // This verifies that contextBridge.exposeInMainWorld was called during module initialization
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electron', expect.any(Object))
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object))
  })

  it('should expose both electron and api namespaces', () => {
    // Verify that both calls were made with correct namespace keys
    const calls = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls
    const namespaces = calls.map((call) => call[0])

    expect(namespaces).toContain('electron')
    expect(namespaces).toContain('api')
  })

  it('should expose api object with all required methods', () => {
    // Verify the api object has the expected structure
    const calls = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls
    const apiCall = calls.find((call) => call[0] === 'api')
    expect(apiCall).toBeDefined()

    const exposedApi = apiCall[1]
    // Check that all expected methods are present
    expect(typeof exposedApi.getConfig).toBe('function')
    expect(typeof exposedApi.updateConfig).toBe('function')
    expect(typeof exposedApi.listDrives).toBe('function')
    expect(typeof exposedApi.startTransfer).toBe('function')
    expect(typeof exposedApi.onDriveDetected).toBe('function')
    expect(typeof exposedApi.onTransferProgress).toBe('function')
  })
})

describe('Preload API - Using Actual Exposed API', () => {
  // Get the actual API exposed via contextBridge for real coverage
  const exposedApi = getExposedApi()

  beforeEach(() => {
    // Only clear ipcRenderer mocks, not contextBridge (which was called during module load)
    ;(ipcRenderer.invoke as jest.Mock).mockClear()
    ;(ipcRenderer.on as jest.Mock).mockClear()
    ;(ipcRenderer.removeListener as jest.Mock).mockClear()
  })

  describe('Configuration API', () => {
    it('should invoke getConfig channel', async () => {
      const mockConfig = { transferMode: 'manual' }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(mockConfig)

      const result = await exposedApi.getConfig()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_GET)
      expect(result).toEqual(mockConfig)
    })

    it('should invoke updateConfig channel with config', async () => {
      const newConfig = { transferMode: 'auto-transfer' }
      const updatedConfig = { ...newConfig, folderStructure: 'preserve-source' }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(updatedConfig)

      const result = await exposedApi.updateConfig(newConfig)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_UPDATE, newConfig)
      expect(result).toEqual(updatedConfig)
    })

    it('should invoke resetConfig channel', async () => {
      const defaultConfig = { transferMode: 'manual' }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(defaultConfig)

      const result = await exposedApi.resetConfig()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_RESET)
      expect(result).toEqual(defaultConfig)
    })

    it('should invoke migrateConfig channel', async () => {
      const migratedConfig = { transferMode: 'manual' }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(migratedConfig)

      const result = await exposedApi.migrateConfig()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_MIGRATE)
      expect(result).toEqual(migratedConfig)
    })

    it('should invoke getVersionInfo channel', async () => {
      const versionInfo = {
        appVersion: '2.0.0',
        configVersion: '2',
        isUpToDate: true,
        needsMigration: false,
        hasNewerConfigWarning: false
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(versionInfo)

      const result = await exposedApi.getVersionInfo()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_VERSION_INFO)
      expect(result).toEqual(versionInfo)
    })

    it('should invoke getNewerConfigWarning channel', async () => {
      const warning = { configVersion: '3.0', appVersion: '2.0', timestamp: Date.now() }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(warning)

      const result = await exposedApi.getNewerConfigWarning()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_NEWER_WARNING)
      expect(result).toEqual(warning)
    })

    it('should invoke handleNewerConfigChoice channel with choice', async () => {
      const config = { transferMode: 'manual' }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(config)

      const result = await exposedApi.handleNewerConfigChoice('reset')

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_HANDLE_NEWER, 'reset')
      expect(result).toEqual(config)
    })

    it('should invoke clearNewerConfigWarning channel', async () => {
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.clearNewerConfigWarning()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_CLEAR_NEWER_WARNING)
    })
  })

  describe('Path Validation API', () => {
    it('should invoke validatePath channel with request', async () => {
      const request = { path: '/test/path' }
      const response = {
        isValid: true,
        exists: true,
        isWritable: true,
        isSystem: false,
        hasSpace: true,
        availableSpace: 1000000
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(response)

      const result = await exposedApi.validatePath(request)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PATH_VALIDATE, request)
      expect(result).toEqual(response)
    })

    it('should invoke selectFolder channel', async () => {
      const selectedPath = '/selected/folder'
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(selectedPath)

      const result = await exposedApi.selectFolder()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PATH_SELECT_FOLDER)
      expect(result).toBe(selectedPath)
    })
  })

  describe('Drive Operations API', () => {
    it('should invoke listDrives channel', async () => {
      const drives = [{ device: '/dev/sda1', displayName: 'Drive 1' }]
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(drives)

      const result = await exposedApi.listDrives()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.DRIVE_LIST)
      expect(result).toEqual(drives)
    })

    it('should invoke scanDrive channel with device', async () => {
      const device = '/dev/sda1'
      const scannedMedia = { files: ['file1.mp4', 'file2.mov'] }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(scannedMedia)

      const result = await exposedApi.scanDrive(device)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.DRIVE_SCAN, device)
      expect(result).toEqual(scannedMedia)
    })

    it('should invoke unmountDrive channel with device', async () => {
      const device = '/dev/sda1'
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(true)

      const result = await exposedApi.unmountDrive(device)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.DRIVE_UNMOUNT, device)
      expect(result).toBe(true)
    })
  })

  describe('Transfer Operations API', () => {
    it('should invoke validateTransfer channel with request', async () => {
      const request = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        driveInfo: { device: '/dev/sda1' },
        files: ['file1.mp4']
      }
      const response = {
        isValid: true,
        canProceed: true,
        requiresConfirmation: false,
        warnings: [],
        conflicts: [],
        spaceRequired: 1000,
        spaceAvailable: 10000
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(response)

      const result = await exposedApi.validateTransfer(request)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER_VALIDATE, request)
      expect(result).toEqual(response)
    })

    it('should invoke startTransfer channel with request', async () => {
      const request = {
        sourceRoot: '/source',
        destinationRoot: '/dest',
        driveInfo: { device: '/dev/sda1' },
        files: ['file1.mp4']
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.startTransfer(request)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER_START, request)
    })

    it('should invoke stopTransfer channel', async () => {
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.stopTransfer()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER_STOP)
    })

    it('should invoke getTransferStatus channel', async () => {
      const status = { isTransferring: true }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(status)

      const result = await exposedApi.getTransferStatus()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER_STATUS)
      expect(result).toEqual(status)
    })

    it('should invoke retryTransfer channel with request', async () => {
      const request = {
        files: [{ sourcePath: '/source/file.mp4', destinationPath: '/dest/file.mp4' }],
        driveInfo: { device: '/dev/sda1', displayName: 'Drive 1' }
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.retryTransfer(request)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER_RETRY, request)
    })
  })

  describe('History API', () => {
    it('should invoke getHistory channel', async () => {
      const history = [{ id: '1', timestamp: Date.now() }]
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(history)

      const result = await exposedApi.getHistory()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.HISTORY_GET_ALL)
      expect(result).toEqual(history)
    })

    it('should invoke getHistoryById channel with id', async () => {
      const id = 'session-123'
      const session = { id, timestamp: Date.now() }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(session)

      const result = await exposedApi.getHistoryById(id)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.HISTORY_GET_BY_ID, id)
      expect(result).toEqual(session)
    })

    it('should invoke clearHistory channel', async () => {
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.clearHistory()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.HISTORY_CLEAR)
    })
  })

  describe('Logs API', () => {
    it('should invoke getRecentLogs channel without limit', async () => {
      const logs = [{ timestamp: Date.now(), level: 'info', message: 'Test' }]
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(logs)

      const result = await exposedApi.getRecentLogs()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.LOG_GET_RECENT, undefined)
      expect(result).toEqual(logs)
    })

    it('should invoke getRecentLogs channel with limit', async () => {
      const logs = [{ timestamp: Date.now(), level: 'info', message: 'Test' }]
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(logs)

      const result = await exposedApi.getRecentLogs(50)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.LOG_GET_RECENT, 50)
      expect(result).toEqual(logs)
    })

    it('should invoke clearLogs channel', async () => {
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.clearLogs()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.LOG_CLEAR)
    })

    it('should invoke getLogsByRange channel with parameters', async () => {
      const logs = [{ timestamp: Date.now(), level: 'info', message: 'Test' }]
      const startTime = Date.now() - 3600000
      const endTime = Date.now()
      const level = 'error'
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(logs)

      const result = await exposedApi.getLogsByRange(startTime, endTime, level)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('log:get-range', {
        startTime,
        endTime,
        level
      })
      expect(result).toEqual(logs)
    })
  })

  describe('App Info API', () => {
    it('should invoke getAppVersion channel', async () => {
      const version = '2.0.1'
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(version)

      const result = await exposedApi.getAppVersion()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_VERSION)
      expect(result).toBe(version)
    })
  })

  describe('Update Checking API', () => {
    it('should invoke checkForUpdates channel without forceRefresh', async () => {
      const updateResult = {
        hasUpdate: false,
        currentVersion: '2.0.0',
        latestVersion: '2.0.0'
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(updateResult)

      const result = await exposedApi.checkForUpdates()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_CHECK, undefined)
      expect(result).toEqual(updateResult)
    })

    it('should invoke checkForUpdates channel with forceRefresh', async () => {
      const updateResult = {
        hasUpdate: true,
        currentVersion: '2.0.0',
        latestVersion: '2.1.0'
      }
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(updateResult)

      const result = await exposedApi.checkForUpdates(true)

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_CHECK, true)
      expect(result).toEqual(updateResult)
    })

    it('should invoke openReleasesPage channel', async () => {
      ;(ipcRenderer.invoke as jest.Mock).mockResolvedValue(undefined)

      await exposedApi.openReleasesPage()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_OPEN_RELEASES)
    })
  })

  describe('Event Listeners', () => {
    describe('onDriveDetected', () => {
      it('should register listener for DRIVE_DETECTED channel', () => {
        const callback = jest.fn()

        exposedApi.onDriveDetected(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_DETECTED,
          expect.any(Function)
        )
      })

      it('should call callback with drive data when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, drive: any) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, drive: any) => void) => {
            if (channel === IPC_CHANNELS.DRIVE_DETECTED) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onDriveDetected(callback)

        const mockDrive = { device: '/dev/sda1', displayName: 'Test Drive' }
        capturedListener({}, mockDrive)

        expect(callback).toHaveBeenCalledWith(mockDrive)
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onDriveDetected(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_DETECTED,
          expect.any(Function)
        )
      })
    })

    describe('onDriveRemoved', () => {
      it('should register listener for DRIVE_REMOVED channel', () => {
        const callback = jest.fn()

        exposedApi.onDriveRemoved(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_REMOVED,
          expect.any(Function)
        )
      })

      it('should call callback with device when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, device: string) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, device: string) => void) => {
            if (channel === IPC_CHANNELS.DRIVE_REMOVED) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onDriveRemoved(callback)
        capturedListener({}, '/dev/sda1')

        expect(callback).toHaveBeenCalledWith('/dev/sda1')
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onDriveRemoved(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_REMOVED,
          expect.any(Function)
        )
      })
    })

    describe('onDriveUnmounted', () => {
      it('should register listener for DRIVE_UNMOUNTED channel', () => {
        const callback = jest.fn()

        exposedApi.onDriveUnmounted(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_UNMOUNTED,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onDriveUnmounted(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.DRIVE_UNMOUNTED,
          expect.any(Function)
        )
      })
    })

    describe('onTransferProgress', () => {
      it('should register listener for TRANSFER_PROGRESS channel', () => {
        const callback = jest.fn()

        exposedApi.onTransferProgress(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_PROGRESS,
          expect.any(Function)
        )
      })

      it('should call callback with progress data when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, progress: any) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, progress: any) => void) => {
            if (channel === IPC_CHANNELS.TRANSFER_PROGRESS) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onTransferProgress(callback)

        const mockProgress = { currentFile: 'test.mp4', percent: 50 }
        capturedListener({}, mockProgress)

        expect(callback).toHaveBeenCalledWith(mockProgress)
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onTransferProgress(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_PROGRESS,
          expect.any(Function)
        )
      })
    })

    describe('onTransferComplete', () => {
      it('should register listener for TRANSFER_COMPLETE channel', () => {
        const callback = jest.fn()

        exposedApi.onTransferComplete(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_COMPLETE,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onTransferComplete(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_COMPLETE,
          expect.any(Function)
        )
      })
    })

    describe('onTransferError', () => {
      it('should register listener for TRANSFER_ERROR channel', () => {
        const callback = jest.fn()

        exposedApi.onTransferError(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_ERROR,
          expect.any(Function)
        )
      })

      it('should call callback with error message when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, error: string) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, error: string) => void) => {
            if (channel === IPC_CHANNELS.TRANSFER_ERROR) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onTransferError(callback)
        capturedListener({}, 'Transfer failed: disk full')

        expect(callback).toHaveBeenCalledWith('Transfer failed: disk full')
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onTransferError(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.TRANSFER_ERROR,
          expect.any(Function)
        )
      })
    })

    describe('onLogEntry', () => {
      it('should register listener for LOG_ENTRY channel', () => {
        const callback = jest.fn()

        exposedApi.onLogEntry(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(IPC_CHANNELS.LOG_ENTRY, expect.any(Function))
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onLogEntry(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.LOG_ENTRY,
          expect.any(Function)
        )
      })
    })

    describe('onSystemSuspend', () => {
      it('should register listener for SYSTEM_SUSPEND channel', () => {
        const callback = jest.fn()

        exposedApi.onSystemSuspend(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.SYSTEM_SUSPEND,
          expect.any(Function)
        )
      })

      it('should call callback without arguments when event fires', () => {
        const callback = jest.fn()
        let capturedListener: () => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation((channel: string, listener: () => void) => {
          if (channel === IPC_CHANNELS.SYSTEM_SUSPEND) {
            capturedListener = listener
          }
        })

        exposedApi.onSystemSuspend(callback)
        capturedListener()

        expect(callback).toHaveBeenCalled()
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onSystemSuspend(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.SYSTEM_SUSPEND,
          expect.any(Function)
        )
      })
    })

    describe('onSystemResume', () => {
      it('should register listener for SYSTEM_RESUME channel', () => {
        const callback = jest.fn()

        exposedApi.onSystemResume(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(IPC_CHANNELS.SYSTEM_RESUME, expect.any(Function))
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onSystemResume(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.SYSTEM_RESUME,
          expect.any(Function)
        )
      })
    })

    describe('onMenuOpenSettings', () => {
      it('should register listener for MENU_OPEN_SETTINGS channel', () => {
        const callback = jest.fn()

        exposedApi.onMenuOpenSettings(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_OPEN_SETTINGS,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onMenuOpenSettings(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_OPEN_SETTINGS,
          expect.any(Function)
        )
      })
    })

    describe('onMenuOpenHistory', () => {
      it('should register listener for MENU_OPEN_HISTORY channel', () => {
        const callback = jest.fn()

        exposedApi.onMenuOpenHistory(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_OPEN_HISTORY,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onMenuOpenHistory(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_OPEN_HISTORY,
          expect.any(Function)
        )
      })
    })

    describe('onMenuNewTransfer', () => {
      it('should register listener for MENU_NEW_TRANSFER channel', () => {
        const callback = jest.fn()

        exposedApi.onMenuNewTransfer(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_NEW_TRANSFER,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onMenuNewTransfer(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_NEW_TRANSFER,
          expect.any(Function)
        )
      })
    })

    describe('onMenuSelectDestination', () => {
      it('should register listener for MENU_SELECT_DESTINATION channel', () => {
        const callback = jest.fn()

        exposedApi.onMenuSelectDestination(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_SELECT_DESTINATION,
          expect.any(Function)
        )
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onMenuSelectDestination(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.MENU_SELECT_DESTINATION,
          expect.any(Function)
        )
      })
    })

    describe('onConfigMigrated', () => {
      it('should register listener for CONFIG_MIGRATED channel', () => {
        const callback = jest.fn()

        exposedApi.onConfigMigrated(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.CONFIG_MIGRATED,
          expect.any(Function)
        )
      })

      it('should call callback with migration data when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, data: { fromVersion: string; toVersion: string }) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, data: { fromVersion: string; toVersion: string }) => void) => {
            if (channel === IPC_CHANNELS.CONFIG_MIGRATED) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onConfigMigrated(callback)

        const migrationData = { fromVersion: '1.0', toVersion: '2.0' }
        capturedListener({}, migrationData)

        expect(callback).toHaveBeenCalledWith(migrationData)
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onConfigMigrated(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.CONFIG_MIGRATED,
          expect.any(Function)
        )
      })
    })

    describe('onUpdateAvailable', () => {
      it('should register listener for UPDATE_AVAILABLE channel', () => {
        const callback = jest.fn()

        exposedApi.onUpdateAvailable(callback)

        expect(ipcRenderer.on).toHaveBeenCalledWith(
          IPC_CHANNELS.UPDATE_AVAILABLE,
          expect.any(Function)
        )
      })

      it('should call callback with update result when event fires', () => {
        const callback = jest.fn()
        let capturedListener: (_event: any, result: any) => void = () => {}

        ;(ipcRenderer.on as jest.Mock).mockImplementation(
          (channel: string, listener: (_event: any, result: any) => void) => {
            if (channel === IPC_CHANNELS.UPDATE_AVAILABLE) {
              capturedListener = listener
            }
          }
        )

        exposedApi.onUpdateAvailable(callback)

        const updateResult = { hasUpdate: true, latestVersion: '2.1.0' }
        capturedListener({}, updateResult)

        expect(callback).toHaveBeenCalledWith(updateResult)
      })

      it('should return cleanup function that removes listener', () => {
        const callback = jest.fn()

        const cleanup = exposedApi.onUpdateAvailable(callback)
        cleanup()

        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
          IPC_CHANNELS.UPDATE_AVAILABLE,
          expect.any(Function)
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('should propagate IPC invoke errors', async () => {
      const error = new Error('IPC communication failed')
      ;(ipcRenderer.invoke as jest.Mock).mockRejectedValue(error)

      await expect(exposedApi.getConfig()).rejects.toThrow('IPC communication failed')
    })

    it('should handle multiple simultaneous invocations', async () => {
      const configResult = { transferMode: 'manual' }
      const drivesResult = [{ device: '/dev/sda1' }]

      ;(ipcRenderer.invoke as jest.Mock).mockImplementation((channel: string) => {
        if (channel === IPC_CHANNELS.CONFIG_GET) {
          return Promise.resolve(configResult)
        }
        if (channel === IPC_CHANNELS.DRIVE_LIST) {
          return Promise.resolve(drivesResult)
        }
        return Promise.resolve(null)
      })

      const [config, drives] = await Promise.all([exposedApi.getConfig(), exposedApi.listDrives()])

      expect(config).toEqual(configResult)
      expect(drives).toEqual(drivesResult)
    })
  })
})
