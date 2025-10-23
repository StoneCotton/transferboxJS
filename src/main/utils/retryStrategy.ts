/**
 * Retry Strategy Module
 * Reusable retry logic with exponential backoff
 */

import { getLogger } from '../logger'

export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  shouldRetry: (error: unknown) => boolean
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    // Only retry TransferErrors marked as retryable
    return (error as { isRetryable?: boolean })?.isRetryable === true
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { operationName: string; metadata?: Record<string, unknown> }
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const logger = getLogger()

  let lastError: unknown
  let delay = finalConfig.initialDelay

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        logger.info('Retrying operation', {
          ...context?.metadata,
          operation: context?.operationName,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          delay
        })
        await sleep(delay)
        delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelay)
      }

      return await operation()
    } catch (error) {
      lastError = error

      if (!finalConfig.shouldRetry(error)) {
        logger.debug('Error not retryable', {
          ...context?.metadata,
          operation: context?.operationName,
          error: (error as Error)?.message
        })
        throw error
      }

      if (attempt === finalConfig.maxAttempts) {
        logger.error('All retry attempts exhausted', {
          ...context?.metadata,
          operation: context?.operationName,
          attempts: attempt,
          finalError: (error as Error)?.message,
          errorType: (error as any)?.errorType
        })
        // Preserve the original error to maintain error type information
        throw error
      }

      logger.warn('Operation failed, will retry', {
        ...context?.metadata,
        operation: context?.operationName,
        attempt,
        error: (error as Error)?.message
      })
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
