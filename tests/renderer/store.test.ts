/**
 * Store Tests
 * Tests for Zustand store slices
 */

import { useStore } from '../../src/renderer/src/store'
import type { DriveInfo, TransferSession, LogEntry } from '../../src/shared/types'

describe('Store', () => {
  // Get direct store reference
  const store = useStore

  // Reset store state before each test
  beforeEach(() => {
    store.getState().clearLogs()
    store.getState().setFilter('')
    store.getState().setLevel('all')
  })

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

    it('should remove drive from existingDrives when drive is disconnected', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk6',
        displayName: 'SD Card 5',
        description: 'USB Drive',
        mountpoints: ['/Volumes/SD_CARD_5'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      // Simulate drive being present at startup
      store.getState().setExistingDrives([mockDrive])
      expect(store.getState().isExistingDrive('/dev/disk6')).toBe(true)

      // Add the drive to detected drives
      store.getState().addDrive(mockDrive)
      expect(store.getState().detectedDrives.some((d) => d.device === '/dev/disk6')).toBe(true)

      // Remove the drive (simulating physical disconnection)
      store.getState().removeDrive('/dev/disk6')

      // Drive should be removed from both detectedDrives and existingDrives
      expect(store.getState().detectedDrives.some((d) => d.device === '/dev/disk6')).toBe(false)
      expect(store.getState().isExistingDrive('/dev/disk6')).toBe(false)
    })

    describe('File Selection', () => {
      const mockDrive: DriveInfo = {
        device: '/dev/disk10',
        displayName: 'Test Drive',
        description: 'USB Drive',
        mountpoints: ['/Volumes/TEST'],
        size: 32000000000,
        isRemovable: true,
        isSystem: false,
        busType: 'USB'
      }

      const mockScannedFiles = [
        {
          path: '/Volumes/TEST/DCIM/100CANON/IMG_001.jpg',
          size: 1024,
          modifiedTime: Date.now(),
          isDirectory: false
        },
        {
          path: '/Volumes/TEST/DCIM/100CANON/IMG_002.jpg',
          size: 2048,
          modifiedTime: Date.now(),
          isDirectory: false
        },
        {
          path: '/Volumes/TEST/DCIM/101CANON/IMG_003.jpg',
          size: 3072,
          modifiedTime: Date.now(),
          isDirectory: false
        },
        {
          path: '/Volumes/TEST/video.mp4',
          size: 4096,
          modifiedTime: Date.now(),
          isDirectory: false
        }
      ]

      beforeEach(() => {
        // Setup: select drive and set scanned files with selection
        store.getState().selectDrive(mockDrive)
        store.getState().setScannedFilesWithSelection(mockScannedFiles, '/Volumes/TEST')
      })

      afterEach(() => {
        // Cleanup
        store.getState().resetFileSelection()
        store.getState().setScannedFiles([])
        store.getState().selectDrive(null)
      })

      it('should initialize with all folders selected', () => {
        const { fileSelection } = store.getState()

        // All folders should be selected
        expect(fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(true)
        expect(fileSelection.selectedFolders.has('DCIM/101CANON')).toBe(true)
        expect(fileSelection.selectedFolders.has('/')).toBe(true)

        // No files should be deselected
        expect(fileSelection.deselectedFiles.size).toBe(0)
      })

      it('should toggle folder selection', () => {
        // Deselect a folder
        store.getState().toggleFolderSelection('DCIM/100CANON')
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(false)

        // Re-select the folder
        store.getState().toggleFolderSelection('DCIM/100CANON')
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(true)
      })

      it('should toggle individual file selection within a selected folder', () => {
        const filePath = '/Volumes/TEST/DCIM/100CANON/IMG_001.jpg'

        // Deselect a file
        store.getState().toggleFileSelection(filePath, 'DCIM/100CANON')
        expect(store.getState().fileSelection.deselectedFiles.has(filePath)).toBe(true)

        // Re-select the file
        store.getState().toggleFileSelection(filePath, 'DCIM/100CANON')
        expect(store.getState().fileSelection.deselectedFiles.has(filePath)).toBe(false)
      })

      it('should not allow file deselection in a deselected folder', () => {
        const filePath = '/Volumes/TEST/DCIM/100CANON/IMG_001.jpg'

        // Deselect the folder first
        store.getState().toggleFolderSelection('DCIM/100CANON')

        // Try to toggle file selection - should have no effect
        store.getState().toggleFileSelection(filePath, 'DCIM/100CANON')
        expect(store.getState().fileSelection.deselectedFiles.has(filePath)).toBe(false)
      })

      it('should clear deselected files when folder is re-selected (bug fix)', () => {
        const file1 = '/Volumes/TEST/DCIM/100CANON/IMG_001.jpg'
        const file2 = '/Volumes/TEST/DCIM/100CANON/IMG_002.jpg'
        const fileInOtherFolder = '/Volumes/TEST/DCIM/101CANON/IMG_003.jpg'

        // Step 1: Deselect individual files in the folder
        store.getState().toggleFileSelection(file1, 'DCIM/100CANON')
        store.getState().toggleFileSelection(file2, 'DCIM/100CANON')

        // Also deselect a file in a different folder
        store.getState().toggleFileSelection(fileInOtherFolder, 'DCIM/101CANON')

        // Verify files are deselected
        expect(store.getState().fileSelection.deselectedFiles.has(file1)).toBe(true)
        expect(store.getState().fileSelection.deselectedFiles.has(file2)).toBe(true)
        expect(store.getState().fileSelection.deselectedFiles.has(fileInOtherFolder)).toBe(true)

        // Step 2: Deselect the folder
        store.getState().toggleFolderSelection('DCIM/100CANON')
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(false)

        // Step 3: Re-select the folder
        store.getState().toggleFolderSelection('DCIM/100CANON')
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(true)

        // BUG FIX VERIFICATION: Deselected files in DCIM/100CANON should be cleared
        expect(store.getState().fileSelection.deselectedFiles.has(file1)).toBe(false)
        expect(store.getState().fileSelection.deselectedFiles.has(file2)).toBe(false)

        // Files in OTHER folders should NOT be affected
        expect(store.getState().fileSelection.deselectedFiles.has(fileInOtherFolder)).toBe(true)
      })

      it('should select all folders', () => {
        // First deselect some folders
        store.getState().toggleFolderSelection('DCIM/100CANON')
        store.getState().toggleFolderSelection('DCIM/101CANON')

        // Select all
        store.getState().selectAllFolders(['DCIM/100CANON', 'DCIM/101CANON', '/'])

        // All should be selected and deselected files should be cleared
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/100CANON')).toBe(true)
        expect(store.getState().fileSelection.selectedFolders.has('DCIM/101CANON')).toBe(true)
        expect(store.getState().fileSelection.selectedFolders.has('/')).toBe(true)
        expect(store.getState().fileSelection.deselectedFiles.size).toBe(0)
      })

      it('should deselect all folders', () => {
        store.getState().deselectAllFolders()

        expect(store.getState().fileSelection.selectedFolders.size).toBe(0)
      })

      it('should reset file selection', () => {
        // Make some changes
        store.getState().toggleFolderSelection('DCIM/100CANON')
        store
          .getState()
          .toggleFileSelection('/Volumes/TEST/DCIM/101CANON/IMG_003.jpg', 'DCIM/101CANON')
        store.getState().toggleFolderExpanded('DCIM/100CANON')

        // Reset
        store.getState().resetFileSelection()

        // All should be cleared
        expect(store.getState().fileSelection.selectedFolders.size).toBe(0)
        expect(store.getState().fileSelection.deselectedFiles.size).toBe(0)
        expect(store.getState().fileSelection.expandedFolders.size).toBe(0)
      })

      it('should toggle folder expanded state', () => {
        expect(store.getState().fileSelection.expandedFolders.has('DCIM/100CANON')).toBe(false)

        store.getState().toggleFolderExpanded('DCIM/100CANON')
        expect(store.getState().fileSelection.expandedFolders.has('DCIM/100CANON')).toBe(true)

        store.getState().toggleFolderExpanded('DCIM/100CANON')
        expect(store.getState().fileSelection.expandedFolders.has('DCIM/100CANON')).toBe(false)
      })

      it('should handle root folder re-selection correctly', () => {
        const rootFile = '/Volumes/TEST/video.mp4'

        // Deselect a file in root folder
        store.getState().toggleFileSelection(rootFile, '/')
        expect(store.getState().fileSelection.deselectedFiles.has(rootFile)).toBe(true)

        // Deselect root folder
        store.getState().toggleFolderSelection('/')
        expect(store.getState().fileSelection.selectedFolders.has('/')).toBe(false)

        // Re-select root folder - should clear deselected files in root
        store.getState().toggleFolderSelection('/')
        expect(store.getState().fileSelection.selectedFolders.has('/')).toBe(true)
        expect(store.getState().fileSelection.deselectedFiles.has(rootFile)).toBe(false)
      })
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
      store.getState().updateConfig({ transferMode: 'fully-autonomous' })

      expect(store.getState().config.transferMode).toBe('fully-autonomous')
    })

    it('should set loading state', () => {
      store.getState().setConfigLoading(true)

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
