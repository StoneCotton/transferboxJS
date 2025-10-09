/**
 * Transfer Error Module
 * Centralized error handling for file transfers
 */

import { TransferErrorType } from '../../shared/types'

export class TransferError extends Error {
  public readonly errorType: TransferErrorType
  public readonly code?: string
  public readonly isRetryable: boolean
  public readonly originalError?: Error

  constructor(
    message: string,
    errorType: TransferErrorType,
    isRetryable: boolean = false,
    originalError?: Error
  ) {
    super(message)
    this.name = 'TransferError'
    this.errorType = errorType
    this.isRetryable = isRetryable
    this.originalError = originalError
    this.code = (originalError as NodeJS.ErrnoException)?.code
  }

  static fromNodeError(error: NodeJS.ErrnoException): TransferError {
    const code = error.code?.toLowerCase()
    const message = error.message

    // Permission errors (non-retryable)
    if (code === 'eacces' || code === 'eperm') {
      return new TransferError(
        'Permission denied',
        TransferErrorType.PERMISSION_DENIED,
        false,
        error
      )
    }

    // Space errors (non-retryable)
    if (code === 'enospc') {
      return new TransferError(
        'Insufficient disk space',
        TransferErrorType.INSUFFICIENT_SPACE,
        false,
        error
      )
    }

    // Drive disconnection (non-retryable)
    if (code === 'enoent' || code === 'eio' || code === 'erofs') {
      return new TransferError(
        'Drive may have been disconnected',
        TransferErrorType.DRIVE_DISCONNECTED,
        false,
        error
      )
    }

    // Network errors (retryable)
    if (code === 'etimedout' || code === 'econnreset' || code === 'ehostunreach') {
      return new TransferError('Network error', TransferErrorType.NETWORK_ERROR, true, error)
    }

    // Temporary errors (retryable)
    if (code === 'ebusy' || code === 'eagain') {
      return new TransferError(
        'Resource temporarily unavailable',
        TransferErrorType.UNKNOWN,
        true,
        error
      )
    }

    return new TransferError(message || 'Unknown error', TransferErrorType.UNKNOWN, false, error)
  }

  static fromChecksumMismatch(sourceChecksum: string, destChecksum: string): TransferError {
    return new TransferError(
      `Checksum mismatch: source=${sourceChecksum}, dest=${destChecksum}`,
      TransferErrorType.CHECKSUM_MISMATCH,
      false
    )
  }

  static fromValidation(message: string): TransferError {
    return new TransferError(message, TransferErrorType.SOURCE_NOT_FOUND, false)
  }

  static fromInsufficientSpace(required: number, available: number): TransferError {
    return new TransferError(
      `Insufficient disk space. Required: ${required} bytes, Available: ${available} bytes`,
      TransferErrorType.INSUFFICIENT_SPACE,
      false
    )
  }
}

/**
 * Utility function to wrap errors
 */
export function wrapError(error: unknown): TransferError {
  if (error instanceof TransferError) {
    return error
  }
  if (error instanceof Error) {
    return TransferError.fromNodeError(error as NodeJS.ErrnoException)
  }
  return new TransferError(String(error), TransferErrorType.UNKNOWN, false)
}
