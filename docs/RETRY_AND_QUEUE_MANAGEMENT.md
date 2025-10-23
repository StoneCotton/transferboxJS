# Retry Logic and Queue Management

## How File Retry Works

### Individual File Retry (Not Batch Retry)

The retry logic operates at the **individual file level**, not the entire batch:

```
Batch Transfer: [File1, File2, File3, File4, File5]
                   ↓
File2 encounters ENXIO error (drive disconnected)
                   ↓
File2 enters retry loop (attempts: 1, 2, 3, 4, 5)
                   ↓
Meanwhile: File1, File3, File4, File5 continue processing
```

**Key Points:**

1. Each file transfer has its own retry mechanism (up to 5 attempts)
2. When one file fails and enters retry, other files continue transferring
3. The batch transfer uses `continueOnError: true` by default
4. Files are processed in parallel (3 concurrent transfers)

### Retry Behavior During Device Disconnection

**Scenario: SD Card Unplugged During Transfer**

```
Time 0s:  Transfer starts with 100 files
Time 30s: File #15 is actively transferring
          User unplugs SD card
          File #15 encounters ENXIO error

Time 30s: Retry Attempt 1 (immediate) - FAILS (drive still disconnected)
Time 32s: Retry Attempt 2 (after 2s delay) - FAILS
Time 36s: Retry Attempt 3 (after 4s delay) - User plugs card back in
Time 36s: Drive remounts...
Time 38s: Retry Attempt 4 (after 8s delay) - MAY SUCCEED if drive is mounted
Time 46s: Retry Attempt 5 (after 10s delay) - Final attempt

Meanwhile:
- Files #1-14: Already completed ✅
- File #15: Retrying (will succeed if drive remounts)
- Files #16-18: May fail if they were active when drive disconnected
- Files #19-100: Will wait in queue
```

## UI Queue Management Fix

### The Problem (Before Fix)

When a drive disconnected during transfer, the UI would show "**No Files Found**" because:

1. Drive disconnect event triggered `markDriveAsUnmounted()` or `removeDrive()`
2. These functions cleared the `scannedFiles` array
3. `FileList` component checked `if (scannedFiles.length === 0)` and showed "No Files Found"
4. Meanwhile, the transfer engine was still retrying files in the background
5. User had no visibility into what was happening

### The Solution (After Fix)

**Preserve Queue During Active Transfer** (`driveSlice.ts`):

```typescript
// Check if there's an active transfer - don't clear scannedFiles during transfer
const isTransferring = (state as any).isTransferring || false

// Only clear scan data if NOT transferring - preserve queue during retry
scannedFiles: state.selectedDrive?.device === device && !isTransferring ? [] : state.scannedFiles
```

**Now when drive disconnects during transfer:**

1. `scannedFiles` array is **preserved**
2. UI continues showing the file queue
3. Users can see:
   - ✅ Files already completed
   - 🔄 Files currently being retried
   - ⏳ Files still in queue
   - ❌ Files that failed after all retries

## What Users See During Retry

### UI States

**Normal Transfer:**

```
Transfer Queue (100 files)
✅ Complete: 45
🔄 Transferring: 3
⏳ Pending: 52
```

**During Device Disconnect + Retry:**

```
Transfer Queue (100 files)  ← QUEUE STAYS VISIBLE
✅ Complete: 45              ← Already transferred files preserved
🔄 Retrying: 3               ← Files attempting retry
⏳ Pending: 52               ← Remaining files waiting
```

**After Successful Retry (Drive Reconnected):**

```
Transfer Queue (100 files)
✅ Complete: 48              ← Retry succeeded, transfer continues
🔄 Transferring: 3
⏳ Pending: 49
```

**After Failed Retry (Drive Stays Disconnected):**

```
Transfer Queue (100 files)
✅ Complete: 45
❌ Failed: 3                 ← Shows DRIVE_DISCONNECTED error
⏳ Pending: 52               ← Will also fail when attempted
```

## File Status Tracking

### Database Updates

Each file's status is updated in real-time in the database:

```typescript
// During transfer
db.updateFileStatus(sessionId, file.source, {
  status: 'transferring',
  percentage: 50
})

// During retry (automatic)
db.updateFileStatus(sessionId, file.source, {
  status: 'transferring', // Status stays as transferring during retry
  percentage: 0 // Progress resets for retry attempt
})

// After completion
db.updateFileStatus(sessionId, file.source, {
  status: 'complete',
  checksum: 'abc123...',
  bytesTransferred: 1234567,
  percentage: 100
})

// After all retries exhausted
db.updateFileStatus(sessionId, file.source, {
  status: 'error',
  error: 'Drive may have been disconnected',
  errorType: 'DRIVE_DISCONNECTED'
})
```

### Progress Updates

The IPC `onTransferProgress` event includes complete file information:

```typescript
{
  totalFiles: 100,
  completedFilesCount: 45,
  failedFiles: 3,
  activeFiles: [
    {
      sourcePath: '/path/to/file.mp4',
      status: 'transferring',  // or 'retrying'
      percentage: 50,
      retryCount: 2            // Shows retry attempt number
    }
  ],
  completedFiles: [
    { sourcePath: '...', status: 'complete', checksum: '...' },
    { sourcePath: '...', status: 'error', error: 'DRIVE_DISCONNECTED' }
  ]
}
```

## Batch Transfer Flow with Retry

### Parallel Processing with Retries

```
Initial Queue: [F1, F2, F3, F4, F5, F6, F7, F8, F9, F10]

Active Transfers (CONCURRENT_LIMIT = 3):

T+0s:  [F1] [F2] [F3]  ← Start first 3 files

T+5s:  [F1✅] [F2] [F3]  ← F1 completes
       [F4] starts      ← F4 begins immediately

T+10s: [F2❌] [F3] [F4]  ← F2 fails (ENXIO), enters retry
       [F5] starts      ← F5 begins (batch continues)
       [F2🔄] retrying in background

T+12s: [F2🔄] [F3] [F4] [F5]  ← F2 retry attempt 2
       (4 transfers active during retry)

T+15s: [F3✅] [F4] [F5] [F2🔄]  ← F3 completes
       [F6] starts              ← F6 begins

T+16s: [F2✅] [F4] [F5] [F6]  ← F2 retry succeeds!
       Transfer continues normally...
```

**Key Insight:** The batch doesn't pause for retries. Other files continue processing while individual files retry in parallel.

## Testing the Fix

### Manual Test Procedure

1. **Start a transfer** with many files (50+)
2. **Wait for some files to complete** (5-10 files)
3. **Unplug the source SD card**
4. **Observe:**
   - ✅ Queue **remains visible** (not "No Files Found")
   - ✅ Completed files still shown
   - ✅ Active files show "retrying" status
   - ✅ Console logs show retry attempts
5. **Wait 2-3 seconds, then plug card back in**
6. **Observe:**
   - ✅ Transfer resumes automatically
   - ✅ Retry succeeds for disconnected files
   - ✅ Remaining files continue transferring

### Expected Behavior

**If drive reconnects within ~24 seconds:**

- Individual files that failed will retry successfully
- Batch transfer continues
- All files eventually complete

**If drive stays disconnected:**

- Individual files exhaust retry attempts
- Files are marked as failed with `DRIVE_DISCONNECTED` error
- Remaining files will also fail when attempted
- Queue remains visible showing all file statuses
- User can see exactly what succeeded/failed

## Configuration

Users can customize retry behavior:

```typescript
{
  maxRetries: 5,        // Default: 5 attempts
  retryDelay: 2000,     // Default: 2000ms initial delay
  continueOnError: true // Default: true - continue batch on individual file errors
}
```

## Benefits of This Approach

1. **Resilient**: Handles temporary disconnections automatically
2. **Non-blocking**: One file's failure doesn't stop the batch
3. **Visible**: UI always shows current state of all files
4. **Informative**: Users know exactly what's happening during retry
5. **Efficient**: Parallel processing with per-file retry = maximum throughput

## Drive Mount Detection During Reconnection

### Common Console Message: "Drive not mounted yet"

When you reconnect a drive, you might see this in the console:

```
Error occurred in handler for 'drive:scan': Error: Drive not mounted yet
```

**This is normal and expected!** Here's what's happening:

### The Mount Detection Process

```
Step 1: OS detects drive        → "New device connected!"
Step 2: TransferBox sees it     → "Let me scan for files!"
Step 3: OS is still mounting... → "Drive not mounted yet" (this error)
Step 4: Wait 1 second           → Retry
Step 5: Check again...          → Repeat up to 10 times
Step 6: Success!                → Drive scanned ✅
```

**Retry Window**: 10 seconds (10 attempts × 1 second)

### When This Happens

- **During drive reconnection** (after unplugging and replugging)
- **Auto-scan mode** (system tries to scan immediately)
- **Slow-mounting drives** (some SD cards take longer to mount)
- **USB hubs** (can add mounting delay)

### Is It a Problem?

**No!** This is informational logging. The system handles it automatically:

✅ **What the system does:**

- Waits patiently for drive to mount
- Retries every second for up to 10 seconds
- Scans successfully once mounted
- Only fails if drive doesn't mount within 10 seconds

❌ **When to be concerned:**

- Error persists after 10+ seconds
- Drive never shows up in the UI
- Physical connection issues with the drive

### Improved in Latest Version

We increased the mount detection timeout:

- **Before**: 2.5 seconds (5 retries × 500ms)
- **After**: 10 seconds (10 retries × 1 second)

This gives slower-mounting drives and reconnection scenarios more time to succeed.

## Limitations

1. **Retry window is finite**: ~24 seconds max for file transfer (by design)
2. **File-level retry only**: If multiple files fail, each retries independently
3. **No session-level retry**: Can't restart an entire session automatically
4. **Drive must remount**: Retry only works if the OS remounts the drive
5. **Mount detection timeout**: 10 seconds for drive to become available
