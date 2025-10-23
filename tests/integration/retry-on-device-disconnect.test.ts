/**
 * Integration test for retry logic on device disconnection
 * Tests that transfers properly retry when device disconnection errors occur
 */

import { FileTransferEngine } from '../../src/main/fileTransfer'
import { TransferError } from '../../src/main/errors/TransferError'
import { TransferErrorType } from '../../src/shared/types'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'

describe('Retry on Device Disconnect', () => {
  let tempDir: string
  let sourcePath: string
  let destPath: string

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'transfer-retry-test-'))
    sourcePath = path.join(tempDir, 'source.txt')
    destPath = path.join(tempDir, 'dest.txt')

    // Create a test file
    await fs.writeFile(sourcePath, 'Test content for retry logic', 'utf8')
  })

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should classify ENXIO errors as retryable DRIVE_DISCONNECTED errors', () => {
    const nodeError = new Error('ENXIO: no such device or address, close') as NodeJS.ErrnoException
    nodeError.code = 'ENXIO'

    const transferError = TransferError.fromNodeError(nodeError)

    expect(transferError.errorType).toBe(TransferErrorType.DRIVE_DISCONNECTED)
    expect(transferError.isRetryable).toBe(true)
    expect(transferError.message).toBe('Drive may have been disconnected')
  })

  it('should retry transfer when ENXIO error occurs and eventually succeed', async () => {
    const engine = new FileTransferEngine()
    let attemptCount = 0

    // Mock the performFileTransfer method to simulate ENXIO error on first attempt
    const originalMethod = (engine as any).performFileTransfer.bind(engine)
    ;(engine as any).performFileTransfer = jest.fn(async (...args: any[]) => {
      attemptCount++
      if (attemptCount === 1) {
        // First attempt: simulate device disconnection
        const enxioError = new Error(
          'ENXIO: no such device or address, close'
        ) as NodeJS.ErrnoException
        enxioError.code = 'ENXIO'
        // Wrap in TransferError to properly set isRetryable flag
        throw TransferError.fromNodeError(enxioError)
      }
      // Second attempt: succeed
      return originalMethod(...args)
    })

    const result = await engine.transferFile(sourcePath, destPath, {
      maxRetries: 3,
      retryDelay: 100,
      verifyChecksum: false
    })

    expect(result.success).toBe(true)
    expect(attemptCount).toBe(2)
    expect((engine as any).performFileTransfer).toHaveBeenCalledTimes(2)

    // Verify file was transferred
    const destContent = await fs.readFile(destPath, 'utf8')
    expect(destContent).toBe('Test content for retry logic')
  })

  it('should retry transfer when ENODEV error occurs', async () => {
    const engine = new FileTransferEngine()
    let attemptCount = 0

    const originalMethod = (engine as any).performFileTransfer.bind(engine)
    ;(engine as any).performFileTransfer = jest.fn(async (...args: any[]) => {
      attemptCount++
      if (attemptCount === 1) {
        const enodevError = new Error('ENODEV: no such device') as NodeJS.ErrnoException
        enodevError.code = 'ENODEV'
        throw TransferError.fromNodeError(enodevError)
      }
      return originalMethod(...args)
    })

    const result = await engine.transferFile(sourcePath, destPath, {
      maxRetries: 3,
      retryDelay: 100,
      verifyChecksum: false
    })

    expect(result.success).toBe(true)
    expect(attemptCount).toBe(2)
  })

  it('should retry transfer when ENOTCONN error occurs', async () => {
    const engine = new FileTransferEngine()
    let attemptCount = 0

    const originalMethod = (engine as any).performFileTransfer.bind(engine)
    ;(engine as any).performFileTransfer = jest.fn(async (...args: any[]) => {
      attemptCount++
      if (attemptCount === 1) {
        const enotconnError = new Error(
          'ENOTCONN: transport endpoint is not connected'
        ) as NodeJS.ErrnoException
        enotconnError.code = 'ENOTCONN'
        throw TransferError.fromNodeError(enotconnError)
      }
      return originalMethod(...args)
    })

    const result = await engine.transferFile(sourcePath, destPath, {
      maxRetries: 3,
      retryDelay: 100,
      verifyChecksum: false
    })

    expect(result.success).toBe(true)
    expect(attemptCount).toBe(2)
  })

  it('should exhaust retries and fail if error persists', async () => {
    const engine = new FileTransferEngine()
    let attemptCount = 0

    // Mock to always fail with ENXIO
    ;(engine as any).performFileTransfer = jest.fn(async () => {
      attemptCount++
      const enxioError = new Error(
        'ENXIO: no such device or address, close'
      ) as NodeJS.ErrnoException
      enxioError.code = 'ENXIO'
      throw TransferError.fromNodeError(enxioError)
    })

    await expect(
      engine.transferFile(sourcePath, destPath, {
        maxRetries: 3,
        retryDelay: 50,
        verifyChecksum: false
      })
    ).rejects.toThrow()

    // Should attempt 3 times (maxRetries)
    expect(attemptCount).toBe(3)
    expect((engine as any).performFileTransfer).toHaveBeenCalledTimes(3)
  })

  it('should not retry non-retryable errors like ENOSPC', async () => {
    const engine = new FileTransferEngine()
    let attemptCount = 0

    ;(engine as any).performFileTransfer = jest.fn(async () => {
      attemptCount++
      const enospcError = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException
      enospcError.code = 'ENOSPC'
      throw TransferError.fromNodeError(enospcError)
    })

    await expect(
      engine.transferFile(sourcePath, destPath, {
        maxRetries: 3,
        retryDelay: 50,
        verifyChecksum: false
      })
    ).rejects.toThrow()

    // Should only attempt once (no retries for non-retryable errors)
    expect(attemptCount).toBe(1)
  })
})
