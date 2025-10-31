# TransferBox 📁

**Professional Media Ingest Utility**

TransferBox is a powerful desktop application designed for seamless, reliable file transfers from removable storage devices. Built with modern web technologies and optimized for professional workflows, it ensures data integrity through checksum verification while providing flexible automation options.

[![Version](https://img.shields.io/badge/version-2.0.1--beta.9-blue.svg)](https://github.com/StoneCotton/transferboxJS)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/StoneCotton/transferboxJS)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## ✨ Key Features

### 🔍 **Automated Drive Detection**

- Real-time monitoring of removable drives (SD cards, USB drives)
- Intelligent filtering to distinguish between truly removable and internal drives
- Automatic scanning for media files with customizable extensions

### 🚀 **Multiple Transfer Modes**

- **Fully Autonomous**: Auto-detect drives and transfer immediately
- **Auto Transfer**: Select destination, then auto-start transfers
- **Confirm Transfer**: Manual confirmation before each transfer
- **Manual**: Full control over every aspect of the process

### 🔒 **File Integrity & Verification**

- XXHash64 checksum verification with streaming validation
- Atomic operations using `.TBPART` temporary files
- Automatic retry with exponential backoff for device reconnection
- No partial transfers - files are either complete or not present

### 📂 **Smart File Organization**

- **Date-based**: Organize by creation date (YYYY-MM-DD)
- **Device-based**: Group by source device name
- **Flat**: All files in destination root
- **Preserve Source**: Maintain original folder structure

### ⚡ **Performance & Reliability**

- Parallel processing (up to 3 concurrent file transfers)
- Real-time progress tracking with speed and ETA
- Robust error handling with device reconnection support
- SQLite database for comprehensive transfer history

### 🎯 **Professional Features**

- Customizable file naming templates with timestamps
- Sound notifications for transfer completion
- Comprehensive logging with retention policies
- Cross-platform support (Windows, macOS, Linux)

## 📸 Screenshots

_Screenshots coming soon - TransferBox features a clean, modern interface with real-time progress tracking, drive selection, and comprehensive transfer management._

## 🚀 Installation

### For End Users

Download pre-built binaries from the [Releases](https://github.com/StoneCotton/transferboxJS/releases) page:

- **Windows**: `.exe` installer or portable executable
- **macOS**: `.dmg` or universal `.zip` archive
- **Linux**: `.AppImage` or `.deb` package

### For Developers

**Prerequisites:**

- Node.js 18+
- npm or yarn

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
npm run build:win    # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```

## 🎯 Quick Start Guide

1. **Launch TransferBox** and configure your preferred transfer mode in Settings
2. **Insert a removable drive** - TransferBox will automatically detect and scan for media files
3. **Choose destination** (or use your configured default location)
4. **Review the file list** and customize organization settings if needed
5. **Start the transfer** - monitor real-time progress with detailed per-file status
6. **Verify completion** with automatic checksum validation

## ⚙️ Configuration Highlights

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
- Sound notifications for completion
- Log retention policies (auto-cleanup)

## 🔧 Technical Highlights

**Built for Performance:**

- Electron + React + TypeScript architecture
- XXHash64 for fast checksum calculation
- Streaming file operations (4MB buffer)
- SQLite database for transfer history
- IPC architecture with contextIsolation for security

**Reliability Features:**

- Retry strategy optimized for device reconnection (5 attempts, ~24s window)
- Atomic file operations prevent corruption
- Comprehensive error handling and logging
- Cross-platform file system compatibility

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

TransferBox includes a comprehensive test suite:

- **Unit Tests**: All core modules with Jest
- **Integration Tests**: Critical workflows and edge cases
- **Test Coverage**: File transfer, drive monitoring, configuration management
- **Quality Assurance**: Automated testing for cross-platform compatibility

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:main      # Main process tests
npm run test:renderer  # UI component tests
```

## 📊 Project Information

- **Author**: Tyler Saari
- **Version**: 2.0.1-beta.5
- **Homepage**: [tylersaari.net](https://tylersaari.net)
- **Built with**: Modern web technologies for desktop

## 📄 License & Contributing

This project is open source and contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

---

**TransferBox** - Reliable, fast, and intelligent file transfers for professionals. ✨
