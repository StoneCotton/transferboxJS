/**
 * Tests for TransferService
 */

// Mock dependencies - must be before imports to ensure hoisting works
jest.mock('../../../src/main/fileTransfer', () => {
  const mockEngine = {
    transferFiles: jest.fn().mockResolvedValue([]),
    isTransferring: jest.fn().mockReturnValue(false),
    stop: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn()
  }
  return {
    FileTransferEngine: jest.fn().mockImplementation(() => mockEngine),
    __mockEngine: mockEngine
  }
})

jest.mock('../../../src/main/databaseManager', () => {
  const mockDb = {
    createTransferSession: jest.fn().mockReturnValue('session-123'),
    addFileToSession: jest.fn(),
    updateFileStatus: jest.fn(),
    updateTransferSession: jest.fn(),
    getFilesByStatus: jest.fn().mockReturnValue([])
  }
  return {
    getDatabaseManager: jest.fn(() => mockDb),
    __mockDb: mockDb
  }
})

jest.mock('../../../src/main/configManager', () => ({
  getConfig: () => ({
    verifyChecksums: true,
    conflictResolution: 'ask',
    mediaExtensions: ['.mp4', '.mov', '.jpg']
  })
}))

jest.mock('../../../src/main/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logTransferStart: jest.fn(),
    logTransferComplete: jest.fn(),
    logTransferError: jest.fn()
  })
}))

jest.mock('../../../src/main/pathProcessor', () => ({
  createPathProcessor: () => ({
    shouldTransferFile: jest.fn().mockReturnValue(true),
    processFilePath: jest.fn().mockImplementation((source: string, dest: string) => ({
      destinationPath: `${dest}/${source.split('/').pop()}`,
      fileName: source.split('/').pop(),
      directory: dest
    }))
  })
}))

jest.mock('../../../src/main/pathValidator', () => ({
  hasEnoughSpace: jest.fn().mockResolvedValue(true),
  checkDiskSpace: jest.fn().mockResolvedValue({ freeSpace: 1000000000 })
}))

jest.mock('../../../src/main/transferValidator', () => ({
  validateTransfer: jest.fn().mockResolvedValue({
    isValid: true,
    canProceed: true,
    requiresConfirmation: false,
    warnings: [],
    conflicts: [],
    spaceRequired: 1000,
    spaceAvailable: 1000000
  })
}))

jest.mock('../../../src/main/utils/filenameUtils', () => ({
  FilenameUtils: jest.fn().mockImplementation(() => ({
    resolveConflict: jest.fn().mockResolvedValue({ path: '/dest/file.txt', action: 'none' })
  }))
}))

jest.mock('../../../src/main/menu', () => ({
  updateMenuForTransferState: jest.fn()
}))

jest.mock('fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({ size: 1000 })
}))

import { TransferService, getTransferService } from '../../../src/main/services/transferService'
import { hasEnoughSpace } from '../../../src/main/pathValidator'

// Get mock references after imports
const { __mockDb: mockDb } = jest.requireMock('../../../src/main/databaseManager')
const { __mockEngine: mockTransferEngine } = jest.requireMock('../../../src/main/fileTransfer')

describe('TransferService', () => {
  let service: TransferService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TransferService()
  })

  describe('isTransferring', () => {
    it('should return false when no engine', () => {
      expect(service.isTransferring()).toBe(false)
    })

    it('should delegate to engine when available', () => {
      service.reset() // Creates engine
      expect(service.isTransferring()).toBe(false)
    })
  })

  describe('stop', () => {
    it('should not throw when no engine', async () => {
      await expect(service.stop()).resolves.not.toThrow()
    })

    it('should stop engine when available', async () => {
      service.reset()
      await service.stop()
      // Should not throw
    })
  })

  describe('reset', () => {
    it('should create new engine', () => {
      service.reset()
      expect(service.getEngine()).not.toBeNull()
    })

    it('should reset existing engine', () => {
      service.reset()
      const firstEngine = service.getEngine()
      service.reset()
      // Engine should be the same instance but reset
      expect(service.getEngine()).toBe(firstEngine)
    })
  })

  describe('validateTransferRequest', () => {
    it('should validate transfer request', async () => {
      const result = await service.validateTransferRequest(
        '/source',
        '/dest',
        ['/source/file.txt'],
        { device: 'disk1', displayName: 'Test Drive', description: '', mountpoints: ['/Volumes/Test'], size: 1000, isRemovable: true, isSystem: false, busType: 'USB' }
      )

      expect(result.isValid).toBe(true)
      expect(result.canProceed).toBe(true)
    })

    it('should work without drive info', async () => {
      const result = await service.validateTransferRequest(
        '/source',
        '/dest',
        ['/source/file.txt']
      )

      expect(result).toBeDefined()
    })
  })

  describe('prepareTransferFiles', () => {
    it('should prepare files for transfer', async () => {
      service.reset()
      
      const result = await service.prepareTransferFiles({
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/file.txt'],
        driveInfo: { device: 'disk1', displayName: 'Test Drive', description: '', mountpoints: ['/Volumes/Test'], size: 1000, isRemovable: true, isSystem: false, busType: 'USB' }
      })

      expect(result.transferFiles).toBeDefined()
      expect(result.fileSizes).toBeDefined()
      expect(result.totalBytes).toBeGreaterThanOrEqual(0)
      expect(result.skippedCount).toBeGreaterThanOrEqual(0)
    })

    it('should handle skip conflict resolution', async () => {
      service.reset()
      
      const result = await service.prepareTransferFiles({
        sourceRoot: '/source',
        destinationRoot: '/dest',
        files: ['/source/file.txt'],
        driveInfo: { device: 'disk1', displayName: 'Test Drive', description: '', mountpoints: ['/Volumes/Test'], size: 1000, isRemovable: true, isSystem: false, busType: 'USB' },
        conflictResolutions: {
          '/source/file.txt': 'skip'
        }
      })

      expect(result.skippedCount).toBe(1)
    })
  })

  describe('validateDiskSpace', () => {
    it('should pass when enough space', async () => {
      await expect(
        service.validateDiskSpace('/dest', 1000)
      ).resolves.not.toThrow()
    })

    it('should throw when insufficient space', async () => {
      ;(hasEnoughSpace as jest.Mock).mockResolvedValueOnce(false)

      await expect(
        service.validateDiskSpace('/dest', 1000000000000)
      ).rejects.toThrow('Insufficient disk space')
    })
  })

  describe('createSession', () => {
    it('should create a transfer session', () => {
      const sessionId = service.createSession(
        {
          sourceRoot: '/source',
          destinationRoot: '/dest',
          files: ['/source/file.txt'],
          driveInfo: { device: 'disk1', displayName: 'Test Drive', description: '', mountpoints: ['/Volumes/Test'], size: 1000, isRemovable: true, isSystem: false, busType: 'USB' }
        },
        1,
        1000
      )

      expect(sessionId).toBe('session-123')
    })
  })

  describe('addFilesToSession', () => {
    it('should add files to session', () => {
      service.addFilesToSession(
        'session-123',
        [{ source: '/source/file.txt', dest: '/dest/file.txt' }],
        [1000]
      )

      expect(mockDb.addFileToSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          sourcePath: '/source/file.txt',
          destinationPath: '/dest/file.txt',
          fileName: 'file.txt',
          fileSize: 1000
        })
      )
    })
  })

  describe('updateSessionCompletion', () => {
    it('should update session on completion', () => {
      const result = service.updateSessionCompletion(
        'session-123',
        [
          { success: true, sourcePath: '/source/file.txt', destPath: '/dest/file.txt', bytesTransferred: 1000, checksumVerified: true, sourceChecksum: 'abc', duration: 100 }
        ],
        Date.now()
      )

      expect(result.completedCount).toBe(1)
      expect(result.failedCount).toBe(0)
      expect(mockDb.updateTransferSession).toHaveBeenCalled()
    })

    it('should track failed files', () => {
      const result = service.updateSessionCompletion(
        'session-123',
        [
          { success: false, sourcePath: '/source/file.txt', destPath: '/dest/file.txt', bytesTransferred: 0, checksumVerified: false, error: 'Failed', duration: 100 }
        ],
        Date.now()
      )

      expect(result.completedCount).toBe(0)
      expect(result.failedCount).toBe(1)
    })
  })

  describe('updateSessionError', () => {
    it('should update session with error', () => {
      service.updateSessionError('session-123', 'Transfer failed')

      expect(mockDb.updateTransferSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          status: 'error',
          errorMessage: 'Transfer failed'
        })
      )
    })
  })
})

describe('getTransferService', () => {
  it('should return singleton instance', () => {
    const service1 = getTransferService()
    const service2 = getTransferService()
    expect(service1).toBe(service2)
  })

  it('should return TransferService instance', () => {
    const service = getTransferService()
    expect(service).toBeInstanceOf(TransferService)
  })
})

