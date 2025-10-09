/**
 * Store Selectors Tests
 * Tests for Zustand store selectors
 */

import { create } from 'zustand'
import {
  createTransferSlice,
  type TransferSlice
} from '../../../src/renderer/src/store/slices/transferSlice'
import { TransferErrorType } from '../../../src/shared/types'
import {
  useIsTransferActive,
  useIsTransferPaused,
  useHasRetryableErrors,
  useTransferStatistics
} from '../../../src/renderer/src/store/selectors'
import { useStore } from '../../../src/renderer/src/store'

// Mock the store
jest.mock('../../../src/renderer/src/store', () => ({
  useStore: jest.fn()
}))

describe('Store Selectors', () => {
  let mockStore: any

  beforeEach(() => {
    mockStore = {
      isTransferring: false,
      isPaused: false,
      errorDetails: null,
      fileStates: new Map(),
      progress: null
    }
    ;(useStore as unknown as jest.Mock).mockImplementation((selector: any) => selector(mockStore))
  })

  describe('useIsTransferActive', () => {
    it('should return true when transferring and not paused', () => {
      mockStore.isTransferring = true
      mockStore.isPaused = false

      const result = useIsTransferActive()
      expect(result).toBe(true)
    })

    it('should return false when paused', () => {
      mockStore.isTransferring = true
      mockStore.isPaused = true

      const result = useIsTransferActive()
      expect(result).toBe(false)
    })

    it('should return false when not transferring', () => {
      mockStore.isTransferring = false
      mockStore.isPaused = false

      const result = useIsTransferActive()
      expect(result).toBe(false)
    })
  })

  describe('useIsTransferPaused', () => {
    it('should return pause state', () => {
      mockStore.isPaused = true

      const result = useIsTransferPaused()
      expect(result).toBe(true)
    })
  })

  describe('useHasRetryableErrors', () => {
    it('should detect retryable errors in errorDetails', () => {
      mockStore.errorDetails = {
        type: TransferErrorType.NETWORK_ERROR,
        retryable: true,
        affectedFiles: [],
        timestamp: Date.now()
      }

      const result = useHasRetryableErrors()
      expect(result).toBe(true)
    })

    it('should detect retryable errors in file states', () => {
      const fileStates = new Map()
      fileStates.set('/path/file.txt', {
        status: 'error',
        progress: 0,
        errorType: TransferErrorType.NETWORK_ERROR,
        retryCount: 0
      })
      mockStore.fileStates = fileStates

      const result = useHasRetryableErrors()
      expect(result).toBe(true)
    })

    it('should return false for non-retryable errors', () => {
      mockStore.errorDetails = {
        type: TransferErrorType.PERMISSION_DENIED,
        retryable: false,
        affectedFiles: [],
        timestamp: Date.now()
      }

      const result = useHasRetryableErrors()
      expect(result).toBe(false)
    })
  })

  describe('useTransferStatistics', () => {
    it('should return null when no progress', () => {
      const result = useTransferStatistics()
      expect(result).toBeNull()
    })

    it('should calculate statistics correctly', () => {
      mockStore.progress = {
        totalFiles: 10,
        completedFilesCount: 7,
        failedFiles: 2,
        skippedFiles: 1,
        activeFiles: [{ name: 'file1.txt' }]
      }

      const result = useTransferStatistics()

      expect(result).toEqual({
        total: 10,
        completed: 7,
        failed: 2,
        skipped: 1,
        inProgress: 1,
        pending: 1 // 10 - 7 - 2 = 1
      })
    })
  })
})
