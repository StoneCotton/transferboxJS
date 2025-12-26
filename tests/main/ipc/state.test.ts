/**
 * Tests for IPC State Module
 */

import {
  getDriveMonitor,
  setDriveMonitor,
  getMainWindow,
  setMainWindow,
  resetIpcState
} from '../../../src/main/ipc/state'

// Mock types
const mockDriveMonitor = { listDrives: jest.fn() } as any
const mockWindow = { webContents: { send: jest.fn() }, isDestroyed: () => false } as any

describe('IPC State Module', () => {
  afterEach(() => {
    // Reset state after each test
    resetIpcState()
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
      setMainWindow(mockWindow)

      // Verify they're set
      expect(getDriveMonitor()).not.toBeNull()
      expect(getMainWindow()).not.toBeNull()

      // Reset
      resetIpcState()

      // Verify all are null
      expect(getDriveMonitor()).toBeNull()
      expect(getMainWindow()).toBeNull()
    })
  })

  describe('state isolation', () => {
    it('should maintain separate state for each property', () => {
      setDriveMonitor(mockDriveMonitor)

      expect(getDriveMonitor()).toBe(mockDriveMonitor)
      expect(getMainWindow()).toBeNull()
    })
  })
})
