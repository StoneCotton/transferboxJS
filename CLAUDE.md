# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TransferBox is a cross-platform Electron desktop application for reliable file transfers from removable storage devices (SD cards, USB drives). It ensures data integrity through XXHash64 checksum verification and provides multiple automation modes for professional media workflows.

**Tech Stack:**
- Electron 38 (main + renderer process architecture)
- React 19 + TypeScript
- Zustand for state management
- electron-store for persistent configuration
- better-sqlite3 for transfer history database
- Tailwind CSS for styling
- Jest + React Testing Library for testing

## Common Development Commands

### Development & Building
```bash
npm run dev              # Start development server with hot reload
npm run build           # Full build (runs typecheck + test + electron-vite build)
npm run clean:build     # Clean output directories and rebuild
```

### Type Checking
```bash
npm run typecheck        # Run both node and web type checking
npm run typecheck:node   # Type check main process code (tsconfig.node.json)
npm run typecheck:web    # Type check renderer process code (tsconfig.web.json)
```

### Testing
```bash
npm test                 # Run all tests (main + renderer)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report
npm run test:main        # Run only main process tests
npm run test:renderer    # Run only renderer process tests
```

### Linting & Formatting
```bash
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
```

### Platform-Specific Builds
```bash
npm run build:mac       # Build for macOS (universal)
npm run build:win       # Build for Windows
npm run build:linux     # Build for Linux
npm run build:all       # Build for all platforms
npm run build:mac-arm64 # Build for macOS ARM64 only
```

## Architecture Overview

### Electron Process Separation

**Main Process** (`src/main/`):
- Runs Node.js with full system access
- Handles file I/O, drive detection, checksums, database operations
- Communicates with renderer via IPC (defined in `src/shared/types/ipc.ts`)
- Entry point: `src/main/index.ts`

**Renderer Process** (`src/renderer/`):
- Runs React UI in Chromium with `contextIsolation: true`
- NO direct Node.js access - all system operations via IPC
- Uses Zustand store pattern with slices (`src/renderer/src/store/`)
- Entry point: `src/renderer/src/main.tsx`

**Preload Script** (`src/preload/`):
- Bridges main and renderer with `contextBridge`
- Exposes typed API via `window.api` (defined in `src/preload/index.d.ts`)
- Only place where main/renderer worlds touch

**Shared Types** (`src/shared/types/`):
- Type definitions used by both processes
- IPC channel names and payload types in `ipc.ts`
- Configuration schema in `config.ts`
- Transfer/drive types in `transfer.ts` and `drive.ts`

### Key Modules

**File Transfer Engine** (`src/main/fileTransfer.ts`):
- Atomic operations using `.TBPART` temporary files
- Streaming file I/O with 4MB buffer
- XXHash64 checksum verification
- Parallel transfers (up to 3 concurrent files, configurable 1-10)
- Retry strategy optimized for device reconnection (5 attempts, ~24s window)
- Progress tracking with speed/ETA calculation

**Drive Monitor** (`src/main/driveMonitor.ts`):
- Uses `drivelist` library for cross-platform drive detection
- Polls every 2 seconds for drive changes
- Filters removable drives from system/network drives
- Platform-specific logic for Windows (drive letters) vs Unix (mount points)
- Scans for media files based on configured extensions

**Configuration Manager** (`src/main/configManager.ts`):
- Uses `electron-store` for persistent JSON configuration
- Automatic migration between config versions
- Handles "newer config" warning when app is downgraded
- Validates and applies defaults using Zod schemas

**Database Manager** (`src/main/databaseManager.ts`):
- SQLite database for transfer history and logging
- Stores transfer sessions with full file-level details
- Log retention with automatic cleanup (default 7 days)

**Path Processor** (`src/main/pathProcessor.ts`):
- Handles file organization strategies: date-based, device-based, flat, preserve-source
- Custom filename templates with variable substitution
- Conflict detection and resolution (skip/rename/overwrite)

**IPC Setup** (`src/main/ipc.ts`):
- Centralizes all `ipcMain.handle()` registrations
- Request/response validation using validators from `src/main/utils/ipcValidator.ts`
- Security validation for paths from `src/main/utils/securityValidation.ts`

### State Management (Renderer)

Zustand store is split into domain slices (`src/renderer/src/store/slices/`):
- `driveSlice.ts` - Detected drives, selected drive, scanned files
- `transferSlice.ts` - Transfer progress, current session, history
- `configSlice.ts` - App configuration
- `logSlice.ts` - Application logs with filtering
- `uiSlice.ts` - UI state (modals, destination selection)
- `errorSlice.ts` - Global error handling

Combined in `src/renderer/src/store/index.ts` with convenience hooks.

### Security Architecture

- **contextIsolation: true** - Renderer isolated from main process
- **nodeIntegration: false** - Renderer cannot access Node APIs
- All IPC messages validated in main process before processing
- Path validation to prevent traversal attacks (`pathValidator.ts`, `securityValidation.ts`)
- No shell command injection - uses `execFile()` with validation

### Testing Strategy

**Test Organization:**
- Main process tests: `tests/main/` (node environment)
- Renderer tests: `tests/renderer/` (jsdom environment)
- Integration tests: `tests/integration/` (cross-module scenarios)
- Shared utilities: `tests/shared/`

**Test Philosophy (from .cursor/rules/typescript.mdc):**
- Write tests BEFORE implementing changes
- Test IPC communication with proper mocking
- Use temporary directories for file operation tests
- Ensure all tests pass before making follow-up changes

**Coverage:**
- Main process modules in `src/main/**/*.ts` (excluding `index.ts`)
- Preload scripts in `src/preload/**/*.ts`
- Coverage reports in `coverage/` directory

## Critical Implementation Patterns

### Atomic File Operations

Always use the `.TBPART` temporary file pattern for transfers:
```typescript
const tempPath = destPath + '.TBPART'
// 1. Write to tempPath
// 2. Verify checksum
// 3. Rename tempPath -> destPath
// 4. Clean up on error
```

See `src/main/fileTransfer.ts` for the canonical implementation. This ensures no partial files on interruption.

### Retry Strategy for Device Reconnection

The retry strategy in `src/main/utils/retryStrategy.ts` is specifically tuned for USB device reconnection:
- 5 attempts total
- Delays: 500ms, 1000ms, 2000ms, 4000ms, 8000ms (~15.5s total)
- Exponential backoff with jitter
- Allows ~24s window for device reconnection after unmount/remount

When adding retry logic, use `withRetry()` wrapper from `retryStrategy.ts`.

### IPC Communication Pattern

1. Define channel in `src/shared/types/ipc.ts`:
   ```typescript
   export const IPC_CHANNELS = {
     MY_OPERATION: 'namespace:operation'
   } as const
   ```

2. Add types to `IpcHandlers` or `IpcEvents` interface

3. Register handler in `src/main/ipc.ts`:
   ```typescript
   ipcMain.handle(IPC_CHANNELS.MY_OPERATION, async (_, arg) => {
     // Validate arg with validators from utils/ipcValidator.ts
     // Perform operation
     // Return result
   })
   ```

4. Expose in preload (`src/preload/index.ts`):
   ```typescript
   myOperation: (arg) => ipcRenderer.invoke(IPC_CHANNELS.MY_OPERATION, arg)
   ```

5. Add to preload types (`src/preload/index.d.ts`)

6. Call from renderer:
   ```typescript
   const result = await window.api.myOperation(arg)
   ```

### Cross-Platform Path Handling

- Always use `path.join()` and `path.resolve()` for path operations
- Never hardcode `/` or `\` separators
- Use `process.platform` checks for platform-specific logic
- Test on Windows (drive letters), macOS, and Linux (mount points)

### File Size Arithmetic

Use safe arithmetic from `src/main/utils/fileSizeUtils.ts`:
- `safeAdd()` - Prevents overflow when summing file sizes
- `safeSum()` - Safely sum array of sizes
- `validateFileSize()` - Ensures size is within safe integer range
- Constants in `src/main/constants/fileConstants.ts` (BYTES_PER_GB, etc.)

## Configuration System

Configuration is versioned and migrates automatically:
- Current version in `src/main/constants/version.ts`
- Schema validation in `src/shared/types/config.ts`
- Migration logic in `src/main/configManager.ts`

When adding new config fields:
1. Update `AppConfig` type in `src/shared/types/config.ts`
2. Add to `DEFAULT_CONFIG` in `configManager.ts`
3. Increment `CONFIG_VERSION` if breaking change
4. Add migration logic in `migrateConfig()` if needed

## Error Handling

Use the `TransferError` class from `src/main/errors/TransferError.ts`:
- Categorizes errors by type (filesystem, validation, checksum, etc.)
- Includes context for debugging
- Wraps unknown errors with `wrapError()`
- Error types defined in `src/shared/types/transfer.ts`

## Important Constraints

1. **Never use synchronous fs operations** in main process during transfers - use `fs/promises`
2. **Progress updates are debounced** to ~100ms intervals - don't spam IPC
3. **Maximum concurrent transfers:** 3 by default (configurable 1-10)
4. **File buffer size:** 4MB (DEFAULT_BUFFER_SIZE constant)
5. **Orphaned .TBPART files:** Cleaned up if older than 1 hour
6. **Test files:** Use `tests/__mocks__/electron.ts` for Electron API mocks

## Common Gotchas

- **Import alias:** Renderer uses `~/` alias (e.g., `~/components/Button`), mapped to `src/renderer/src/`
- **contextBridge:** Only preload can expose APIs - renderer cannot import Node modules directly
- **Drive detection:** `drivelist` behavior varies by platform - always test cross-platform
- **Menu integration:** Menu actions trigger IPC events to renderer (`MENU_OPEN_SETTINGS`, etc.)
- **Hot reload:** Dev mode uses `ELECTRON_RENDERER_URL` env var for HMR
- **Database location:** SQLite database in `app.getPath('userData')/transferbox.db`
- **Log location:** Logs in `app.getPath('userData')/logs/`

## Development Process (from .cursor/rules/typescript.mdc)

1. **Deep Dive Analysis**: Understand task requirements and constraints
2. **Planning**: Develop clear architectural plan
3. **Test Driven Development**: Write tests for desired outcomes before implementation
4. **Implementation**: Implement step-by-step following best practices
5. **Review and Optimize**: Review code for optimization opportunities
6. **Finalization**: Ensure code is secure, performant, and meets requirements

When debugging:
- Conduct differential diagnosis before fixes
- Ask "Is this THE issue or just AN issue?"
- Make one major change at a time and test
- Maintain debugging backlog for non-critical issues
