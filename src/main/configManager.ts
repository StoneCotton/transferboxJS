/**
 * Configuration Manager Module
 * Handles application configuration using electron-store
 */

import Store from 'electron-store'
import { app } from 'electron'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  AppConfig,
  DEFAULT_CONFIG,
  TransferMode,
  FolderStructure,
  ChecksumAlgorithm
} from '../shared/types'
import { CONFIG_VERSION, isCompatible, VersionUtils } from './constants/version'
import { getLogger } from './logger'

/**
 * Get default config with current version from package.json
 */
function getDefaultConfig(): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    configVersion: CONFIG_VERSION
  }
}

/**
 * Configuration Manager Class
 * Provides type-safe access to application configuration
 */
export class ConfigManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- electron-store has complex generic types that don't work well with mocking
  private store: any
  private lastMigration: { fromVersion: string; toVersion: string } | null = null

  constructor(configPath?: string) {
    // Handle both CJS and ESM module formats
    const ElectronStore = (Store as unknown as { default?: typeof Store }).default || Store
    this.store = new ElectronStore({
      name: 'transferbox-config',
      cwd: configPath,
      defaults: getDefaultConfig()
    })

    // Migrate config to ensure new extensions are added
    this.migrateConfig()
  }

  /**
   * Migrate config to ensure compatibility with current version
   */
  private migrateConfig(): void {
    const currentConfig = this.getConfig()
    const currentVersion = currentConfig.configVersion
      ? String(currentConfig.configVersion)
      : '0.0.0'
    const targetVersion = CONFIG_VERSION

    console.log(
      `[ConfigManager] Checking config version ${currentVersion} against app version ${targetVersion}`
    )

    // Check if config is too old to be compatible
    if (!isCompatible(currentVersion)) {
      console.log(
        `[ConfigManager] Config version ${currentVersion} is too old, resetting to defaults`
      )
      this.createConfigBackup('incompatible-version')
      this.store.store = getDefaultConfig()
      return
    }

    // Check if config is newer than app version
    if (VersionUtils.compare(currentVersion, targetVersion) > 0) {
      console.log(
        `[ConfigManager] Config version ${currentVersion} is newer than app version ${targetVersion}`
      )
      this.handleNewerConfigVersion(currentVersion, targetVersion)
      return
    }

    // Only migrate if config version is older than app version
    if (VersionUtils.compare(currentVersion, targetVersion) < 0) {
      console.log(
        `[ConfigManager] Migrating config from version ${currentVersion} to ${targetVersion}`
      )
      // Create backup before migration
      this.createConfigBackup('before-migration')

      // Run version-specific migrations
      this.runVersionMigrations(currentVersion, targetVersion)

      // Update config version to current
      this.store.set('configVersion', targetVersion)

      // Store migration info for notification
      this.lastMigration = { fromVersion: currentVersion, toVersion: targetVersion }
    } else {
      console.log('[ConfigManager] Config version is up to date, no migration needed')
    }

    // Always ensure media extensions are up to date
    this.migrateMediaExtensions()
  }

  /**
   * Handle when config version is newer than app version
   */
  private handleNewerConfigVersion(configVersion: string, appVersion: string): void {
    // Create backup of the newer config
    this.createConfigBackup('newer-config-version')

    // Set a flag to show dialog to user
    this.store.set('_newerConfigWarning', {
      configVersion,
      appVersion,
      timestamp: Date.now()
    })

    console.log(
      `[ConfigManager] Config version ${configVersion} is newer than app version ${appVersion}. ` +
        `User will be prompted to choose action.`
    )
  }

  /**
   * Create a backup of the current config
   */
  private createConfigBackup(reason: string): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupDir = join(app.getPath('userData'), 'config-backups')

      // Ensure backup directory exists
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true })
      }

      const backupPath = join(backupDir, `transferbox-config-${reason}-${timestamp}.json`)
      const currentConfig = this.getConfig()

      writeFileSync(backupPath, JSON.stringify(currentConfig, null, 2))
      getLogger().info('[ConfigManager] Config backed up', { path: backupPath, reason })
    } catch (error) {
      getLogger().error('[ConfigManager] Failed to create config backup', {
        error: error instanceof Error ? error.message : String(error),
        reason
      })
    }
  }

  /**
   * Run version-specific migrations
   */
  private runVersionMigrations(fromVersion: string, toVersion: string): void {
    console.log(`[ConfigManager] Running migrations from ${fromVersion} to ${toVersion}`)

    // Migration from 0.x to 1.x
    if (VersionUtils.compare(fromVersion, '1.0') < 0) {
      this.migrateFromVersion0()
    }

    // Migration from 1.x to 2.x
    if (
      VersionUtils.compare(fromVersion, '2.0') < 0 &&
      VersionUtils.compare(toVersion, '2.0') >= 0
    ) {
      this.migrateFromVersion1()
    }

    // Add more migrations as needed for future versions
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
   * Migrate from version 1.x to version 2.x
   */
  private migrateFromVersion1(): void {
    console.log('[ConfigManager] Migrating from version 1.x to version 2.x')

    // Add any new config options introduced in version 2.x
    // This is where you'd add new fields, modify existing ones, etc.

    // Example: Add new field if it doesn't exist
    const currentConfig = this.getConfig()
    if (currentConfig.unitSystem === undefined) {
      console.log('[ConfigManager] Adding unitSystem field')
      this.store.set('unitSystem', 'decimal')
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
    return { ...this.store.store } as AppConfig
  }

  /**
   * Updates configuration with partial values
   * Validates before updating
   */
  updateConfig(updates: Partial<AppConfig>): AppConfig {
    const logger = getLogger()
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

    // Log settings change summary (limit large arrays)
    try {
      const changedKeys = Object.keys(updates) as Array<keyof typeof updates>
      const summarized: Record<string, unknown> = {}
      for (const key of changedKeys) {
        const value = updates[key]
        if (Array.isArray(value)) {
          summarized[key] = value.length > 10 ? [...value.slice(0, 10), '...'] : value
        } else {
          summarized[key] = value
        }
      }
      logger.info('Settings updated', { changedKeys, values: summarized })
    } catch {
      // ignore
    }

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
    const logger = getLogger()
    const defaultConfig = getDefaultConfig()
    this.store.store = defaultConfig
    logger.warn('Settings reset to defaults')
    return defaultConfig
  }

  /**
   * Forces a complete config migration and validation
   * Useful for fixing corrupted or incompatible configs
   */
  forceMigration(): AppConfig {
    const logger = getLogger()
    console.log('[ConfigManager] Forcing complete config migration')

    // Create backup before forced migration
    this.createConfigBackup('forced-migration')

    // Get current config
    const currentConfig = this.getConfig()

    // Create a new config by merging current with defaults
    const migratedConfig: AppConfig = {
      ...getDefaultConfig(),
      ...currentConfig,
      configVersion: CONFIG_VERSION
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
    logger.info('Config migration completed', { toVersion: CONFIG_VERSION })
    return migratedConfig
  }

  /**
   * Get version information for the current config and app
   */
  getVersionInfo(): {
    appVersion: string
    configVersion: string
    isUpToDate: boolean
    needsMigration: boolean
    hasNewerConfigWarning: boolean
  } {
    const currentConfig = this.getConfig()
    const currentVersion = currentConfig.configVersion
      ? String(currentConfig.configVersion)
      : '0.0.0'
    const targetVersion = CONFIG_VERSION
    const newerConfigWarning = currentConfig._newerConfigWarning

    return {
      appVersion: CONFIG_VERSION,
      configVersion: currentVersion,
      isUpToDate: VersionUtils.compare(currentVersion, targetVersion) === 0,
      needsMigration: VersionUtils.compare(currentVersion, targetVersion) < 0,
      hasNewerConfigWarning: !!newerConfigWarning
    }
  }

  /**
   * Get newer config warning details
   */
  getNewerConfigWarning(): {
    configVersion: string
    appVersion: string
    timestamp: number
  } | null {
    const currentConfig = this.getConfig()
    return currentConfig._newerConfigWarning || null
  }

  /**
   * Handle user choice for newer config version
   */
  handleNewerConfigChoice(choice: 'continue' | 'reset'): AppConfig {
    const warning = this.getNewerConfigWarning()
    if (!warning) {
      throw new Error('No newer config warning found')
    }

    if (choice === 'continue') {
      // User wants to continue with the newer config
      console.log('[ConfigManager] User chose to continue with newer config version')
      this.store.delete('_newerConfigWarning')
      getLogger().info('User continued with newer config', warning)
      return this.getConfig()
    } else {
      // User wants to reset to defaults
      console.log('[ConfigManager] User chose to reset config to defaults')
      this.createConfigBackup('user-reset-newer-config')
      this.store.delete('_newerConfigWarning')
      const defaultConfig = getDefaultConfig()
      this.store.store = defaultConfig
      getLogger().warn('User reset config to defaults due to newer config', warning)
      return defaultConfig
    }
  }

  /**
   * Clear newer config warning without action
   */
  clearNewerConfigWarning(): void {
    this.store.delete('_newerConfigWarning')
  }

  /**
   * Clears all configuration
   */
  clearConfig(): void {
    this.store.store = getDefaultConfig()
  }

  /**
   * Get last migration info if available
   */
  getLastMigration(): { fromVersion: string; toVersion: string } | null {
    return this.lastMigration
  }

  /**
   * Clear last migration info
   */
  clearLastMigration(): void {
    this.lastMigration = null
  }

  /**
   * Gets the underlying store instance
   */
  getStore(): Store<AppConfig> {
    return this.store as Store<AppConfig>
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
 * Gets version information (convenience function)
 */
export function getVersionInfo(): {
  appVersion: string
  configVersion: string
  isUpToDate: boolean
  needsMigration: boolean
  hasNewerConfigWarning: boolean
} {
  return getConfigManager().getVersionInfo()
}

/**
 * Gets newer config warning details (convenience function)
 */
export function getNewerConfigWarning(): {
  configVersion: string
  appVersion: string
  timestamp: number
} | null {
  return getConfigManager().getNewerConfigWarning()
}

/**
 * Handles user choice for newer config version (convenience function)
 */
export function handleNewerConfigChoice(choice: 'continue' | 'reset'): AppConfig {
  return getConfigManager().handleNewerConfigChoice(choice)
}

/**
 * Clears newer config warning (convenience function)
 */
export function clearNewerConfigWarning(): void {
  return getConfigManager().clearNewerConfigWarning()
}

/**
 * Get last migration info (convenience function)
 */
export function getLastMigration(): { fromVersion: string; toVersion: string } | null {
  return getConfigManager().getLastMigration()
}

/**
 * Clear last migration info (convenience function)
 */
export function clearLastMigration(): void {
  return getConfigManager().clearLastMigration()
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
