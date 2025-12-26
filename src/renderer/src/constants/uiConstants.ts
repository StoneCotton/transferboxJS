/**
 * UI Constants
 * Centralizes magic numbers for UI timing and display
 */

// ===== Toast Notification Durations (ms) =====
export const TOAST_DURATION = {
  /** Short notifications - success confirmations, minor info */
  SHORT: 3000,
  /** Medium notifications - warnings, important info */
  MEDIUM: 4000,
  /** Long notifications - errors, important warnings */
  LONG: 5000,
  /** Extra long notifications - critical errors, multi-step info */
  EXTRA_LONG: 6000,
  /** Extended display - critical errors requiring user attention */
  EXTENDED: 8000
} as const

// ===== Animation Durations (ms) =====
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
} as const

// ===== Debounce/Throttle Intervals (ms) =====
export const DEBOUNCE_INTERVAL = {
  INPUT: 300,
  SEARCH: 500,
  RESIZE: 150
} as const
