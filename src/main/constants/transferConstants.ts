/**
 * Transfer operation constants
 * Centralizes transfer engine configuration values
 */

// ===== Concurrency Limits =====
export const DEFAULT_CONCURRENT_LIMIT = 3
export const MIN_CONCURRENT_LIMIT = 1
export const MAX_CONCURRENT_LIMIT = 10

// ===== Transfer Timing =====
export const MAX_STOP_WAIT_TIME_MS = 5000
export const PROGRESS_AGGREGATION_INTERVAL_MS = 100
export const CLEANUP_DELAY_MS = 50

// ===== Buffer Size Limits =====
export const MIN_BUFFER_SIZE = 1024 // 1KB minimum
export const MAX_BUFFER_SIZE = 10485760 // 10MB maximum (matching configManager.ts)

// ===== Retry Configuration Defaults =====
export const DEFAULT_RETRY_ATTEMPTS = 5
export const DEFAULT_RETRY_INITIAL_DELAY = 2000
export const DEFAULT_RETRY_MAX_DELAY = 10000
