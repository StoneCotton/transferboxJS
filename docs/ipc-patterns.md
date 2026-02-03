# IPC Patterns

Consult this doc when adding new IPC channels, modifying handler structure, or debugging main-renderer communication.

## Adding a New IPC Channel

Follow these 7 steps in order:

### 1. Define Channel

In `src/shared/types/ipc.ts`:

```typescript
export const IPC_CHANNELS = {
  MY_OPERATION: 'namespace:operation'
} as const
```

### 2. Add Types

Add to `IpcHandlers` (request-response) or `IpcEvents` (one-way) interface in the same file.

### 3. Register Handler

Create or add to the appropriate handler file in `src/main/ipc/*Handlers.ts`:

```typescript
export function registerMyHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MY_OPERATION, async (_, arg) => {
    // Validate arg with validators from utils/ipcValidator.ts
    // Perform operation
    // Return result
  })
}
```

### 4. Wire Up Registration

In `src/main/ipc/index.ts`:

```typescript
import { registerMyHandlers } from './myHandlers'

export function setupIpcHandlers(): void {
  // ... existing handlers
  registerMyHandlers()
}
```

### 5. Expose in Preload

In `src/preload/index.ts`:

```typescript
myOperation: (arg) => ipcRenderer.invoke(IPC_CHANNELS.MY_OPERATION, arg)
```

### 6. Add Preload Types

Update `src/preload/index.d.ts` with the new method signature.

### 7. Call from Renderer

```typescript
const result = await window.api.myOperation(arg)
```

## Handler Module Structure

The IPC layer is modular with centralized state:

- `src/main/ipc/index.ts` - Orchestration (setupIpcHandlers, startDriveMonitoring, cleanupIpc)
- `src/main/ipc/state.ts` - Shared state management (DriveMonitor, MainWindow singletons)

Handler modules:

| Module                | Responsibility                                                   |
| --------------------- | ---------------------------------------------------------------- |
| `configHandlers.ts`   | Configuration CRUD                                               |
| `driveHandlers.ts`    | Drive operations (list, scan, unmount, reveal)                   |
| `transferHandlers.ts` | Transfer lifecycle (validate, start, stop, pause, resume, retry) |
| `historyHandlers.ts`  | Transfer history queries                                         |
| `logHandlers.ts`      | Log retrieval and clearing                                       |
| `pathHandlers.ts`     | Path validation and selection                                    |
| `systemHandlers.ts`   | System operations                                                |
| `updateHandlers.ts`   | Update checking                                                  |

## IPC Communication Patterns

- Use typed IPC channels with clear naming (e.g., `file:transfer:start`, `drive:detect`).
- Use `ipcMain.handle` / `ipcRenderer.invoke` for request-response.
- Use event emitters (`webContents.send` / `ipcRenderer.on`) for progress updates and streaming data.
- Handle IPC errors gracefully with proper error types.

## Power Monitoring

Handle system suspend/resume events in main process:

```typescript
powerMonitor.on('suspend', () => {
  // Pause active transfers, notify renderer
})

powerMonitor.on('resume', () => {
  // Resume or prompt user for transfer state
})
```

Renderer receives events via IPC and updates UI accordingly.
