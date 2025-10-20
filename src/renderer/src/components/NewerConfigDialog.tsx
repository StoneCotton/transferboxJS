/**
 * Dialog for handling newer config version warnings
 */

import { useState, useEffect } from 'react'
import { useIpc } from '../hooks/useIpc'
import { AlertTriangle, Settings, RotateCcw } from 'lucide-react'
import { Button } from './ui/Button'

interface NewerConfigWarning {
  configVersion: string
  appVersion: string
  timestamp: number
}

export function NewerConfigDialog() {
  const [warning, setWarning] = useState<NewerConfigWarning | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isHandling, setIsHandling] = useState(false)
  const ipc = useIpc()

  useEffect(() => {
    // Check for newer config warning on mount
    const checkWarning = async () => {
      try {
        const warningData = await ipc.getNewerConfigWarning()
        if (warningData) {
          setWarning(warningData)
          setIsVisible(true)
        }
      } catch (error) {
        console.error('Failed to check for newer config warning:', error)
      }
    }

    checkWarning()
  }, [ipc])

  const handleContinue = async () => {
    setIsHandling(true)
    try {
      await ipc.handleNewerConfigChoice('continue')
      setIsVisible(false)
      setWarning(null)
    } catch (error) {
      console.error('Failed to continue with newer config:', error)
    } finally {
      setIsHandling(false)
    }
  }

  const handleReset = async () => {
    setIsHandling(true)
    try {
      await ipc.handleNewerConfigChoice('reset')
      setIsVisible(false)
      setWarning(null)
      // Optionally reload the app or refresh config
      window.location.reload()
    } catch (error) {
      console.error('Failed to reset config:', error)
    } finally {
      setIsHandling(false)
    }
  }

  const handleDismiss = async () => {
    try {
      await ipc.clearNewerConfigWarning()
      setIsVisible(false)
      setWarning(null)
    } catch (error) {
      console.error('Failed to dismiss warning:', error)
    }
  }

  if (!isVisible || !warning) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Configuration Version Mismatch</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Your configuration file was created with a newer version of TransferBox (
            <strong>v{warning.configVersion}</strong>) than the current app version (
            <strong>v{warning.appVersion}</strong>).
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 text-sm">
              <strong>Warning:</strong> Using a newer configuration with an older app version may
              cause compatibility issues or unexpected behavior.
            </p>
          </div>

          <p className="text-gray-600 text-sm">What would you like to do?</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleContinue}
            disabled={isHandling}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Settings className="h-4 w-4 mr-2" />
            Continue with Current Config
          </Button>

          <Button
            onClick={handleReset}
            disabled={isHandling}
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            onClick={handleDismiss}
            disabled={isHandling}
            variant="ghost"
            className="w-full text-gray-500 hover:text-gray-700"
          >
            Dismiss for Now
          </Button>
        </div>

        {isHandling && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Processing...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
