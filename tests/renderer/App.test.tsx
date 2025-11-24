/**
 * App Component Tests
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../../src/renderer/src/App'

// Mock the hooks and stores
jest.mock('../../src/renderer/src/hooks/useAppInit', () => ({
  useAppInit: jest.fn()
}))

jest.mock('../../src/renderer/src/hooks/useIpc', () => ({
  useIpc: () => ({
    scanDrive: jest.fn(),
    listDrives: jest.fn(),
    getConfig: jest.fn(),
    getHistory: jest.fn(),
    getAppVersion: jest.fn(() => Promise.resolve('2.0.1-alpha.2')),
    getNewerConfigWarning: jest.fn(() => Promise.resolve(null)),
    getVersionInfo: jest.fn(() =>
      Promise.resolve({
        appVersion: '2.0.1-alpha.2',
        configVersion: '2.0.1-alpha.2',
        isUpToDate: true,
        needsMigration: false,
        hasNewerConfigWarning: false
      })
    ),
    handleNewerConfigChoice: jest.fn(),
    clearNewerConfigWarning: jest.fn(),
    onDriveDetected: jest.fn(() => jest.fn()),
    onDriveRemoved: jest.fn(() => jest.fn()),
    onDriveUnmounted: jest.fn(() => jest.fn()),
    onTransferProgress: jest.fn(() => jest.fn()),
    onTransferComplete: jest.fn(() => jest.fn()),
    onTransferError: jest.fn(() => jest.fn()),
    onLogEntry: jest.fn(() => jest.fn()),
    onSystemSuspend: jest.fn(() => jest.fn()),
    onSystemResume: jest.fn(() => jest.fn())
  })
}))

jest.mock('../../src/renderer/src/utils/soundManager', () => ({
  initSoundManager: jest.fn(),
  playErrorSound: jest.fn(),
  playSuccessSound: jest.fn(),
  cleanupSoundManager: jest.fn()
}))

// Mock the store with inline object to avoid hoisting issues
jest.mock('../../src/renderer/src/store', () => ({
  useStore: jest.fn((selector) => {
    const state = {
      toasts: []
    }
    return selector ? selector(state) : state
  }),
  useDriveStore: () => ({
    detectedDrives: [],
    selectedDrive: null,
    scannedFiles: [],
    scanInProgress: false,
    selectDrive: jest.fn(),
    setScanInProgress: jest.fn(),
    setScannedFiles: jest.fn(),
    setScanError: jest.fn(),
    isExistingDrive: jest.fn(() => false),
    isDriveUnmounted: jest.fn(() => false)
  }),
  useUIStore: () => ({
    selectedDestination: null,
    showLogs: false,
    showHistory: false,
    closeAllModals: jest.fn()
  }),
  useTransferStore: () => ({
    isTransferring: false,
    progress: null
  }),
  useConfigStore: () => ({
    config: {
      transferMode: 'manual',
      configVersion: '2.0.1-alpha.2',
      defaultDestination: null,
      addTimestampToFilename: false,
      keepOriginalFilename: false,
      filenameTemplate: '{original}_{timestamp}',
      timestampFormat: '%Y%m%d_%H%M%S',
      preserveOriginalNames: true,
      createDateBasedFolders: false,
      dateFolderFormat: '%Y/%m/%d',
      createDeviceBasedFolders: false,
      deviceFolderTemplate: '{device_name}',
      folderStructure: 'preserve-source',
      keepFolderStructure: false,
      transferOnlyMediaFiles: false,
      mediaExtensions: ['.mp4', '.mov', '.jpg', '.png'],
      checksumAlgorithm: 'xxhash64',
      verifyChecksums: true,
      generateMHLChecksumFiles: false,
      bufferSize: 4194304,
      chunkSize: 1048576,
      enableLogging: true,
      generateMHL: false,
      showDetailedProgress: true,
      autoCleanupLogs: true,
      logRetentionDays: 30,
      unitSystem: 'decimal'
    },
    isLoading: false,
    error: null,
    setConfig: jest.fn(),
    updateConfig: jest.fn(),
    setConfigLoading: jest.fn(),
    setConfigError: jest.fn()
  })
}))

describe('App Component', () => {
  it('renders without crashing', async () => {
    render(<App />)
    expect(screen.getByText('TransferBox')).toBeDefined()
    // Wait for async state updates to complete
    await waitFor(() => {
      expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeDefined()
    })
  })

  it('shows basic workflow components', async () => {
    render(<App />)
    expect(screen.getByText('Select Drive')).toBeDefined()
    expect(screen.getByText('Set Destination')).toBeDefined()
    expect(screen.getByText('Start Transfer')).toBeDefined()
    // Wait for async state updates to complete
    await waitFor(() => {
      expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeDefined()
    })
  })
})
