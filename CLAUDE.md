# CLAUDE.md

TransferBox: cross-platform Electron desktop app for reliable file transfers from removable storage (SD cards, USB drives). XXHash64 checksum verification, multiple automation modes for professional media workflows.

Electron 38 + React 19 + TypeScript 5.9 + Zustand + Tailwind CSS 3 + better-sqlite3 + electron-vite.

## Commands

```bash
npm run dev              # Dev server with hot reload
npm run build            # Full build (typecheck + test + electron-vite build)
npm run check            # Lint + typecheck (also runs automatically via pre-commit hook)
npm test                 # All tests
npm run test:main        # Main process tests only
npm run test:renderer    # Renderer tests only
npm run test:coverage    # Coverage report
npm run lint             # ESLint
npm run format           # Prettier
npm run build:mac        # macOS build
npm run build:win        # Windows build
npm run build:linux      # Linux build
```

## Architecture

**Main Process** (`src/main/`) - Node.js: file I/O, drive detection, checksums, database, IPC handlers. Entry: `src/main/index.ts`.

**Renderer Process** (`src/renderer/`) - React UI in Chromium, `contextIsolation: true`, NO direct Node.js access. Zustand store with slices (`src/renderer/src/store/`). Entry: `src/renderer/src/main.tsx`.

**Preload** (`src/preload/`) - Bridges main/renderer via `contextBridge`. Typed API on `window.api`. Only place where processes touch.

**Shared Types** (`src/shared/types/`) - IPC channels/payloads in `ipc.ts`, config in `config.ts`, transfer/drive types.

Key modules: `fileTransfer.ts` (transfer engine), `driveMonitor.ts` (drive detection), `configManager.ts` (versioned config), `databaseManager.ts` (SQLite history), `pathProcessor.ts` (file organization), `mhlGenerator.ts` (MHL 1.1 XML).

IPC handlers are modular: `src/main/ipc/` with `state.ts` for singletons and domain-specific handler files.

Services: `transferService.ts`, `dialogService.ts`, `checksumCalculator.ts`.

## Critical Safety Rules

These are non-negotiable constraints for every session:

- **Atomic transfers**: Always use `.TBPART` temp file pattern (write -> verify checksum -> rename). See `src/main/fileTransfer.ts`.
- **Async-only fs**: Never use synchronous fs operations in main process during transfers. Use `fs/promises`.
- **IPC validation**: All inputs from renderer MUST be validated before processing. Use validators from `utils/ipcValidator.ts`.
- **Context isolation**: `contextIsolation: true`, `nodeIntegration: false` - never change these.
- **Path safety**: Validate and sanitize all renderer-provided paths. Use `pathValidator.ts` and `securityValidation.ts`.
- **No shell injection**: Use `execFile()` with explicit args, never `shell: true` with user input.
- **Retry with `withRetry()`**: Use wrapper from `src/main/utils/retryStrategy.ts` for device operations (5 attempts, exponential backoff).
- **Safe file size math**: Use `safeAdd()`/`safeSum()` from `src/main/utils/fileSizeUtils.ts` to prevent overflow.
- **Error typing**: Use `TransferError` class from `src/main/errors/TransferError.ts`. Wrap unknowns with `wrapError()`.
- **Config changes**: Update `AppConfig` type in `src/shared/types/config.ts`, add to `DEFAULT_CONFIG`, bump `CONFIG_VERSION` if breaking.

## Important Constraints

- Progress updates debounced to ~100ms - don't spam IPC
- Max concurrent transfers: 3 default (configurable 1-10)
- Buffer size: 4MB default (configurable 1-10MB)
- Orphaned `.TBPART` files: cleaned up if older than 1 hour
- Pause: engine completes current file before stopping
- Auto-unmount: only after ALL files successfully transferred
- Power events: transfers auto-pause on system suspend

## Common Gotchas

- **Import alias**: Renderer uses `@renderer` alias (e.g., `@renderer/components/Button`), mapped to `src/renderer/src/`
- **contextBridge**: Only preload can expose APIs - renderer cannot import Node modules
- **Drive detection**: `drivelist` behavior varies by platform - test cross-platform
- **Menu integration**: Menu actions trigger IPC events to renderer (`MENU_OPEN_SETTINGS`, etc.)
- **Hot reload**: Dev mode uses `ELECTRON_RENDERER_URL` env var for HMR
- **Database location**: `app.getPath('userData')/transferbox.db`
- **Log location**: `app.getPath('userData')/logs/`
- **MHL files**: Generated alongside transfers when enabled, uses XXHash64
- **Transfer modes**: Mode logic lives in `useAppInit.ts`, not in store slices
- **IPC state**: DriveMonitor and MainWindow managed via `src/main/ipc/state.ts` singleton
- **Test mocks**: Use `tests/__mocks__/electron.ts` for Electron API mocks

## Further Reading

Before starting any task, identify which docs are relevant and read them.

- `docs/ipc-patterns.md` - Adding IPC channels, handler structure, 7-step walkthrough
- `docs/file-operations.md` - Transfer engine, atomic ops, retry strategy, checksums, streaming
- `docs/electron-security.md` - Security rules, path validation, IPC safety, preload safety
- `docs/react-patterns.md` - Component patterns, Zustand selectors, hooks, accessibility
- `docs/state-and-ui.md` - Store slices, transfer modes, file selection, app init flow
- `docs/testing-patterns.md` - Test organization, mocking, TDD workflow, factories
- `docs/tailwind-patterns.md` - Styling conventions, dark mode mappings, animations, design system
- `docs/development-patterns.md` - Dev methodology, debugging process, services pattern, config changes
