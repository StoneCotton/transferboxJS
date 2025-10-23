# Retry Logic Enhancement for Device Disconnection

## Issue

When a drive was physically disconnected during a file transfer (e.g., unplugging an SD card), the transfer would fail immediately without retrying, even though retry logic was in place. The error log showed:

```json
{
  "error": "ENXIO: no such device or address, close",
  "errorType": "UNKNOWN",
  "durationMs": 11893
}
```

The problem was that the `ENXIO` error code was not being recognized as a retryable device disconnection error.

## Root Cause

The error classification logic in `TransferError.fromNodeError()` was missing several device disconnection error codes, particularly:

- **ENXIO** - No such device or address (occurs when device is physically disconnected)
- **ENOTCONN** - Transport endpoint is not connected
- **ENODEV** - No such device
- **ESHUTDOWN** - Cannot send after transport endpoint shutdown

These errors were falling through to the default case, being classified as non-retryable `UNKNOWN` errors.

## Solution

### 1. Enhanced Error Classification (`src/main/errors/TransferError.ts`)

Added comprehensive device disconnection error codes to the retryable error list:

```typescript
// Drive disconnection (retryable)
if (
  code === 'enoent' || // No such file or directory
  code === 'eio' || // I/O error
  code === 'erofs' || // Read-only file system
  code === 'enxio' || // No such device or address (device disconnected) ✅ NEW
  code === 'enotconn' || // Transport endpoint is not connected ✅ NEW
  code === 'enodev' || // No such device ✅ NEW
  code === 'eshutdown' // Cannot send after transport endpoint shutdown ✅ NEW
) {
  return new TransferError(
    'Drive may have been disconnected',
    TransferErrorType.DRIVE_DISCONNECTED,
    true, // isRetryable = true
    error
  )
}
```

### 2. Error Wrapping in Transfer Logic (`src/main/fileTransfer.ts`)

Added a try-catch wrapper in `performFileTransfer()` to ensure all errors are properly wrapped with `TransferError` before being passed to the retry logic. This ensures that the `isRetryable` property is always set correctly:

```typescript
private async performFileTransfer(...): Promise<void> {
  try {
    // All file transfer operations
    // ...
  } catch (error) {
    // Wrap all errors in TransferError to ensure isRetryable property is set
    if (error instanceof TransferError) {
      throw error
    }
    if (error instanceof Error) {
      throw TransferError.fromNodeError(error as NodeJS.ErrnoException)
    }
    throw new TransferError(String(error), TransferErrorType.UNKNOWN, false)
  }
}
```

### 3. Enhanced Retry Timing (`src/main/fileTransfer.ts`)

Increased retry attempts and delays to accommodate physical device reconnection:

```typescript
// Optimized for device reconnection scenarios:
// Attempts at: 0s (immediate), 2s, 4s, 8s, 10s = ~24s total window
const retryConfig = {
  maxAttempts: options?.maxRetries || 5, // Increased from 3
  initialDelay: options?.retryDelay || 2000, // Increased from 1000ms
  maxDelay: 10000,
  backoffMultiplier: 2
}
```

### 4. Error Type Preservation (`src/main/utils/retryStrategy.ts`)

Fixed retry logic to preserve the original error type when all attempts are exhausted:

```typescript
// Before: throw new Error(`Operation failed after ${attempt} attempts: ...`)
// After: throw error  // Preserves TransferError with correct errorType
```

### 5. Comprehensive Test Coverage

Added integration tests to verify retry behavior for device disconnection scenarios:

- Test retry on ENXIO error (SD card disconnection)
- Test retry on ENODEV error
- Test retry on ENOTCONN error
- Test retry exhaustion after max attempts
- Test that non-retryable errors (ENOSPC) don't retry

All tests in `tests/integration/retry-on-device-disconnect.test.ts` now pass ✅

## Behavior After Fix

### When Device Disconnects During Transfer:

1. Transfer encounters `ENXIO` or similar error
2. Error is wrapped in `TransferError` with `DRIVE_DISCONNECTED` type and `isRetryable: true`
3. Retry logic activates with exponential backoff (optimized for physical device reconnection):
   - **Attempt 1**: Immediate
   - **Attempt 2**: After 2 second delay
   - **Attempt 3**: After 4 second delay
   - **Attempt 4**: After 8 second delay
   - **Attempt 5**: After 10 second delay (max)
   - **Total retry window: ~24 seconds**
4. If device is reconnected within the retry window, transfer resumes successfully
5. If device remains disconnected, all retries are exhausted and transfer fails with **error type preserved**

### Error Logging:

Now shows proper error classification with preserved error type:

```json
{
  "error": "Drive may have been disconnected",
  "errorType": "DRIVE_DISCONNECTED", // ✅ Correctly preserved (was showing "UNKNOWN")
  "durationMs": 11893
}
```

### Why This Matters:

The previous implementation would show `"errorType": "UNKNOWN"` even though it was actually a drive disconnection error. This made it impossible to properly handle or report different error types. Now the error type is correctly preserved through all retry attempts.

## Configuration

Users can customize retry behavior via transfer options:

```typescript
{
  maxRetries: 5,        // Number of retry attempts (default: 5, increased from 3)
  retryDelay: 2000,     // Initial delay in ms (default: 2000, increased from 1000)
  // Exponential backoff up to maxDelay (10000ms)
  // Timing optimized for physical device reconnection scenarios
}
```

## Additional Fix: Queue Management During Retry

### The UI Problem

When retry logic started (drive disconnected), users reported seeing "**No Files Found**" instead of the file queue. This happened because:

1. Drive disconnect triggered `markDriveAsUnmounted()` or `removeDrive()` in the drive store
2. These functions cleared the `scannedFiles` array
3. UI showed "No Files Found" even though files were being retried in the background

### The Solution

Modified `driveSlice.ts` to preserve the file queue during active transfers:

```typescript
// Check if there's an active transfer - don't clear scannedFiles during transfer
const isTransferring = (state as any).isTransferring || false

// Only clear scan data if NOT transferring - preserve queue during retry
scannedFiles: state.selectedDrive?.device === device && !isTransferring ? [] : state.scannedFiles
```

**Now users see:**

- ✅ Complete file queue remains visible
- ✅ Already transferred files shown
- ✅ Files being retried displayed with status
- ✅ Remaining queue items visible

See [RETRY_AND_QUEUE_MANAGEMENT.md](./RETRY_AND_QUEUE_MANAGEMENT.md) for detailed documentation on how retry works with the file queue.

## Test Results

- ✅ All TransferError tests pass (21 tests)
- ✅ All FileTransfer tests pass (22 tests)
- ✅ All FileTransfer edge case tests pass (8 tests)
- ✅ All retry on device disconnect tests pass (6 tests)
- ✅ Total: 321/322 tests passing (1 unrelated platform test)

## Impact

This fix makes the application significantly more robust when dealing with:

- USB drive disconnections/reconnections
- SD card removal/reinsertion
- Network drive temporary disconnections
- Any transient device communication errors

**Key Improvements:**

1. **Automatic retry** with exponential backoff (5 attempts over ~24 seconds)
2. **Error type preservation** - shows correct error type even after retries
3. **Queue visibility** - file list remains visible during retry
4. **Per-file retry** - individual files retry without stopping the batch
5. **Status tracking** - users see exactly what's completed/retrying/pending

The automatic retry with exponential backoff gives devices time to reconnect while preventing infinite retry loops, and the UI keeps users fully informed throughout the process.
