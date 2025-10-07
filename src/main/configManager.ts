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

    // Migrate config to ensure new extensions are added
    this.migrateConfig()
  }

  /**
   * Migrate config to ensure compatibility with current version
   */
  private migrateConfig(): void {
    const currentConfig = this.getConfig()
    const currentVersion = currentConfig.configVersion || 0
    const targetVersion = DEFAULT_CONFIG.configVersion

    console.log(
      `[ConfigManager] Migrating config from version ${currentVersion} to ${targetVersion}`
    )

    // If no version or version 0, this is an old config
    if (currentVersion < 1) {
      this.migrateFromVersion0()
    }

    // Update config version to current
    if (currentVersion < targetVersion) {
      this.store.set('configVersion', targetVersion)
    }

    // Always ensure media extensions are up to date
    this.migrateMediaExtensions()
  }

  /**
   * Migrate from version 0 (no version field) to version 1
   */
  private migrateFromVersion0(): void {
    console.log('[ConfigManager] Migrating from version 0 to version 1')

    const currentConfig = this.getConfig()

    // Fix the keepOriginalFilename issue - if it's true but addTimestampToFilename is false, set it to false
    if (
      currentConfig.keepOriginalFilename === true &&
      currentConfig.addTimestampToFilename === false
    ) {
      console.log('[ConfigManager] Fixing keepOriginalFilename dependency - setting to false')
      this.store.set('keepOriginalFilename', false)
    }
  }

  /**
   * Migrate media extensions to ensure new default extensions are added
   */
  private migrateMediaExtensions(): void {
    const currentConfig = this.getConfig()
    const currentExtensions = new Set(currentConfig.mediaExtensions.map((ext) => ext.toLowerCase()))
    const defaultExtensions = DEFAULT_CONFIG.mediaExtensions.map((ext) => ext.toLowerCase())

    // Find extensions in defaults that aren't in current config
    const missingExtensions = defaultExtensions.filter((ext) => !currentExtensions.has(ext))

    if (missingExtensions.length > 0) {
      console.log('[ConfigManager] Adding missing extensions:', missingExtensions)
      const updatedExtensions = [...currentConfig.mediaExtensions, ...missingExtensions]
      this.store.set('mediaExtensions', updatedExtensions)
    }
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

    // Additional validation that requires access to the full config
    this.validateConfigDependencies(newConfig)

    // Save to store - set the entire store object
    this.store.store = newConfig

    return newConfig
  }

  /**
   * Validates configuration dependencies that require access to the full config
   */
  private validateConfigDependencies(config: AppConfig): void {
    // Validate keepOriginalFilename dependency on addTimestampToFilename
    // If keepOriginalFilename is true, addTimestampToFilename should also be true
    // This ensures that when we add timestamps, we preserve the original filename
    if (config.keepOriginalFilename === true && config.addTimestampToFilename === false) {
      throw new Error('Keep Original Filename requires Add Timestamp to Filename to be enabled')
    }
  }

  /**
   * Resets configuration to defaults
   */
  resetConfig(): AppConfig {
    this.store.store = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }

  /**
   * Forces a complete config migration and validation
   * Useful for fixing corrupted or incompatible configs
   */
  forceMigration(): AppConfig {
    console.log('[ConfigManager] Forcing complete config migration')

    // Get current config
    const currentConfig = this.getConfig()

    // Create a new config by merging current with defaults
    const migratedConfig: AppConfig = {
      ...DEFAULT_CONFIG,
      ...currentConfig,
      configVersion: DEFAULT_CONFIG.configVersion
    }

    // Fix any known issues
    if (
      migratedConfig.keepOriginalFilename === true &&
      migratedConfig.addTimestampToFilename === false
    ) {
      console.log('[ConfigManager] Fixing keepOriginalFilename dependency during migration')
      migratedConfig.keepOriginalFilename = false
    }

    // Save the migrated config
    this.store.store = migratedConfig

    console.log('[ConfigManager] Config migration completed')
    return migratedConfig
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
  getStore(): Store<AppConfig> {
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
 * Forces a complete config migration (convenience function)
 */
export function forceMigration(): AppConfig {
  return getConfigManager().forceMigration()
}

/**
 * Validates configuration updates
 * Throws an error if validation fails
 */
export function validateConfig(config: Partial<AppConfig>): void {
  // Validate transferMode
  if (config.transferMode !== undefined) {
    const validModes: TransferMode[] = [
      'auto-transfer',
      'confirm-transfer',
      'fully-autonomous',
      'manual'
    ]
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

  // Validate filenameTemplate
  if (config.filenameTemplate !== undefined) {
    if (config.filenameTemplate.trim() === '') {
      throw new Error('Filename template cannot be empty')
    }
    // Check for required placeholders
    if (
      !config.filenameTemplate.includes('{original}') &&
      !config.filenameTemplate.includes('{timestamp}')
    ) {
      throw new Error('Filename template must contain at least {original} or {timestamp}')
    }
  }

  // Validate dateFolderFormat
  if (config.dateFolderFormat !== undefined) {
    if (config.dateFolderFormat.trim() === '') {
      throw new Error('Date folder format cannot be empty')
    }
  }

  // Validate deviceFolderTemplate
  if (config.deviceFolderTemplate !== undefined) {
    if (config.deviceFolderTemplate.trim() === '') {
      throw new Error('Device folder template cannot be empty')
    }
    if (!config.deviceFolderTemplate.includes('{device_name}')) {
      throw new Error('Device folder template must contain {device_name}')
    }
  }

  // Validate keepOriginalFilename dependency
  if (config.keepOriginalFilename !== undefined && config.keepOriginalFilename === true) {
    // This will be checked in the updateConfig method since we need access to the full config
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
  return getConfig().transferMode === 'fully-autonomous'
}

/**
 * Checks if mode requires confirmation
 */
export function requiresConfirmation(): boolean {
  const mode = getConfig().transferMode
  return mode === 'confirm-transfer' || mode === 'manual'
}

/**
 * Checks if mode auto-starts transfers
 */
export function autoStartsTransfer(): boolean {
  const mode = getConfig().transferMode
  return mode === 'auto-transfer' || mode === 'fully-autonomous'
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
