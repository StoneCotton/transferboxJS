# State Management & UI

Consult this doc when working with Zustand store slices, transfer modes, file selection, or the app initialization flow.

## Store Architecture

Zustand store split into domain slices in `src/renderer/src/store/slices/`:

| Slice              | Responsibility                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `driveSlice.ts`    | Detected drives, selected drive, scanned files, file selection state, unmounted drive tracking |
| `transferSlice.ts` | Transfer progress, sessions, file-level tracking with retry counters                           |
| `configSlice.ts`   | App configuration                                                                              |
| `logSlice.ts`      | Application logs with filtering                                                                |
| `uiSlice.ts`       | UI state (modals, toasts, notifications history)                                               |
| `errorSlice.ts`    | Error handling with severity levels (low, medium, high, critical)                              |

Combined in `src/renderer/src/store/index.ts` with convenience hooks:

- `useDriveStore()`, `useTransferStore()`, `useConfigStore()`, etc.
- Selectors: `useIsTransferActive()`, `useIsTransferPaused()`, `useTransferStatistics()`
- File selection hooks: `useFileGroups()`, `useSelectedFilePaths()`, `useSelectionStats()`

## Transfer Modes

4 automation modes configured via settings:

| Mode               | Behavior                                                              |
| ------------------ | --------------------------------------------------------------------- |
| `fully-autonomous` | Auto-scan on drive insert + auto-transfer (no user intervention)      |
| `auto-transfer`    | Auto-scan on drive insert, user selects destination                   |
| `confirm-transfer` | Auto-scan, user must confirm before transfer starts                   |
| `manual`           | Full manual control (select drive, scan, select destination, confirm) |

Mode logic is implemented in `useAppInit.ts` hook with per-mode IPC event handling. It lives in the hook, NOT in store slices.

## Selective File Transfer

File selection state is managed in `driveSlice.ts`:

### State Structure (`FileSelectionState`)

- `selectedFolders: Set<string>` - Folder relative paths that are selected (all included by default)
- `deselectedFiles: Set<string>` - Individual file paths deselected within selected folders
- `expandedFolders: Set<string>` - UI state for expanded folders

### Selection Actions

- `toggleFolderSelection(relativePath)` - Toggle entire folder
- `toggleFileSelection(filePath, folderRelativePath)` - Toggle individual file
- `selectAllFolders(folderPaths)` / `deselectAllFolders()` - Bulk operations
- `setScannedFilesWithSelection(files, driveRoot)` - Initialize with all selected

### Key Utilities (`src/renderer/src/utils/fileGrouping.ts`)

- `groupFilesByFolder(files, driveRoot)` - Groups flat file list into `FolderGroup[]`
- `getSelectedFilePaths(groups, selectedFolders, deselectedFiles)` - Computes final transfer list
- `getSelectionStats()` - Selected/total counts and sizes
- `getFolderSelectionState()` - Full/partial selection (for checkbox indeterminate state)

### UI Components

- `FolderSection.tsx` - Collapsible folder with checkbox (supports indeterminate state)
- `FileItem.tsx` - Individual file row with checkbox
- `FileList.tsx` - Orchestrates folder sections with Select All/Deselect All

### Config Integration

`transferOnlyMediaFiles` config controls scan filtering:

- `true`: Scan only returns files matching `mediaExtensions`
- `false`: Scan returns ALL files on the drive

Selection resets to "all selected" on each new scan.

## Custom Hooks

### `useAppInit.ts`

Comprehensive initialization hook:

- Loads config, history, existing drives
- Sets up 18+ IPC event listeners
- Implements transfer mode-specific logic
- Sound manager integration
- System suspend/resume handling

### `useIpc.ts`

Type-safe IPC wrapper with 50+ methods for all IPC operations (config, drive, transfer, history, log management, update checking).

### `useUiDensity.ts`

UI density/theme preference management.
