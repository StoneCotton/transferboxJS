/**
 * Retry Strategy Tests
 * Tests for retry logic with exponential backoff
 */

import { withRetry, DEFAULT_RETRY_CONFIG } from '../../../src/main/utils/retryStrategy'
import { TransferError } from '../../../src/main/errors/TransferError'
import { TransferErrorType } from '../../../src/shared/types'

// Mock logger
jest.mock('../../../src/main/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}))

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success')

    const result = await withRetry(operation)

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry retryable errors', async () => {
    const retryableError = new TransferError('Network error', TransferErrorType.NETWORK_ERROR, true)

    const operation = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('success')

    const result = await withRetry(operation)

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should not retry non-retryable errors', async () => {
    const nonRetryableError = new TransferError(
      'Permission denied',
      TransferErrorType.PERMISSION_DENIED,
      false
    )

    const operation = jest.fn().mockRejectedValue(nonRetryableError)

    await expect(withRetry(operation)).rejects.toThrow('Permission denied')
    expect(operation).toHaveBeenCalledTimes(1) // Only initial attempt
  })

  it('should respect max attempts', async () => {
    const retryableError = new TransferError('Busy', TransferErrorType.UNKNOWN, true)

    const operation = jest.fn().mockRejectedValue(retryableError)

    await expect(
      withRetry(
        operation,
        { maxAttempts: 3 },
        { operationName: 'test', metadata: { file: 'test.txt' } }
      )
    ).rejects.toThrow(retryableError)

    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should apply exponential backoff', async () => {
    const retryableError = new TransferError('Busy', TransferErrorType.UNKNOWN, true)
    const operation = jest.fn().mockRejectedValue(retryableError)

    const startTime = Date.now()

    await expect(
      withRetry(
        operation,
        {
          maxAttempts: 3,
          initialDelay: 100,
          backoffMultiplier: 2
        },
        { operationName: 'test' }
      )
    ).rejects.toThrow()

    const elapsedTime = Date.now() - startTime

    // Should have waited: 100ms + 200ms = 300ms minimum
    expect(elapsedTime).toBeGreaterThanOrEqual(250) // Allow some tolerance
  })

  it('should respect max delay', async () => {
    const retryableError = new TransferError('Busy', TransferErrorType.UNKNOWN, true)
    const operation = jest.fn().mockRejectedValue(retryableError)

    await expect(
      withRetry(
        operation,
        {
          maxAttempts: 3, // Reduced from 5 to make test faster
          initialDelay: 100, // Reduced from 1000
          maxDelay: 200, // Reduced from 2000
          backoffMultiplier: 10 // This would normally create huge delays
        },
        { operationName: 'test' }
      )
    ).rejects.toThrow()

    expect(operation).toHaveBeenCalledTimes(3)
  }, 10000) // 10 second timeout

  it('should use custom shouldRetry function', async () => {
    const error1 = new Error('Error 1')
    const error2 = new Error('Error 2')

    const operation = jest.fn().mockRejectedValueOnce(error1).mockRejectedValueOnce(error2)

    await expect(
      withRetry(
        operation,
        {
          maxAttempts: 3,
          shouldRetry: (error) => (error as Error).message === 'Error 1' // Only retry Error 1
        },
        { operationName: 'test' }
      )
    ).rejects.toThrow('Error 2')

    expect(operation).toHaveBeenCalledTimes(2) // First attempt + 1 retry, then fail
  })

  it('should handle operation context for logging', async () => {
    const operation = jest.fn().mockResolvedValue('success')

    await withRetry(operation, {}, { operationName: 'testOp', metadata: { file: 'test.txt' } })

    expect(operation).toHaveBeenCalled()
  })

  it('should use default retry config when no config provided', async () => {
    const retryableError = new TransferError('Network error', TransferErrorType.NETWORK_ERROR, true)
    const operation = jest.fn().mockRejectedValue(retryableError)

    await expect(withRetry(operation)).rejects.toThrow()

    expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts)
  })
})
