/**
 * TransferError Tests
 * Tests for error categorization and handling
 */

import { TransferError, wrapError } from '../../../src/main/errors/TransferError'
import { TransferErrorType } from '../../../src/shared/types'

describe('TransferError', () => {
  describe('fromNodeError', () => {
    it('should categorize permission denied errors', () => {
      const nodeError = new Error('Permission denied') as NodeJS.ErrnoException
      nodeError.code = 'EACCES'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.PERMISSION_DENIED)
      expect(transferError.isRetryable).toBe(false)
      expect(transferError.message).toBe('Permission denied')
    })

    it('should categorize EPERM errors as permission denied', () => {
      const nodeError = new Error('Operation not permitted') as NodeJS.ErrnoException
      nodeError.code = 'EPERM'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.PERMISSION_DENIED)
      expect(transferError.isRetryable).toBe(false)
    })

    it('should categorize insufficient space errors', () => {
      const nodeError = new Error('No space left on device') as NodeJS.ErrnoException
      nodeError.code = 'ENOSPC'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.INSUFFICIENT_SPACE)
      expect(transferError.isRetryable).toBe(false)
    })

    it('should categorize drive disconnection errors (ENOENT)', () => {
      const nodeError = new Error('No such file or directory') as NodeJS.ErrnoException
      nodeError.code = 'ENOENT'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (EIO)', () => {
      const nodeError = new Error('Input/output error') as NodeJS.ErrnoException
      nodeError.code = 'EIO'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (EROFS)', () => {
      const nodeError = new Error('Read-only file system') as NodeJS.ErrnoException
      nodeError.code = 'EROFS'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (ENXIO)', () => {
      const nodeError = new Error('No such device or address') as NodeJS.ErrnoException
      nodeError.code = 'ENXIO'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (ENOTCONN)', () => {
      const nodeError = new Error('Transport endpoint is not connected') as NodeJS.ErrnoException
      nodeError.code = 'ENOTCONN'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (ENODEV)', () => {
      const nodeError = new Error('No such device') as NodeJS.ErrnoException
      nodeError.code = 'ENODEV'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize drive disconnection errors (ESHUTDOWN)', () => {
      const nodeError = new Error(
        'Cannot send after transport endpoint shutdown'
      ) as NodeJS.ErrnoException
      nodeError.code = 'ESHUTDOWN'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize network timeout errors as retryable', () => {
      const nodeError = new Error('Connection timed out') as NodeJS.ErrnoException
      nodeError.code = 'ETIMEDOUT'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.NETWORK_ERROR)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize network reset errors as retryable', () => {
      const nodeError = new Error('Connection reset') as NodeJS.ErrnoException
      nodeError.code = 'ECONNRESET'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.NETWORK_ERROR)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize busy errors as retryable', () => {
      const nodeError = new Error('Resource busy') as NodeJS.ErrnoException
      nodeError.code = 'EBUSY'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.UNKNOWN)
      expect(transferError.isRetryable).toBe(true)
    })

    it('should categorize unknown errors', () => {
      const nodeError = new Error('Something went wrong') as NodeJS.ErrnoException
      nodeError.code = 'EUNKNOWN'

      const transferError = TransferError.fromNodeError(nodeError)

      expect(transferError.errorType).toBe(TransferErrorType.UNKNOWN)
      expect(transferError.isRetryable).toBe(false)
    })
  })

  describe('fromChecksumMismatch', () => {
    it('should create checksum mismatch error', () => {
      const sourceChecksum = 'abc123'
      const destChecksum = 'def456'

      const error = TransferError.fromChecksumMismatch(sourceChecksum, destChecksum)

      expect(error.errorType).toBe(TransferErrorType.CHECKSUM_MISMATCH)
      expect(error.isRetryable).toBe(true)
      expect(error.message).toContain(sourceChecksum)
      expect(error.message).toContain(destChecksum)
    })
  })

  describe('fromValidation', () => {
    it('should create validation error', () => {
      const message = 'File is too small'

      const error = TransferError.fromValidation(message)

      expect(error.errorType).toBe(TransferErrorType.SOURCE_NOT_FOUND)
      expect(error.isRetryable).toBe(false)
      expect(error.message).toBe(message)
    })
  })

  describe('fromInsufficientSpace', () => {
    it('should create insufficient space error with details', () => {
      const required = 10000000
      const available = 5000000

      const error = TransferError.fromInsufficientSpace(required, available)

      expect(error.errorType).toBe(TransferErrorType.INSUFFICIENT_SPACE)
      expect(error.isRetryable).toBe(false)
      expect(error.message).toContain(required.toString())
      expect(error.message).toContain(available.toString())
    })
  })

  describe('wrapError', () => {
    it('should return TransferError unchanged', () => {
      const original = new TransferError('Test', TransferErrorType.UNKNOWN, false)

      const wrapped = wrapError(original)

      expect(wrapped).toBe(original)
    })

    it('should convert NodeJS errors to TransferError', () => {
      const nodeError = new Error('Permission denied') as NodeJS.ErrnoException
      nodeError.code = 'EACCES'

      const wrapped = wrapError(nodeError)

      expect(wrapped).toBeInstanceOf(TransferError)
      expect(wrapped.errorType).toBe(TransferErrorType.PERMISSION_DENIED)
    })

    it('should convert strings to TransferError', () => {
      const wrapped = wrapError('Something went wrong')

      expect(wrapped).toBeInstanceOf(TransferError)
      expect(wrapped.errorType).toBe(TransferErrorType.UNKNOWN)
      expect(wrapped.message).toBe('Something went wrong')
    })

    it('should convert unknown types to TransferError', () => {
      const wrapped = wrapError({ random: 'object' })

      expect(wrapped).toBeInstanceOf(TransferError)
      expect(wrapped.errorType).toBe(TransferErrorType.UNKNOWN)
    })
  })
})
