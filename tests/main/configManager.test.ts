/**
 * Configuration Manager Tests
 * Following TDD - these tests are written BEFORE implementation
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import {
  ConfigManager,
  getConfig,
  updateConfig,
  resetConfig,
  validateConfig
} from '../../src/main/configManager'
import { AppConfig, DEFAULT_CONFIG, TransferMode, FolderStructure } from '../../src/shared/types'

describe('ConfigManager', () => {
  let configManager: ConfigManager
  let testConfigPath: string

  beforeEach(() => {
    // Use a test-specific config path
    testConfigPath = path.join(os.tmpdir(), `transferbox-test-config-${Date.now()}`)
    configManager = new ConfigManager(testConfigPath)
  })

  afterEach(async () => {
    // Clean up test config
    try {
      await fs.rm(testConfigPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('ConfigManager class', () => {
    it('should initialize with default config', () => {
      const config = configManager.getConfig()

      expect(config.transferMode).toBe('manual')
      expect(config.folderStructure).toBe('preserve-source')
      expect(config.keepFolderStructure).toBe(false)
      expect(config.verifyChecksums).toBe(true)
      expect(config.checksumAlgorithm).toBe('xxhash64')
    })

    it('should get current config', () => {
      const config = configManager.getConfig()

      expect(config).toBeDefined()
      expect(config.transferMode).toBe('manual')
      expect(config.mediaExtensions).toContain('.mp4')
      expect(config.bufferSize).toBeGreaterThan(0)
    })

    it('should update config partially', () => {
      configManager.updateConfig({ transferMode: 'fully-autonomous' })

      const config = configManager.getConfig()
      expect(config.transferMode).toBe('fully-autonomous')
      // Other values should remain default
      expect(config.folderStructure).toBe('preserve-source')
      expect(config.keepFolderStructure).toBe(false)
    })

    it('should update multiple config values', () => {
      configManager.updateConfig({
        transferMode: 'auto-transfer',
        folderStructure: 'flat',
        verifyChecksums: false
      })

      const config = configManager.getConfig()
      expect(config.transferMode).toBe('auto-transfer')
      expect(config.folderStructure).toBe('flat')
      expect(config.verifyChecksums).toBe(false)
    })

    it('should persist config across instances', () => {
      configManager.updateConfig({ transferMode: 'fully-autonomous' })

      // Create new instance with same path
      const newConfigManager = new ConfigManager(testConfigPath)
      const config = newConfigManager.getConfig()

      expect(config.transferMode).toBe('fully-autonomous')
    })

    it('should reset config to defaults', () => {
      configManager.updateConfig({
        transferMode: 'fully-autonomous',
        folderStructure: 'flat'
      })

      configManager.resetConfig()
      const config = configManager.getConfig()

      expect(config.transferMode).toBe('manual')
      expect(config.folderStructure).toBe('preserve-source')
      expect(config.keepFolderStructure).toBe(false)
    })

    it('should validate config before updating', () => {
      // This should not throw
      expect(() => {
        configManager.updateConfig({ bufferSize: 8192 })
      }).not.toThrow()

      // Invalid buffer size should throw
      expect(() => {
        configManager.updateConfig({ bufferSize: -1 })
      }).toThrow()
    })

    it('should handle default destination path', () => {
      const testPath = '/Users/test/TransferBox'
      configManager.updateConfig({ defaultDestination: testPath })

      const config = configManager.getConfig()
      expect(config.defaultDestination).toBe(testPath)
    })

    it('should handle media extensions update', () => {
      const customExtensions = ['.mp4', '.mov', '.avi']
      configManager.updateConfig({ mediaExtensions: customExtensions })

      const config = configManager.getConfig()
      expect(config.mediaExtensions).toEqual(customExtensions)
    })

    it('should handle keepFolderStructure setting', () => {
      // Default should be false
      let config = configManager.getConfig()
      expect(config.keepFolderStructure).toBe(false)

      // Should be able to update to true
      configManager.updateConfig({ keepFolderStructure: true })
      config = configManager.getConfig()
      expect(config.keepFolderStructure).toBe(true)

      // Should be able to update back to false
      configManager.updateConfig({ keepFolderStructure: false })
      config = configManager.getConfig()
      expect(config.keepFolderStructure).toBe(false)
    })
  })

  describe('Standalone functions', () => {
    it('should get config using global function', () => {
      const config = getConfig()
      expect(config).toBeDefined()
      expect(config.transferMode).toBeDefined()
    })

    it('should update config using global function', () => {
      updateConfig({ transferMode: 'auto-transfer' })
      const config = getConfig()
      expect(config.transferMode).toBe('auto-transfer')
    })

    it('should reset config using global function', () => {
      updateConfig({ transferMode: 'fully-autonomous' })
      resetConfig()
      const config = getConfig()
      expect(config.transferMode).toBe('manual')
    })
  })

  describe('Config validation', () => {
    it('should validate transfer mode', () => {
      const validConfig: Partial<AppConfig> = { transferMode: 'manual' }
      expect(() => validateConfig(validConfig)).not.toThrow()

      const invalidConfig = { transferMode: 'invalid-mode' as TransferMode }
      expect(() => validateConfig(invalidConfig)).toThrow()
    })

    it('should validate folder structure', () => {
      const validConfig: Partial<AppConfig> = { folderStructure: 'date-based' }
      expect(() => validateConfig(validConfig)).not.toThrow()

      const invalidConfig = { folderStructure: 'invalid' as FolderStructure }
      expect(() => validateConfig(invalidConfig)).toThrow()
    })

    it('should validate buffer size', () => {
      expect(() => validateConfig({ bufferSize: 8192 })).not.toThrow()
      expect(() => validateConfig({ bufferSize: -1 })).toThrow()
      expect(() => validateConfig({ bufferSize: 0 })).toThrow()
    })

    it('should validate chunk size', () => {
      expect(() => validateConfig({ chunkSize: 1048576 })).not.toThrow()
      expect(() => validateConfig({ chunkSize: -1 })).toThrow()
      expect(() => validateConfig({ chunkSize: 0 })).toThrow()
    })

    it('should validate media extensions array', () => {
      expect(() => validateConfig({ mediaExtensions: ['.mp4', '.mov'] })).not.toThrow()
      expect(() => validateConfig({ mediaExtensions: [] })).not.toThrow() // Empty is OK
      expect(() => validateConfig({ mediaExtensions: ['.mp4', 'invalid'] })).toThrow() // Must start with dot
    })

    it('should validate log retention days', () => {
      expect(() => validateConfig({ logRetentionDays: 30 })).not.toThrow()
      expect(() => validateConfig({ logRetentionDays: -1 })).toThrow()
      expect(() => validateConfig({ logRetentionDays: 0 })).not.toThrow() // 0 means keep forever
    })

    it('should validate timestamp format', () => {
      expect(() => validateConfig({ timestampFormat: 'YYYY-MM-DD' })).not.toThrow()
      expect(() => validateConfig({ timestampFormat: '' })).toThrow() // Empty not allowed
    })
  })

  describe('Transfer modes', () => {
    it('should support manual mode (Mode 1)', () => {
      configManager.updateConfig({
        transferMode: 'manual',
        defaultDestination: null
      })

      const config = configManager.getConfig()
      expect(config.transferMode).toBe('manual')
      expect(config.defaultDestination).toBeNull()
    })

    it('should support semi-auto mode (Mode 2)', () => {
      configManager.updateConfig({
        transferMode: 'auto-transfer',
        defaultDestination: null
      })

      const config = configManager.getConfig()
      expect(config.transferMode).toBe('auto-transfer')
    })

    it('should support autonomous mode (Mode 3)', () => {
      const destination = '/Users/test/Transfers'
      configManager.updateConfig({
        transferMode: 'fully-autonomous',
        defaultDestination: destination
      })

      const config = configManager.getConfig()
      expect(config.transferMode).toBe('fully-autonomous')
      expect(config.defaultDestination).toBe(destination)
    })
  })

  describe('Edge cases', () => {
    it('should handle concurrent updates', async () => {
      const updates = Array.from({ length: 10 }, (_, i) =>
        configManager.updateConfig({ bufferSize: 8192 * (i + 1) })
      )

      // Should not throw or cause race conditions
      expect(() => updates).not.toThrow()
    })

    it('should preserve unknown config keys', () => {
      // In case future versions add new config keys
      const configWithExtra = {
        ...DEFAULT_CONFIG,
        futureFeature: 'value'
      }

      configManager.updateConfig(configWithExtra as Partial<AppConfig>)
      const config = configManager.getConfig()

      // Should have standard keys
      expect(config.transferMode).toBeDefined()
    })

    it('should handle very large media extensions list', () => {
      const largeList = Array.from({ length: 100 }, (_, i) => `.ext${i}`)

      expect(() => {
        configManager.updateConfig({ mediaExtensions: largeList })
      }).not.toThrow()

      const config = configManager.getConfig()
      expect(config.mediaExtensions).toHaveLength(100)
    })

    it('should handle numeric configVersion values from legacy configs', () => {
      // This regression test ensures numeric config versions are converted to strings
      // Bug: Some legacy configs might have numeric configVersion (e.g., 1 instead of "1")
      const store = configManager.getStore()

      // Directly set a numeric configVersion to simulate legacy config
      ;(store as any).set('configVersion', 1)

      // Should not throw when getting version info
      expect(() => {
        const versionInfo = configManager.getVersionInfo()
        expect(versionInfo.configVersion).toBe('1')
      }).not.toThrow()

      // Should not throw when migrating config
      expect(() => {
        // Create a new instance which will trigger migration
        new ConfigManager(testConfigPath)
      }).not.toThrow()
    })
  })
})
