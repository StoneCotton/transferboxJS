/**
 * Settings Modal Component
 * Configure transfer modes and other settings
 */

import { Save, CheckCircle2, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import type { TransferMode, AppConfig } from '../../../shared/types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { useConfigStore, useUIStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { cn } from '../lib/utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function SettingsModal() {
  const { showSettings, toggleSettings } = useUIStore()
  const { config, setConfig } = useConfigStore()
  const ipc = useIpc()

  const [transferMode, setTransferMode] = useState<TransferMode>(config.transferMode)
  const [defaultDestination, setDefaultDestination] = useState<string | null>(
    config.defaultDestination
  )
  const [verifyChecksums, setVerifyChecksums] = useState(config.verifyChecksums)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelectDestination = async (): Promise<void> => {
    const folder = await ipc.selectFolder()
    if (folder) {
      setDefaultDestination(folder)
    }
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    try {
      const updates: Partial<AppConfig> = {
        transferMode,
        defaultDestination,
        verifyChecksums
      }

      const updatedConfig = await ipc.updateConfig(updates)
      setConfig(updatedConfig)
      toggleSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const modes: Array<{
    id: TransferMode
    name: string
    description: string
    icon: string
  }> = [
    {
      id: 'auto-transfer',
      name: 'Auto-Transfer',
      description: 'Automatically scan when drive detected. Set destination each time.',
      icon: '⚡'
    },
    {
      id: 'confirm-transfer',
      name: 'Confirm Transfer',
      description: 'Auto-scan and require confirmation before starting transfer.',
      icon: '✓'
    },
    {
      id: 'fully-autonomous',
      name: 'Fully Autonomous',
      description: 'Completely automatic. Transfer to pre-configured destination.',
      icon: '🤖'
    },
    {
      id: 'manual',
      name: 'Manual',
      description: 'Full manual control. Select everything yourself.',
      icon: '👆'
    }
  ]

  return (
    <Modal isOpen={showSettings} onClose={toggleSettings} title="Settings" size="lg">
      <div className="space-y-6">
        {/* Transfer Modes */}
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Transfer Mode
          </h3>
          <div className="space-y-3">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setTransferMode(mode.id)}
                className={cn(
                  'w-full rounded-xl border-2 p-4 text-left transition-all',
                  transferMode === mode.id
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/50'
                    : 'border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{mode.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4
                        className={cn(
                          'font-semibold',
                          transferMode === mode.id
                            ? 'text-brand-900 dark:text-brand-100'
                            : 'text-gray-900 dark:text-white'
                        )}
                      >
                        {mode.name}
                      </h4>
                      {transferMode === mode.id && (
                        <CheckCircle2 className="h-5 w-5 text-brand-500" />
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-sm',
                        transferMode === mode.id
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {mode.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Default Destination (for Fully Autonomous mode) */}
        {transferMode === 'fully-autonomous' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              Default Destination
            </h3>
            <div className="space-y-3">
              {defaultDestination ? (
                <div className="rounded-lg border-2 border-green-400 bg-green-50 p-3 dark:border-green-600 dark:bg-green-950/50">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {defaultDestination}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-3 dark:border-yellow-600 dark:bg-yellow-950/50">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    ⚠️ No destination set - Fully Autonomous mode requires a default destination
                  </p>
                </div>
              )}
              <Button
                onClick={handleSelectDestination}
                className="w-full bg-gradient-to-r from-slate-600 to-slate-700"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {defaultDestination ? 'Change Destination' : 'Set Default Destination'}
              </Button>
            </div>
          </div>
        )}

        {/* Checksum Verification */}
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Transfer Options
          </h3>
          <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
            <input
              type="checkbox"
              checked={verifyChecksums}
              onChange={(e) => setVerifyChecksums(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Verify Checksums</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verify file integrity after transfer (recommended)
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
          <Button variant="ghost" onClick={toggleSettings} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 text-white"
          >
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
