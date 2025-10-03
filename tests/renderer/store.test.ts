/**
 * Store Tests
 * Tests for Zustand store slices
 */

import { useStore } from '../../src/renderer/src/store'
import type { DriveInfo, TransferSession, LogEntry } from '../../src/shared/types'

describe('Store', () => {
  // Get direct store reference
  const store = useStore

  describe('Drive Slice', () => {
    it('should add a drive', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk2',
        displayName: 'SD Card',
        description: 'USB Drive',
        mountpoints: ['/Volumes/SD_CARD'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      store.getState().addDrive(mockDrive)

      expect(store.getState().detectedDrives).toHaveLength(1)
      expect(store.getState().detectedDrives[0].device).toBe('/dev/disk2')
    })

    it('should not add duplicate drives', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk3',
        displayName: 'SD Card 2',
        description: 'USB Drive',
        mountpoints: ['/Volumes/SD_CARD_2'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const initialCount = store.getState().detectedDrives.length
      store.getState().addDrive(mockDrive)
      store.getState().addDrive(mockDrive)

      expect(store.getState().detectedDrives.length).toBe(initialCount + 1)
    })

    it('should remove a drive', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk4',
        displayName: 'SD Card 3',
        description: 'USB Drive',
        mountpoints: ['/Volumes/SD_CARD_3'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      store.getState().addDrive(mockDrive)
      const beforeCount = store.getState().detectedDrives.length
      store.getState().removeDrive('/dev/disk4')

      expect(store.getState().detectedDrives.length).toBe(beforeCount - 1)
    })

    it('should select a drive', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk5',
        displayName: 'SD Card 4',
        description: 'USB Drive',
        mountpoints: ['/Volumes/SD_CARD_4'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      store.getState().selectDrive(mockDrive)

      expect(store.getState().selectedDrive).toEqual(mockDrive)
    })
  })

  describe('Transfer Slice', () => {
    it('should start a transfer', () => {
      const mockSession: TransferSession = {
        id: 'session_1',
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 10,
        totalBytes: 1024000000,
        files: []
      }

      store.getState().startTransfer(mockSession)

      expect(store.getState().isTransferring).toBe(true)
      expect(store.getState().currentSession).toEqual(mockSession)
    })

    it('should complete a transfer', () => {
      const mockSession: TransferSession = {
        id: 'session_1',
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 10,
        totalBytes: 1024000000,
        files: []
      }

      const historyBefore = store.getState().history.length
      store.getState().startTransfer(mockSession)
      store.getState().completeTransfer()

      expect(store.getState().isTransferring).toBe(false)
      expect(store.getState().history.length).toBe(historyBefore + 1)
    })

    it('should handle transfer errors', () => {
      const mockSession: TransferSession = {
        id: 'session_1',
        driveId: '/dev/disk2',
        driveName: 'SD Card',
        sourceRoot: '/Volumes/SD_CARD',
        destinationRoot: '/Users/test/Transfers',
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: 10,
        totalBytes: 1024000000,
        files: []
      }

      const historyBefore = store.getState().history.length
      store.getState().startTransfer(mockSession)
      store.getState().failTransfer('Checksum mismatch')

      expect(store.getState().isTransferring).toBe(false)
      expect(store.getState().error).toBe('Checksum mismatch')
      expect(store.getState().history.length).toBe(historyBefore + 1)
      expect(store.getState().history[0].status).toBe('error')
    })
  })

  describe('Config Slice', () => {
    it('should update config', () => {
      store.getState().updateConfig({ transferMode: 'autonomous' })

      expect(store.getState().config.transferMode).toBe('autonomous')
    })

    it('should set loading state', () => {
      store.getState().setLoading(true)

      expect(store.getState().isLoading).toBe(true)
    })
  })

  describe('Log Slice', () => {
    it('should add a log entry', () => {
      const mockLog: LogEntry = {
        level: 'info',
        message: 'Test log',
        timestamp: Date.now()
      }

      const logsBefore = store.getState().logs.length
      store.getState().addLog(mockLog)

      expect(store.getState().logs.length).toBe(logsBefore + 1)
      expect(store.getState().logs[0].message).toBe('Test log')
    })

    it('should filter logs by level', () => {
      const mockLogs: LogEntry[] = [
        { level: 'info', message: 'Info log', timestamp: Date.now() },
        { level: 'error', message: 'Error log', timestamp: Date.now() },
        { level: 'warn', message: 'Warn log', timestamp: Date.now() }
      ]

      // Clear logs first
      store.getState().clearLogs()
      mockLogs.forEach((log) => store.getState().addLog(log))
      store.getState().setLevel('error')

      const filtered = store.getState().getFilteredLogs()
      expect(filtered.length).toBeGreaterThanOrEqual(1)
      expect(filtered.some((log) => log.level === 'error')).toBe(true)
    })

    it('should filter logs by search term', () => {
      const mockLogs: LogEntry[] = [
        { level: 'info', message: 'Transfer started', timestamp: Date.now() },
        { level: 'info', message: 'Drive detected', timestamp: Date.now() }
      ]

      // Clear logs first
      store.getState().clearLogs()
      mockLogs.forEach((log) => store.getState().addLog(log))
      store.getState().setFilter('transfer')

      const filtered = store.getState().getFilteredLogs()
      expect(filtered.length).toBeGreaterThanOrEqual(1)
      expect(filtered.some((log) => log.message.toLowerCase().includes('transfer'))).toBe(true)
    })
  })

  describe('UI Slice', () => {
    it('should toggle settings', () => {
      const before = store.getState().showSettings
      store.getState().toggleSettings()

      expect(store.getState().showSettings).toBe(!before)

      store.getState().toggleSettings()

      expect(store.getState().showSettings).toBe(before)
    })

    it('should set selected destination', () => {
      store.getState().setSelectedDestination('/Users/test/Transfers')

      expect(store.getState().selectedDestination).toBe('/Users/test/Transfers')
    })

    it('should close all modals', () => {
      store.getState().toggleSettings()
      store.getState().toggleLogs()
      store.getState().toggleHistory()

      expect(store.getState().showSettings).toBe(true)
      expect(store.getState().showLogs).toBe(true)
      expect(store.getState().showHistory).toBe(true)

      store.getState().closeAllModals()

      expect(store.getState().showSettings).toBe(false)
      expect(store.getState().showLogs).toBe(false)
      expect(store.getState().showHistory).toBe(false)
    })
  })
})
