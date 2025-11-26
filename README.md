# TransferBox 📁

**Professional Media Ingest Utility**

TransferBox is a powerful desktop application designed for seamless, reliable file transfers from removable storage devices. Built with modern web technologies and optimized for professional workflows, it ensures data integrity through checksum verification while providing flexible automation options.

[![Version](https://img.shields.io/badge/version-2.0.1--beta.17-blue.svg)](https://github.com/StoneCotton/transferboxJS)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/StoneCotton/transferboxJS)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## ✨ Key Features

### 🔍 **Automated Drive Detection**

- Real-time monitoring of removable drives (SD cards, USB drives)
- Intelligent filtering to distinguish between truly removable and internal drives
- Automatic scanning for media files with customizable extensions
- Cross-platform drive detection (Windows drive letters, Unix mount points)

### 🚀 **Multiple Transfer Modes**

- **Fully Autonomous**: Auto-detect drives and transfer immediately
- **Auto Transfer**: Select destination, then auto-start transfers
- **Confirm Transfer**: Manual confirmation before each transfer
- **Manual**: Full control over every aspect of the process

### 🔒 **File Integrity & Verification**

- XXHash64 checksum verification with streaming validation
- Atomic operations using `.TBPART` temporary files
- Automatic retry with exponential backoff for device reconnection (5 attempts, ~24s window)
- No partial transfers - files are either complete or not present
- Orphaned `.TBPART` cleanup on startup (files older than 1 hour)

### 📂 **Smart File Organization**

- **Date-based**: Organize by creation date (YYYY-MM-DD)
- **Device-based**: Group by source device name
- **Flat**: All files in destination root
- **Preserve Source**: Maintain original folder structure
- Custom filename templates with variable substitution

### ⚡ **Performance & Reliability**

- Parallel processing (up to 10 concurrent file transfers, 3 default)
- Streaming file operations with 4MB buffer
- Real-time progress tracking with speed and ETA
- Robust error handling with device reconnection support
- SQLite database for comprehensive transfer history

### 🎯 **Professional Features**

- Customizable file naming templates with timestamps
- Sound notifications for transfer completion/errors
- Comprehensive logging with configurable retention policies
- System suspend/resume detection
- Transfer-in-progress quit protection
- Cross-platform support (Windows, macOS, Linux)

## 🚀 Installation

### For End Users

Download pre-built binaries from the [Releases](https://github.com/StoneCotton/transferboxJS/releases) page:

- **Windows**: `.exe` installer or portable executable
- **macOS**: `.dmg` or universal `.zip` archive
- **Linux**: `.AppImage` or `.deb` package

### For Developers

**Prerequisites:**

- Node.js 18+
- npm

**Setup:**

```bash
# Clone the repository
git clone https://github.com/StoneCotton/transferboxJS.git
cd transferbox

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build for specific platforms
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
npm run build:all     # All platforms
```

## 🎯 Quick Start Guide

1. **Launch TransferBox** and configure your preferred transfer mode in Settings
2. **Insert a removable drive** - TransferBox will automatically detect and scan for media files
3. **Choose destination** (or use your configured default location)
4. **Review the file list** and customize organization settings if needed
5. **Start the transfer** - monitor real-time progress with detailed per-file status
6. **Verify completion** with automatic checksum validation

## ⚙️ Configuration

### Transfer Modes

- **Fully Autonomous**: Set it and forget it - perfect for unattended workflows
- **Auto Transfer**: Choose destination, then automatic transfer starts
- **Confirm Transfer**: Review each transfer before it begins
- **Manual**: Complete control over every step

### File Organization

- **Date-based folders**: `2024-01-15/`
- **Device-based folders**: `Canon_EOS_R5/`
- **Custom templates**: `{device_name}_{date}/`
- **Preserve source structure**: Maintain original folder hierarchy

### Advanced Settings

- Customizable media file extensions (`.mp4`, `.raw`, `.cr2`, etc.)
- File naming templates with timestamps
- Checksum verification toggle
- Sound notifications for completion/errors
- Configurable concurrent transfer limit (1-10)
- Log retention policies (auto-cleanup)
- UI density options

## 🔧 Tech Stack

- **Electron 38** - Cross-platform desktop framework
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Zustand** - State management
- **electron-store** - Persistent configuration
- **better-sqlite3** - Transfer history database
- **xxhash-addon** - Fast checksum calculation
- **Tailwind CSS** - Styling
- **electron-vite** - Build tooling

## 🏗️ Architecture

### Process Separation

- **Main Process** (`src/main/`) - Node.js with full system access for file I/O, drive detection, checksums, database
- **Renderer Process** (`src/renderer/`) - React UI with `contextIsolation: true`, no direct Node.js access
- **Preload Script** (`src/preload/`) - Bridges main and renderer via `contextBridge`

### Key Modules

| Module               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `fileTransfer.ts`    | Atomic transfers with `.TBPART` pattern, checksums, retry logic |
| `driveMonitor.ts`    | Cross-platform removable drive detection via `drivelist`        |
| `configManager.ts`   | Versioned configuration with automatic migration                |
| `databaseManager.ts` | SQLite transfer history and logging                             |
| `pathProcessor.ts`   | File organization strategies and conflict resolution            |

### Security

- `contextIsolation: true` - Renderer isolated from main process
- `nodeIntegration: false` - Renderer cannot access Node APIs
- All IPC messages validated before processing
- Path validation to prevent traversal attacks

## 💻 System Requirements

- **Operating Systems**: Windows 10+, macOS 10.13+, Linux (modern distributions)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 200MB for application
- **Storage**: Sufficient space for your media files

## 🎬 Use Cases

- **Professional Photography**: Ingest SD cards from camera shoots
- **Video Production**: Transfer footage from external drives
- **Data Backup**: Reliable archival of important files
- **Media Asset Management**: Organized file transfers with verification

## 🧪 Development & Testing

TransferBox includes a comprehensive test suite using Jest and React Testing Library:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:main      # Main process tests
npm run test:renderer  # UI component tests
```

### Other Commands

```bash
npm run lint           # ESLint
npm run format         # Prettier formatting
npm run typecheck      # TypeScript type checking
npm run clean          # Clean build artifacts
npm run clean:build    # Clean and rebuild
```

### Test Organization

- `tests/main/` - Main process unit tests
- `tests/renderer/` - UI component tests
- `tests/integration/` - Cross-module integration tests
- `tests/shared/` - Shared utility tests

## 📊 Project Information

- **Author**: Tyler Saari
- **Version**: 2.0.1-beta.17
- **Homepage**: [tylersaari.net](https://tylersaari.net)
- **Repository**: [GitHub](https://github.com/StoneCotton/transferboxJS)

## 📄 License & Contributing

This project is licensed under the GNU General Public License v3.0. Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

---

**TransferBox** - Reliable, fast, and intelligent file transfers for professionals. ✨
