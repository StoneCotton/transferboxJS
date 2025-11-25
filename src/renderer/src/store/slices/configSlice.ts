/**
 * Config Store Slice
 * Manages application configuration
 */

import type { StateCreator } from 'zustand'
import type { ConfigState } from '../types'
import type { AppConfig } from '../../../../shared/types'

export interface ConfigSlice extends ConfigState {
  // Actions
  setConfig: (config: AppConfig) => void
  updateConfig: (updates: Partial<AppConfig>) => void
  setConfigLoading: (isLoading: boolean) => void
  setConfigError: (error: string | null) => void
}

export const createConfigSlice: StateCreator<ConfigSlice> = (set) => ({
  // Initial state
  config: {
    // Default config - will be loaded from main process
    configVersion: '0.0.0',
    transferMode: 'manual',
    defaultDestination: null,

    // File naming settings
    addTimestampToFilename: false,
    keepOriginalFilename: false,
    filenameTemplate: '{original}_{timestamp}',
    timestampFormat: '%Y%m%d_%H%M%S',
    preserveOriginalNames: true, // Legacy setting

    // Directory structure settings
    createDateBasedFolders: false,
    dateFolderFormat: '%Y/%m/%d',
    createDeviceBasedFolders: false,
    deviceFolderTemplate: '{device_name}',
    folderStructure: 'preserve-source', // Legacy setting
    keepFolderStructure: false,

    // Media file filtering
    transferOnlyMediaFiles: false,
    mediaExtensions: [
      // Video formats
      '.mp4',
      '.mov',
      '.avi',
      '.mkv',
      '.m4v',
      '.mpg',
      '.mpeg',
      '.mts', // AVCHD
      '.m2ts', // AVCHD
      '.mxf', // Professional video
      '.crm', // Canon Raw Lite
      '.braw', // Blackmagic RAW
      '.r3d', // RED RAW
      '.webm',
      // Image formats
      '.jpg',
      '.jpeg',
      '.png',
      '.raw',
      '.cr2', // Canon RAW
      '.cr3', // Canon RAW (newer)
      '.nef', // Nikon RAW
      '.arw', // Sony RAW
      '.dng', // Adobe Digital Negative
      '.heic',
      '.heif',
      // Audio formats
      '.wav',
      '.mp3',
      '.aac',
      '.flac',
      '.m4a',
      // Metadata/sidecar files
      '.xml' // Camera metadata
    ],

    // Checksum settings
    checksumAlgorithm: 'xxhash64' as const,
    verifyChecksums: true,
    generateMHLChecksumFiles: false,

    // Performance settings
    bufferSize: 4194304, // 4MB - optimized for modern SSDs
    chunkSize: 1048576, // 1MB for progress updates

    // Logging
    enableLogging: true,
    generateMHL: false, // Legacy setting

    // UI preferences
    showDetailedProgress: true,
    autoCleanupLogs: true,
    logRetentionDays: 30,

    // Unit system for file size display
    unitSystem: 'decimal' as const,

    // UI density for layout
    uiDensity: 'comfortable' as const
  },
  isLoading: false,
  error: null,

  // Actions
  setConfig: (config) => set({ config, isLoading: false, error: null }),

  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates }
    })),

  setConfigLoading: (isLoading) => set({ isLoading }),

  setConfigError: (error) => set({ error, isLoading: false })
})
