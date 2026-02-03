# File Operations

Consult this doc when working on the transfer engine, checksum verification, retry logic, or any file I/O in the main process.

## Atomic File Transfers

Always use the `.TBPART` temporary file pattern to prevent partial files:

```typescript
import * as fs from 'fs/promises'

async function transferFile(source: string, dest: string): Promise<void> {
  const tempPath = dest + '.TBPART'

  try {
    // 1. Write to temporary file
    await copyFileStreaming(source, tempPath)

    // 2. Verify checksum
    const [sourceHash, tempHash] = await Promise.all([
      calculateChecksum(source),
      calculateChecksum(tempPath)
    ])

    if (sourceHash !== tempHash) {
      throw new Error('Checksum verification failed')
    }

    // 3. Atomic rename (only succeeds if complete)
    await fs.rename(tempPath, dest)
  } catch (error) {
    // 4. Clean up temp file on any error
    await fs.unlink(tempPath).catch(() => {})
    throw error
  }
}
```

See `src/main/fileTransfer.ts` for the canonical implementation.

## Async-Only File Operations

Never use sync methods during transfers. They block the main process:

```typescript
// CORRECT
await fs.readFile(path)
await fs.writeFile(path, data)
await fs.stat(path)
await fs.mkdir(dir, { recursive: true })

// WRONG - blocks main process
fs.readFileSync(path) // DO NOT USE
fs.writeFileSync(path) // DO NOT USE
```

## Streaming for Large Files

Never load entire files into memory. Use streams with chunked processing:

```typescript
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

const DEFAULT_BUFFER_SIZE = 4 * 1024 * 1024 // 4MB chunks

async function copyFileStreaming(
  source: string,
  dest: string,
  onProgress?: (bytes: number) => void
): Promise<void> {
  const readStream = createReadStream(source, { highWaterMark: DEFAULT_BUFFER_SIZE })
  const writeStream = createWriteStream(dest)

  let transferred = 0
  readStream.on('data', (chunk: Buffer) => {
    transferred += chunk.length
    onProgress?.(transferred)
  })

  await pipeline(readStream, writeStream)
}
```

## Checksum Verification

Always verify file integrity using XXHash64 via `xxhash-addon`:

```typescript
import { createReadStream } from 'fs'
import { XXHash64 } from 'xxhash-addon'

async function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = new XXHash64()
    const stream = createReadStream(filePath)

    stream.on('data', (chunk: Buffer) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

## Safe File Size Arithmetic

Use utilities from `src/main/utils/fileSizeUtils.ts` to prevent overflow:

```typescript
import { safeAdd, safeSum, validateFileSize } from './utils/fileSizeUtils'
import { BYTES_PER_GB } from './constants/fileConstants'

const totalSize = safeAdd(file1.size, file2.size)
const batchSize = safeSum(files.map((f) => f.size))

if (!validateFileSize(size)) {
  throw new Error('File size exceeds safe limits')
}
```

## Retry Strategy

Use `withRetry()` from `src/main/utils/retryStrategy.ts` for device reconnection scenarios:

- 5 attempts total
- Delays: 500ms, 1000ms, 2000ms, 4000ms, 8000ms (~15.5s total window)
- Exponential backoff with jitter

```typescript
import { withRetry } from './utils/retryStrategy'

const result = await withRetry(() => fs.readFile(sourcePath), {
  maxAttempts: 5,
  shouldRetry: (error) => {
    const code = (error as NodeJS.ErrnoException).code
    return ['EBUSY', 'EIO', 'EAGAIN'].includes(code ?? '')
  }
})
```

## Error Handling

Use `TransferError` for consistent error typing:

```typescript
import { TransferError, TransferErrorType } from './errors/TransferError'

try {
  return await fs.readFile(filePath)
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    throw new TransferError(
      TransferErrorType.FileNotFound,
      `File not found: ${path.basename(filePath)}`,
      { path: filePath }
    )
  }
  throw TransferError.wrapError(error, 'File read failed')
}
```

## Progress Reporting

Debounce progress updates to ~100ms intervals to avoid IPC spam:

```typescript
function createProgressReporter(
  onProgress: (progress: TransferProgress) => void,
  debounceMs = 100
): (bytes: number) => void {
  let lastReport = 0

  return (bytes: number) => {
    const now = Date.now()
    if (now - lastReport >= debounceMs) {
      onProgress({ bytesTransferred: bytes, timestamp: now })
      lastReport = now
    }
  }
}
```

## Temporary File Cleanup

Orphaned `.TBPART` files older than 1 hour are cleaned up on startup.

## Conflict Resolution

File conflicts are handled via strategies: `skip`, `overwrite`, or `rename`. See `src/main/pathProcessor.ts` for implementation.

## File Locking

Prevent concurrent access using an in-memory `Set<string>` of active transfer keys (`source:dest`). See `src/main/fileTransfer.ts`.
