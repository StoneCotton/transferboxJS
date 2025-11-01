/**
 * DriveSelector Component Tests
 * Tests for drive selection behavior, especially during active transfers
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DriveSelector } from '../../../src/renderer/src/components/DriveSelector'
import type { DriveInfo } from '../../../src/shared/types'

// Mock sound manager
jest.mock('../../../src/renderer/src/utils/soundManager', () => ({
  playErrorSound: jest.fn(),
  playSuccessSound: jest.fn(),
  initSoundManager: jest.fn(),
  cleanupSoundManager: jest.fn()
}))

// Mock data
const mockDrive: DriveInfo = {
  device: '/dev/sdb1',
  displayName: 'USB Drive',
  description: 'USB Storage Device',
  mountpoints: ['/media/usb'],
  label: 'USB_DRIVE',
  filesystem: 'exfat',
  size: 32000000000,
  isUSB: true,
  isSystem: false,
  isReadOnly: false,
  isRemovable: true
}

const mockScannedFiles = [
  {
    path: '/media/usb/test.jpg',
    size: 1024,
    modifiedTime: Date.now(),
    isDirectory: false
  }
]

// Mock the store with inline object to avoid hoisting issues
jest.mock('../../../src/renderer/src/store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      addToast: jest.fn()
    }))
  },
  useDriveStore: jest.fn(() => ({
    detectedDrives: [mockDrive],
    selectedDrive: null,
    selectDrive: jest.fn(),
    scanInProgress: false,
    setScanInProgress: jest.fn(),
    setScannedFiles: jest.fn(),
    setScanError: jest.fn(),
    isExistingDrive: jest.fn(() => false),
    isDriveUnmounted: jest.fn(() => false)
  })),
  useConfigStore: jest.fn(() => ({
    config: {
      transferMode: 'manual',
      mediaExtensions: ['.jpg', '.mp4']
    }
  })),
  useTransferStore: jest.fn(() => ({
    isTransferring: false
  }))
}))

jest.mock('../../../src/renderer/src/hooks/useIpc', () => ({
  useIpc: jest.fn(() => ({
    scanDrive: jest.fn(() => Promise.resolve({ files: mockScannedFiles }))
  }))
}))

describe('DriveSelector Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('Drive Selection During Transfer', () => {
    it('should disable drive selection button when transfer is in progress', () => {
      // Setup: Mock transfer in progress
      const { useTransferStore } = require('../../../src/renderer/src/store')
      useTransferStore.mockReturnValue({
        isTransferring: true
      })

      render(<DriveSelector />)

      // Find the drive button
      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Assert: Button should be disabled
      expect(driveButton).toBeDisabled()
    })

    it('should enable drive selection button when no transfer is in progress', () => {
      // Setup: No transfer in progress
      const { useTransferStore } = require('../../../src/renderer/src/store')
      useTransferStore.mockReturnValue({
        isTransferring: false
      })

      render(<DriveSelector />)

      // Find the drive button
      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Assert: Button should NOT be disabled
      expect(driveButton).not.toBeDisabled()
    })

    it('should prevent drive scanning when transfer is in progress', async () => {
      const mockSelectDrive = jest.fn()
      const mockScanDrive = jest.fn(() => Promise.resolve({ files: mockScannedFiles }))
      const mockSetScanError = jest.fn()

      // Setup: Transfer in progress
      const { useTransferStore, useDriveStore } = require('../../../src/renderer/src/store')
      const { useIpc } = require('../../../src/renderer/src/hooks/useIpc')

      useTransferStore.mockReturnValue({
        isTransferring: true
      })

      useDriveStore.mockReturnValue({
        detectedDrives: [mockDrive],
        selectedDrive: null,
        selectDrive: mockSelectDrive,
        scanInProgress: false,
        setScanInProgress: jest.fn(),
        setScannedFiles: jest.fn(),
        setScanError: mockSetScanError,
        isExistingDrive: jest.fn(() => false),
        isDriveUnmounted: jest.fn(() => false)
      })

      useIpc.mockReturnValue({
        scanDrive: mockScanDrive
      })

      render(<DriveSelector />)

      // Try to click the drive button (should be disabled)
      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Attempt click - should not trigger due to disabled state
      if (driveButton) {
        fireEvent.click(driveButton)
      }

      await waitFor(() => {
        // Assert: Scan should NOT have been called
        expect(mockScanDrive).not.toHaveBeenCalled()
        // Assert: Drive selection should NOT have been triggered
        expect(mockSelectDrive).not.toHaveBeenCalled()
      })
    })

    it('should disable unmounted drives even when no transfer is in progress', () => {
      // Setup: Drive is unmounted but no transfer
      const { useTransferStore, useDriveStore } = require('../../../src/renderer/src/store')

      useDriveStore.mockReturnValue({
        detectedDrives: [mockDrive],
        selectedDrive: null,
        selectDrive: jest.fn(),
        scanInProgress: false,
        setScanInProgress: jest.fn(),
        setScannedFiles: jest.fn(),
        setScanError: jest.fn(),
        isExistingDrive: jest.fn(() => false),
        isDriveUnmounted: jest.fn(() => true) // Drive is unmounted
      })

      useTransferStore.mockReturnValue({
        isTransferring: false
      })

      render(<DriveSelector />)

      // Find the drive button
      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Assert: Button should be disabled due to unmounted state
      expect(driveButton).toBeDisabled()
    })

    it('should allow drive selection when no transfer and drive is mounted', async () => {
      const mockSelectDrive = jest.fn()
      const mockScanDrive = jest.fn(() => Promise.resolve({ files: mockScannedFiles }))

      // Setup: No transfer, drive is mounted
      const { useTransferStore, useDriveStore } = require('../../../src/renderer/src/store')
      const { useIpc } = require('../../../src/renderer/src/hooks/useIpc')

      useDriveStore.mockReturnValue({
        detectedDrives: [mockDrive],
        selectedDrive: null,
        selectDrive: mockSelectDrive,
        scanInProgress: false,
        setScanInProgress: jest.fn(),
        setScannedFiles: jest.fn(),
        setScanError: jest.fn(),
        isExistingDrive: jest.fn(() => false),
        isDriveUnmounted: jest.fn(() => false)
      })

      useTransferStore.mockReturnValue({
        isTransferring: false
      })

      useIpc.mockReturnValue({
        scanDrive: mockScanDrive
      })

      render(<DriveSelector />)

      // Find the drive button
      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Assert: Button should NOT be disabled
      expect(driveButton).not.toBeDisabled()

      // Click the drive button
      if (driveButton) {
        fireEvent.click(driveButton)
      }

      await waitFor(() => {
        // Assert: Drive selection should have been triggered
        expect(mockSelectDrive).toHaveBeenCalledWith(mockDrive)
        // Assert: Scan should have been called
        expect(mockScanDrive).toHaveBeenCalledWith(mockDrive.device)
      })
    })
  })

  describe('Visual Feedback', () => {
    it('should apply disabled styling when transfer is active', () => {
      const { useTransferStore } = require('../../../src/renderer/src/store')

      useTransferStore.mockReturnValue({
        isTransferring: true
      })

      render(<DriveSelector />)

      const driveButton = screen.getByText(mockDrive.displayName).closest('button')

      // Assert: Should have disabled/cursor-not-allowed styling
      expect(driveButton).toHaveClass('cursor-not-allowed')
    })
  })
})

