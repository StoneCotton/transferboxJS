/**
 * App Component Tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import App from '../../src/renderer/src/App'

// Mock the hooks and stores
jest.mock('../../src/renderer/src/hooks/useAppInit', () => ({
  useAppInit: jest.fn()
}))

const mockStore = {
  useDriveStore: () => ({
    selectedDrive: null,
    scannedFiles: []
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
      transferMode: 'manual'
    }
  })
}

jest.mock('../../src/renderer/src/store', () => mockStore)

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('TransferBox')).toBeDefined()
  })

  describe('Dynamic Layout Based on Transfer Mode', () => {
    it('shows all components in manual mode', () => {
      mockStore.useConfigStore = () => ({
        config: { transferMode: 'manual' }
      })

      render(<App />)
      expect(screen.getByText('Select Drive')).toBeDefined()
      expect(screen.getByText('Set Destination')).toBeDefined()
      expect(screen.getByText('Start Transfer')).toBeDefined()
    })

    it('shows workflow steps for auto-transfer mode', () => {
      mockStore.useConfigStore = () => ({
        config: { transferMode: 'auto-transfer' }
      })

      render(<App />)
      expect(screen.getByText('Select Drive')).toBeDefined()
      expect(screen.getByText('Set Destination')).toBeDefined()
      expect(screen.getByText('Auto Transfer')).toBeDefined()
    })

    it('shows workflow steps for confirm-transfer mode', () => {
      mockStore.useConfigStore = () => ({
        config: { transferMode: 'confirm-transfer' }
      })

      render(<App />)
      expect(screen.getByText('Select Drive')).toBeDefined()
      expect(screen.getByText('Set Destination')).toBeDefined()
      expect(screen.getByText('Confirm Transfer')).toBeDefined()
    })

    it('shows simplified workflow for fully-autonomous mode', () => {
      mockStore.useConfigStore = () => ({
        config: { transferMode: 'fully-autonomous' }
      })

      render(<App />)
      expect(screen.getByText('Select Drive')).toBeDefined()
      expect(screen.getByText('Auto Transfer')).toBeDefined()
      // Should not show "Set Destination" step in fully autonomous mode
      expect(screen.queryByText('Set Destination')).toBeNull()
    })
  })
})
