# TransferBox - Electron Migration Project

## Project Overview

TransferBox is a professional-grade, cross-platform media file transfer utility being migrated
from Python to a native Electron application. The app provides automated, verified file
transfers from removable storage (SD cards, USB drives) to designated backup locations.

## Core Functionality

### Primary Features

1. **Automated Media Transfer**: Detect removable storage, scan for media files, and transfer
   to designated destination with real-time progress tracking
2. **Data Integrity**: Built-in checksum verification using xxHash64 to guarantee file integrity
3. **Real-Time UI Updates**: WebSocket-based communication for live progress, status, and logging
4. **Configurable Workflows**: Extensive configuration for file naming, folder structure,
   filtering, and checksums

### Key User Flow

1. User sets destination path (validated for permissions and accessibility)
2. User inserts removable storage device (SD card/USB drive)
3. System auto-detects new drive and scans for media files
4. System transfers files with real-time progress updates
5. System verifies each file via checksum comparison
6. System safely unmounts drive and returns to standby mode

## Technical Requirements

### Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build Tool**: Vite (via electron-vite)
- **Main Process**: Node.js for system operations (file I/O, drive detection, checksums)
- **IPC**: Electron IPC for main-renderer communication (replacing WebSocket)
- **State Management**: React hooks for local state

### Critical Features to Implement

1. **File Transfer Engine**
   - Buffered file copying with progress tracking
   - Temporary .TBPART files during transfer (atomic operations)
   - xxHash64 checksum calculation during copy (use npm package: xxhash-addon or js-xxhash)
   - Checksum verification after transfer
   - Rename to final filename only after successful verification

2. **Drive Detection**
   - Platform-specific drive monitoring (Node.js fs, drivelist package, or native modules)
   - Detect newly inserted removable storage
   - Get drive metadata (name, path, capacity)
   - Safe unmount after transfer

3. **Path Validation**
   - Validate destination path exists and is writable
   - Prevent system directories (/, /System, /Windows, C:\, etc.)
   - Check available disk space
   - Proper permissions verification

4. **Progress Tracking**
   - Per-file progress (bytes transferred, percentage)
   - Overall transfer progress (files completed, total progress)
   - Transfer speed calculation (MB/s)
   - ETA estimation
   - Real-time updates to renderer process

5. **Configuration System**
   - YAML config file (use js-yaml package)
   - Configurable options:
     - File naming (timestamp formats, preserve original names)
     - Folder structure (date-based, device-based, flat, preserve source)
     - Media file filtering (extensions whitelist)
     - Checksum algorithms (xxHash64 default)
     - Buffer/chunk sizes
   - Runtime config updates without restart
   - Config editor UI in app

6. **Error Handling**
   - Graceful handling of drive removal during transfer
   - File-level error handling (skip bad files, continue transfer)
   - User-friendly error messages
   - Detailed error logging
   - Recovery from crashes (cleanup .TBPART files on startup)

7. **Logging**
   - Application logs (startup, errors, operations)
   - Per-transfer logs (file list, checksums, statistics, timestamp)
   - Optional MHL file generation (XML manifest with checksums)
   - Log viewer in UI (real-time log tail)

### UI/UX Requirements

**Main Interface Components:**

- Header with app name, version, and shutdown button
- Destination path input with validation
- Status display (current operation, visual indicators)
- Card detection indicator (shows when drive detected)
- Progress bars (per-file and overall)
- Transfer statistics (speed, elapsed time, ETA, file count)
- Real-time log viewer
- Configuration modal (gear icon)
- Stop transfer button (during active transfer)

**Key UX Principles:**

- Real-time feedback for all operations
- Clear visual indicators for system state (waiting, transferring, complete, error)
- Non-blocking UI (long operations don't freeze interface)
- Confirmation dialogs for destructive actions (stop transfer, shutdown)
- Success/error notifications

### File Organization Options

Support multiple destination folder structures:

1. **Date-based**: `2025/04/03/files...`
2. **Device-based**: `SD_Card_NO_NAME/files...`
3. **Flat**: All files in destination root with timestamp suffixes
4. **Preserve source structure**: Maintain original folder hierarchy

## Code Quality Requirements

- **KISS**: Keep implementations simple and straightforward
- **DRY**: Reusable functions for common operations (file copying, checksum calc, validation)
- **TDD**: Write tests for core functionality (file operations, checksums, validation, path handling)
- **TypeScript**: Strong typing throughout, minimal 'any' types
- **Error Handling**: Comprehensive try-catch, graceful degradation
- **Modularity**: Separate concerns (file operations, drive management, UI logic, config)

## Migration Considerations

- Replace Python's FastAPI + WebSocket with Electron IPC (ipcMain/ipcRenderer)
- Replace Python file I/O with Node.js fs/promises
- Replace Python's xxHash with JavaScript xxHash library
- Replace Python's drive detection with Node.js drivelist or native modules
- Maintain the same user-facing functionality and workflow
- Improve startup time and resource usage compared to Python version

## Suggested Project Structure

transferbox/
├── src/
│ ├── main/ # Electron main process
│ │ ├── index.ts # Main entry point
│ │ ├── fileTransfer.ts # File transfer engine
│ │ ├── driveMonitor.ts # Drive detection
│ │ ├── checksumCalculator.ts # xxHash calculation
│ │ ├── pathValidator.ts # Path validation logic
│ │ ├── configManager.ts # Config file handling
│ │ └── logger.ts # Logging system
│ ├── preload/ # Preload scripts
│ │ └── index.ts # IPC API exposure
│ └── renderer/ # React frontend
│ ├── src/
│ │ ├── App.tsx
│ │ ├── components/ # UI components
│ │ ├── hooks/ # Custom React hooks
│ │ ├── types/ # TypeScript types
│ │ └── utils/ # Helper functions
│ └── index.html
├── tests/ # Test files
├── config.yml # Default configuration
└── package.json

## Development Priorities

1. Set up basic Electron shell with React renderer
2. Implement path validation and destination setting
3. Implement drive detection and monitoring
4. Build file transfer engine with checksum verification
5. Add progress tracking and IPC communication
6. Create UI components for all features
7. Implement configuration system
8. Add logging and error handling
9. Write tests for core functionality
10. Polish UI/UX and add tutorials

## Questions to Consider

- Should we use SQLite for transfer history/logging instead of text files?
- Native Node modules vs pure JS for drive detection?
- Electron auto-updater for future releases?
- Package for multiple platforms (Mac, Windows, Linux)?
