/**
 * DestinationSelector Component Tests
 * Tests for destination selection behavior, especially during active transfers
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DestinationSelector } from '../../../src/renderer/src/components/DestinationSelector'
import type { DriveInfo } from '../../../src/shared/types'

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

// Mock the store
jest.mock('../../../src/renderer/src/store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      addToast: jest.fn()
    }))
  },
  useUIStore: jest.fn(() => ({
    selectedDestination: null,
    setSelectedDestination: jest.fn(),
    isSelectingDestination: false
  })),
  useDriveStore: jest.fn(() => ({
    selectedDrive: mockDrive,
    scannedFiles: mockScannedFiles
  })),
  useConfigStore: jest.fn(() => ({
    config: {
      transferMode: 'manual',
      defaultDestination: null
    }
  })),
  useTransferStore: jest.fn(() => ({
    isTransferring: false,
    startTransfer: jest.fn()
  }))
}))

jest.mock('../../../src/renderer/src/hooks/useIpc', () => ({
  useIpc: jest.fn(() => ({
    selectFolder: jest.fn(() => Promise.resolve('/path/to/destination')),
    validatePath: jest.fn(() =>
      Promise.resolve({
        isValid: true,
        isWritable: true,
        exists: true,
        hasSpace: true,
        availableSpace: 10000000000
      })
    ),
    startTransfer: jest.fn()
  }))
}))

describe('DestinationSelector Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('Destination Selection During Transfer', () => {
    it('should disable destination button when transfer is in progress', () => {
      // Setup: Mock transfer in progress
      const { useTransferStore } = require('../../../src/renderer/src/store')
      useTransferStore.mockReturnValue({
        isTransferring: true,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Find the select button by its text when transfer is in progress
      const selectButton = screen.getByText(/Transfer in Progress\.\.\./i)

      // Assert: Button should be disabled
      expect(selectButton).toBeDisabled()
    })

    it('should enable destination button when no transfer is in progress', () => {
      // Setup: No transfer in progress
      const { useTransferStore } = require('../../../src/renderer/src/store')
      useTransferStore.mockReturnValue({
        isTransferring: false,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Find the select button
      const selectButton = screen.getByText(/Select Destination/i)

      // Assert: Button should NOT be disabled
      expect(selectButton).not.toBeDisabled()
    })

    it('should prevent folder selection when transfer is in progress', async () => {
      const mockSelectFolder = jest.fn(() => Promise.resolve('/path/to/destination'))
      const mockSetSelectedDestination = jest.fn()

      // Setup: Transfer in progress
      const { useTransferStore, useUIStore } = require('../../../src/renderer/src/store')
      const { useIpc } = require('../../../src/renderer/src/hooks/useIpc')

      useTransferStore.mockReturnValue({
        isTransferring: true,
        startTransfer: jest.fn()
      })

      useUIStore.mockReturnValue({
        selectedDestination: null,
        setSelectedDestination: mockSetSelectedDestination,
        isSelectingDestination: false
      })

      useIpc.mockReturnValue({
        selectFolder: mockSelectFolder,
        validatePath: jest.fn(() =>
          Promise.resolve({
            isValid: true,
            isWritable: true,
            exists: true,
            hasSpace: true,
            availableSpace: 10000000000
          })
        ),
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Try to click the select button (should be disabled and show transfer in progress text)
      const selectButton = screen.getByText(/Transfer in Progress\.\.\./i)

      // Attempt click - should not trigger due to disabled state
      fireEvent.click(selectButton)

      await waitFor(() => {
        // Assert: Folder selection should NOT have been called
        expect(mockSelectFolder).not.toHaveBeenCalled()
        // Assert: Destination should NOT have been set
        expect(mockSetSelectedDestination).not.toHaveBeenCalled()
      })
    })

    it('should allow folder selection when no transfer is in progress', async () => {
      const mockSelectFolder = jest.fn(() => Promise.resolve('/path/to/destination'))
      const mockSetSelectedDestination = jest.fn()
      const mockValidatePath = jest.fn(() =>
        Promise.resolve({
          isValid: true,
          isWritable: true,
          exists: true,
          hasSpace: true,
          availableSpace: 10000000000
        })
      )

      // Setup: No transfer in progress
      const { useTransferStore, useUIStore } = require('../../../src/renderer/src/store')
      const { useIpc } = require('../../../src/renderer/src/hooks/useIpc')

      useTransferStore.mockReturnValue({
        isTransferring: false,
        startTransfer: jest.fn()
      })

      useUIStore.mockReturnValue({
        selectedDestination: null,
        setSelectedDestination: mockSetSelectedDestination,
        isSelectingDestination: false
      })

      useIpc.mockReturnValue({
        selectFolder: mockSelectFolder,
        validatePath: mockValidatePath,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Click the select button
      const selectButton = screen.getByText(/Select Destination/i)
      fireEvent.click(selectButton)

      await waitFor(() => {
        // Assert: Folder selection should have been called
        expect(mockSelectFolder).toHaveBeenCalled()
      })
    })

    it('should show "Transfer in Progress..." text when transfer is active', () => {
      // Setup: Transfer in progress
      const { useTransferStore } = require('../../../src/renderer/src/store')
      useTransferStore.mockReturnValue({
        isTransferring: true,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Assert: Should show transfer in progress text
      expect(screen.getByText(/Transfer in Progress\.\.\./i)).toBeInTheDocument()
    })

    it('should disable button when validating path', () => {
      // Setup: Path validation in progress
      const { useUIStore, useTransferStore } = require('../../../src/renderer/src/store')

      useUIStore.mockReturnValue({
        selectedDestination: null,
        setSelectedDestination: jest.fn(),
        isSelectingDestination: true // Simulates validation in progress
      })

      useTransferStore.mockReturnValue({
        isTransferring: false,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      const selectButton = screen.getByText(/Select Destination/i)

      // Assert: Button should be disabled during validation
      expect(selectButton).toBeDisabled()
    })

    it('should show "Change Destination" when destination is already set and no transfer', () => {
      // Setup: Destination set, no transfer
      const { useUIStore, useTransferStore } = require('../../../src/renderer/src/store')

      useUIStore.mockReturnValue({
        selectedDestination: '/path/to/destination',
        setSelectedDestination: jest.fn(),
        isSelectingDestination: false
      })

      useTransferStore.mockReturnValue({
        isTransferring: false,
        startTransfer: jest.fn()
      })

      render(<DestinationSelector />)

      // Assert: Should show change destination text
      expect(screen.getByText(/Change Destination/i)).toBeInTheDocument()
    })
  })
})
