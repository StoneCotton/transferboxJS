/**
 * Configuration Manager Module
 * Handles application configuration using electron-store
 */

import Store from 'electron-store'
import {
  AppConfig,
  DEFAULT_CONFIG,
  TransferMode,
  FolderStructure,
  ChecksumAlgorithm
} from '../shared/types'

/**
 * Configuration Manager Class
 * Provides type-safe access to application configuration
 */
export class ConfigManager {
  private store: any // Using any to work around electron-store typing issues

  constructor(configPath?: string) {
    // Handle both CJS and ESM module formats
    const ElectronStore = (Store as any).default || Store
    this.store = new ElectronStore({
      name: 'transferbox-config',
      cwd: configPath,
      defaults: DEFAULT_CONFIG
    })
  }

  /**
   * Gets the current configuration
   */
  getConfig(): AppConfig {
    // electron-store provides a store property that contains all config
    return { ...this.store.store }
  }

  /**
   * Updates configuration with partial values
   * Validates before updating
   */
  updateConfig(updates: Partial<AppConfig>): AppConfig {
    // Validate the updates
    validateConfig(updates)

    // Get current config
    const currentConfig = this.getConfig()

    // Merge with updates
    const newConfig: AppConfig = {
      ...currentConfig,
      ...updates
    }

    // Save to store - set the entire store object
    this.store.store = newConfig

    return newConfig
  }

  /**
   * Resets configuration to defaults
   */
  resetConfig(): AppConfig {
    this.store.store = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }

  /**
   * Clears all configuration
   */
  clearConfig(): void {
    this.store.store = DEFAULT_CONFIG
  }

  /**
   * Gets the underlying store instance
   */
  getStore(): ElectronStore<AppConfig> {
    return this.store
  }
}

// Global instance for singleton pattern
let globalConfigManager: ConfigManager | null = null

/**
 * Gets or creates the global configuration manager instance
 */
function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager()
  }
  return globalConfigManager
}

/**
 * Gets the current configuration (convenience function)
 */
export function getConfig(): AppConfig {
  return getConfigManager().getConfig()
}

/**
 * Updates configuration (convenience function)
 */
export function updateConfig(updates: Partial<AppConfig>): AppConfig {
  return getConfigManager().updateConfig(updates)
}

/**
 * Resets configuration to defaults (convenience function)
 */
export function resetConfig(): AppConfig {
  return getConfigManager().resetConfig()
}

/**
 * Validates configuration updates
 * Throws an error if validation fails
 */
export function validateConfig(config: Partial<AppConfig>): void {
  // Validate transferMode
  if (config.transferMode !== undefined) {
    const validModes: TransferMode[] = ['manual', 'semi-auto', 'autonomous']
    if (!validModes.includes(config.transferMode)) {
      throw new Error(
        `Invalid transfer mode: ${config.transferMode}. Must be one of: ${validModes.join(', ')}`
      )
    }
  }

  // Validate folderStructure
  if (config.folderStructure !== undefined) {
    const validStructures: FolderStructure[] = [
      'date-based',
      'device-based',
      'flat',
      'preserve-source'
    ]
    if (!validStructures.includes(config.folderStructure)) {
      throw new Error(
        `Invalid folder structure: ${config.folderStructure}. Must be one of: ${validStructures.join(', ')}`
      )
    }
  }

  // Validate checksumAlgorithm
  if (config.checksumAlgorithm !== undefined) {
    const validAlgorithms: ChecksumAlgorithm[] = ['xxhash64']
    if (!validAlgorithms.includes(config.checksumAlgorithm)) {
      throw new Error(
        `Invalid checksum algorithm: ${config.checksumAlgorithm}. Must be one of: ${validAlgorithms.join(', ')}`
      )
    }
  }

  // Validate bufferSize
  if (config.bufferSize !== undefined) {
    if (config.bufferSize <= 0) {
      throw new Error('Buffer size must be greater than 0')
    }
    if (config.bufferSize > 10485760) {
      // 10MB max
      throw new Error('Buffer size must not exceed 10MB (10485760 bytes)')
    }
  }

  // Validate chunkSize
  if (config.chunkSize !== undefined) {
    if (config.chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0')
    }
    if (config.chunkSize > 104857600) {
      // 100MB max
      throw new Error('Chunk size must not exceed 100MB (104857600 bytes)')
    }
  }

  // Validate mediaExtensions
  if (config.mediaExtensions !== undefined) {
    if (!Array.isArray(config.mediaExtensions)) {
      throw new Error('Media extensions must be an array')
    }

    // Check each extension starts with a dot
    config.mediaExtensions.forEach((ext) => {
      if (!ext.startsWith('.')) {
        throw new Error(
          `Invalid media extension: ${ext}. Extensions must start with a dot (e.g., '.mp4')`
        )
      }
    })
  }

  // Validate logRetentionDays
  if (config.logRetentionDays !== undefined) {
    if (config.logRetentionDays < 0) {
      throw new Error('Log retention days must be 0 or greater (0 means keep forever)')
    }
  }

  // Validate timestampFormat
  if (config.timestampFormat !== undefined) {
    if (config.timestampFormat.trim() === '') {
      throw new Error('Timestamp format cannot be empty')
    }
  }

  // Validate defaultDestination path format if provided
  if (config.defaultDestination !== undefined && config.defaultDestination !== null) {
    if (typeof config.defaultDestination !== 'string') {
      throw new Error('Default destination must be a string or null')
    }
  }
}

/**
 * Gets a specific config value
 */
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return getConfig()[key]
}

/**
 * Sets a specific config value
 */
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): AppConfig {
  return updateConfig({ [key]: value } as Partial<AppConfig>)
}

/**
 * Checks if autonomous mode is enabled
 */
export function isAutonomousMode(): boolean {
  return getConfig().transferMode === 'autonomous'
}

/**
 * Checks if checksums are enabled
 */
export function isChecksumVerificationEnabled(): boolean {
  return getConfig().verifyChecksums
}

/**
 * Gets the default destination if set
 */
export function getDefaultDestination(): string | null {
  return getConfig().defaultDestination
}
