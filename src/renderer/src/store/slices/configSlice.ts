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
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

export const createConfigSlice: StateCreator<ConfigSlice> = (set) => ({
  // Initial state
  config: {
    // Default config - will be loaded from main process
    transferMode: 'manual',
    defaultDestination: null,
    preserveOriginalNames: true,
    timestampFormat: 'YYYY-MM-DD_HHmmss',
    folderStructure: 'flat',
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
    checksumAlgorithm: 'xxhash64' as const,
    verifyChecksums: true,
    bufferSize: 4194304, // 4MB - optimized for modern SSDs
    chunkSize: 1048576, // 1MB for progress updates
    enableLogging: true,
    generateMHL: false,
    showDetailedProgress: true,
    autoCleanupLogs: true,
    logRetentionDays: 30
  },
  isLoading: false,
  error: null,

  // Actions
  setConfig: (config) => set({ config, isLoading: false, error: null }),

  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates }
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false })
})
