/**
 * File and transfer-related constants
 * Centralizes magic numbers for better maintainability
 */

// ===== File Size Constants =====
export const BYTES_PER_KB = 1024
export const BYTES_PER_MB = 1024 * 1024
export const BYTES_PER_GB = 1024 * 1024 * 1024
export const BYTES_PER_TB = 1024 * 1024 * 1024 * 1024

// ===== Transfer Buffer Sizes =====
export const DEFAULT_BUFFER_SIZE = 4 * BYTES_PER_MB // 4MB - optimized for modern SSDs
export const NETWORK_BUFFER_SIZE = 1 * BYTES_PER_MB // 1MB for network transfers

// ===== Progress Reporting Thresholds =====
export const SMALL_FILE_THRESHOLD = 100 * BYTES_PER_MB // 100MB
export const MEDIUM_FILE_THRESHOLD = 1 * BYTES_PER_GB // 1GB
export const LARGE_FILE_THRESHOLD = 10 * BYTES_PER_GB // 10GB

// Progress intervals and minimum bytes for different file sizes
export const PROGRESS_SMALL_FILE = {
  interval: 200, // ms
  minBytes: 2 * BYTES_PER_MB
}

export const PROGRESS_MEDIUM_FILE = {
  interval: 500, // ms
  minBytes: 10 * BYTES_PER_MB
}

export const PROGRESS_LARGE_FILE = {
  interval: 1000, // ms
  minBytes: 50 * BYTES_PER_MB
}

export const PROGRESS_XLARGE_FILE = {
  interval: 2000, // ms
  minBytes: 100 * BYTES_PER_MB
}

// ===== Time Constants =====
export const ONE_HOUR_MS = 60 * 60 * 1000
export const ONE_DAY_MS = 24 * ONE_HOUR_MS
export const ORPHANED_FILE_MAX_AGE_MS = ONE_DAY_MS // 24 hours

// ===== Validation Limits =====
export const MAX_DEVICE_ID_LENGTH = 512
export const MAX_DISPLAY_NAME_LENGTH = 512
export const MAX_FILES_PER_TRANSFER = 100000

// ===== Path Length Limits =====
export const PATH_LENGTH_LIMITS = {
  win32: 260, // MAX_PATH on Windows (can be extended with \\?\ prefix)
  darwin: 1024, // PATH_MAX on macOS
  linux: 4096, // PATH_MAX on Linux
  default: 4096
} as const

