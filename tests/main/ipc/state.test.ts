/**
 * Tests for IPC State Module
 */

import {
  getIpcState,
  getDriveMonitor,
  setDriveMonitor,
  getTransferEngine,
  setTransferEngine,
  getPathProcessor,
  setPathProcessor,
  getMainWindow,
  setMainWindow,
  resetIpcState
} from '../../../src/main/ipc/state'

// Mock types
const mockDriveMonitor = { listDrives: jest.fn() } as any
const mockTransferEngine = { transferFile: jest.fn() } as any
const mockPathProcessor = { processFilePath: jest.fn() } as any
const mockWindow = { webContents: { send: jest.fn() }, isDestroyed: () => false } as any

describe('IPC State Module', () => {
  afterEach(() => {
    // Reset state after each test
    resetIpcState()
  })

  describe('getIpcState', () => {
    it('should return initial state with null values', () => {
      const state = getIpcState()
      expect(state.driveMonitor).toBeNull()
      expect(state.transferEngine).toBeNull()
      expect(state.pathProcessor).toBeNull()
      expect(state.mainWindow).toBeNull()
    })
  })

  describe('DriveMonitor state', () => {
    it('should get and set drive monitor', () => {
      expect(getDriveMonitor()).toBeNull()

      setDriveMonitor(mockDriveMonitor)
      expect(getDriveMonitor()).toBe(mockDriveMonitor)
    })

    it('should allow setting to null', () => {
      setDriveMonitor(mockDriveMonitor)
      setDriveMonitor(null)
      expect(getDriveMonitor()).toBeNull()
    })
  })

  describe('TransferEngine state', () => {
    it('should get and set transfer engine', () => {
      expect(getTransferEngine()).toBeNull()

      setTransferEngine(mockTransferEngine)
      expect(getTransferEngine()).toBe(mockTransferEngine)
    })

    it('should allow setting to null', () => {
      setTransferEngine(mockTransferEngine)
      setTransferEngine(null)
      expect(getTransferEngine()).toBeNull()
    })
  })

  describe('PathProcessor state', () => {
    it('should get and set path processor', () => {
      expect(getPathProcessor()).toBeNull()

      setPathProcessor(mockPathProcessor)
      expect(getPathProcessor()).toBe(mockPathProcessor)
    })

    it('should allow setting to null', () => {
      setPathProcessor(mockPathProcessor)
      setPathProcessor(null)
      expect(getPathProcessor()).toBeNull()
    })
  })

  describe('MainWindow state', () => {
    it('should get and set main window', () => {
      expect(getMainWindow()).toBeNull()

      setMainWindow(mockWindow)
      expect(getMainWindow()).toBe(mockWindow)
    })

    it('should allow setting to null', () => {
      setMainWindow(mockWindow)
      setMainWindow(null)
      expect(getMainWindow()).toBeNull()
    })
  })

  describe('resetIpcState', () => {
    it('should reset all state to null', () => {
      // Set all state values
      setDriveMonitor(mockDriveMonitor)
      setTransferEngine(mockTransferEngine)
      setPathProcessor(mockPathProcessor)
      setMainWindow(mockWindow)

      // Verify they're set
      expect(getDriveMonitor()).not.toBeNull()
      expect(getTransferEngine()).not.toBeNull()
      expect(getPathProcessor()).not.toBeNull()
      expect(getMainWindow()).not.toBeNull()

      // Reset
      resetIpcState()

      // Verify all are null
      expect(getDriveMonitor()).toBeNull()
      expect(getTransferEngine()).toBeNull()
      expect(getPathProcessor()).toBeNull()
      expect(getMainWindow()).toBeNull()
    })
  })

  describe('state isolation', () => {
    it('should maintain separate state for each property', () => {
      setDriveMonitor(mockDriveMonitor)

      expect(getDriveMonitor()).toBe(mockDriveMonitor)
      expect(getTransferEngine()).toBeNull()
      expect(getPathProcessor()).toBeNull()
      expect(getMainWindow()).toBeNull()
    })
  })
})
