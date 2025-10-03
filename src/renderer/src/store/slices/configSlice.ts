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
      '.jpg',
      '.jpeg',
      '.png',
      '.raw',
      '.cr2',
      '.nef',
      '.arw',
      '.dng',
      '.mp4',
      '.mov',
      '.avi',
      '.mkv',
      '.mts',
      '.m4v',
      '.mp3',
      '.wav',
      '.flac',
      '.aac',
      '.m4a'
    ],
    checksumAlgorithm: 'xxhash64' as const,
    verifyChecksums: true,
    bufferSize: 65536,
    chunkSize: 4096,
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
