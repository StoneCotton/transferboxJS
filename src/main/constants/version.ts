/**
 * Version constants for main process
 * Single source of truth: uses Electron's app.getVersion()
 */

import { app } from 'electron'
import { VersionUtils } from '../../shared/utils/versionUtils'

/**
 * Get the current app version from Electron
 * This works in both development and production builds
 * In production: reads from app metadata set by electron-builder
 * In development: reads from package.json via electron-vite
 */
function getPackageVersion(): string {
  try {
    return app.getVersion()
  } catch (error) {
    console.error('[Version] Failed to get app version:', error)
    throw new Error('Unable to determine application version')
  }
}

/**
 * Application version from Electron
 * Format: major.minor.patch[-prerelease]
 * Example: "2.0.1-alpha.2"
 */
export const APP_VERSION = getPackageVersion()

/**
 * Config schema version - matches the full app version
 * This determines which config migrations to run
 *
 * Versioning Strategy:
 * - Major version changes: Breaking config changes requiring migration
 * - Minor version changes: New config options, backward compatible
 * - Patch version changes: Bug fixes, no config changes needed
 */
export const CONFIG_VERSION = APP_VERSION

/**
 * Minimum supported config version
 * Configs older than this will be reset to defaults
 */
export const MIN_SUPPORTED_CONFIG_VERSION = '2.0.0'

/**
 * Check if a version is compatible with minimum supported version
 */
export function isCompatible(version: string): boolean {
  return VersionUtils.isCompatible(version, MIN_SUPPORTED_CONFIG_VERSION)
}

/**
 * Get version info for display
 */
export function getVersionInfo(): {
  appVersion: string
  configVersion: string
  minSupportedVersion: string
} {
  return {
    appVersion: APP_VERSION,
    configVersion: CONFIG_VERSION,
    minSupportedVersion: MIN_SUPPORTED_CONFIG_VERSION
  }
}

// Re-export VersionUtils for convenience
export { VersionUtils }
