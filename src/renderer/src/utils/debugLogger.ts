/**
 * Debug Logger Utility
 * Development-only logging that is stripped in production
 */

const isDev = import.meta.env.DEV

type LogCategory =
  | 'drive'
  | 'transfer'
  | 'scan'
  | 'config'
  | 'ipc'
  | 'ui'
  | 'sound'
  | 'init'
  | 'store'
  | 'destination'

/**
 * Log a debug message (only in development mode)
 */
export function debugLog(category: LogCategory, message: string, ...args: unknown[]): void {
  if (isDev) {
    console.log(`[${category.toUpperCase()}] ${message}`, ...args)
  }
}

/**
 * Log a debug warning (only in development mode)
 */
export function debugWarn(category: LogCategory, message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(`[${category.toUpperCase()}] ${message}`, ...args)
  }
}

/**
 * Log a debug error (only in development mode)
 */
export function debugError(category: LogCategory, message: string, ...args: unknown[]): void {
  if (isDev) {
    console.error(`[${category.toUpperCase()}] ${message}`, ...args)
  }
}
