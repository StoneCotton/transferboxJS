/**
 * Settings Modal Component
 * Configure transfer modes and other settings
 */

import { Save, CheckCircle2, FolderOpen, Plus, X } from 'lucide-react'
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

  // File naming settings
  const [addTimestampToFilename, setAddTimestampToFilename] = useState(
    config.addTimestampToFilename
  )
  const [keepOriginalFilename, setKeepOriginalFilename] = useState(config.keepOriginalFilename)
  const [filenameTemplate, setFilenameTemplate] = useState(config.filenameTemplate)
  const [timestampFormat, setTimestampFormat] = useState(config.timestampFormat)

  // Directory structure settings
  const [createDateBasedFolders, setCreateDateBasedFolders] = useState(
    config.createDateBasedFolders
  )
  const [dateFolderFormat, setDateFolderFormat] = useState(config.dateFolderFormat)
  const [createDeviceBasedFolders, setCreateDeviceBasedFolders] = useState(
    config.createDeviceBasedFolders
  )
  const [deviceFolderTemplate, setDeviceFolderTemplate] = useState(config.deviceFolderTemplate)
  const [keepFolderStructure, setKeepFolderStructure] = useState(config.keepFolderStructure)

  // Media file filtering
  const [transferOnlyMediaFiles, setTransferOnlyMediaFiles] = useState(
    config.transferOnlyMediaFiles
  )
  const [mediaExtensions, setMediaExtensions] = useState<string[]>(config.mediaExtensions)
  const [newExtension, setNewExtension] = useState('')

  // Checksum settings
  const [generateMHLChecksumFiles, setGenerateMHLChecksumFiles] = useState(
    config.generateMHLChecksumFiles
  )

  // Performance settings
  const [bufferSize, setBufferSize] = useState(config.bufferSize)
  const [chunkSize, setChunkSize] = useState(config.chunkSize)

  // UI preferences
  const [showDetailedProgress, setShowDetailedProgress] = useState(config.showDetailedProgress)
  const [autoCleanupLogs, setAutoCleanupLogs] = useState(config.autoCleanupLogs)
  const [logRetentionDays, setLogRetentionDays] = useState(config.logRetentionDays)
  const [unitSystem, setUnitSystem] = useState(config.unitSystem)

  const [isSaving, setIsSaving] = useState(false)

  const handleSelectDestination = async (): Promise<void> => {
    const folder = await ipc.selectFolder()
    if (folder) {
      setDefaultDestination(folder)
    }
  }

  const handleAddExtension = (): void => {
    if (newExtension.trim() && !mediaExtensions.includes(newExtension.toLowerCase())) {
      const extension = newExtension.startsWith('.')
        ? newExtension.toLowerCase()
        : `.${newExtension.toLowerCase()}`
      setMediaExtensions([...mediaExtensions, extension])
      setNewExtension('')
    }
  }

  const handleRemoveExtension = (extension: string): void => {
    setMediaExtensions(mediaExtensions.filter((ext) => ext !== extension))
  }

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleAddExtension()
    }
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    try {
      const updates: Partial<AppConfig> = {
        transferMode,
        defaultDestination,
        verifyChecksums,

        // File naming settings
        addTimestampToFilename,
        keepOriginalFilename,
        filenameTemplate,
        timestampFormat,

        // Directory structure settings
        createDateBasedFolders,
        dateFolderFormat,
        createDeviceBasedFolders,
        deviceFolderTemplate,
        keepFolderStructure,

        // Media file filtering
        transferOnlyMediaFiles,
        mediaExtensions,

        // Checksum settings
        generateMHLChecksumFiles,

        // Performance settings
        bufferSize,
        chunkSize,

        // UI preferences
        showDetailedProgress,
        autoCleanupLogs,
        logRetentionDays,
        unitSystem
      }

      const updatedConfig = await ipc.updateConfig(updates)
      setConfig(updatedConfig)
      toggleSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    <Modal isOpen={showSettings} onClose={toggleSettings} title="Settings" size="xl">
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-8">
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

            {/* File Naming Settings */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                File Naming
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={addTimestampToFilename}
                    onChange={(e) => setAddTimestampToFilename(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Add Timestamp to Filename
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automatically add a timestamp to file names to prevent duplicates and track
                      when files were ingested
                    </p>
                  </div>
                </label>

                {addTimestampToFilename && (
                  <div className="ml-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        checked={keepOriginalFilename}
                        onChange={(e) => setKeepOriginalFilename(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Keep Original Filename
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Preserve the original filename when adding timestamps
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white">
                        Filename Template
                      </label>
                      <input
                        type="text"
                        value={filenameTemplate}
                        onChange={(e) => setFilenameTemplate(e.target.value)}
                        placeholder="{original}_{timestamp}"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Use {'{original}'} for original name and {'{timestamp}'} for timestamp
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white">
                        Timestamp Format
                      </label>
                      <input
                        type="text"
                        value={timestampFormat}
                        onChange={(e) => setTimestampFormat(e.target.value)}
                        placeholder="%Y%m%d_%H%M%S"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Format: %Y (year), %m (month), %d (day), %H (hour), %M (minute), %S (second)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Directory Structure Settings */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Directory Structure
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={keepFolderStructure}
                    onChange={(e) => setKeepFolderStructure(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Keep Folder Structure
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Maintain the original folder structure from the source drive
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={createDateBasedFolders}
                    onChange={(e) => setCreateDateBasedFolders(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Create Date-Based Folders
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Organize files into folders based on their creation date
                    </p>
                  </div>
                </label>

                {createDateBasedFolders && (
                  <div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Date Folder Format
                    </label>
                    <input
                      type="text"
                      value={dateFolderFormat}
                      onChange={(e) => setDateFolderFormat(e.target.value)}
                      placeholder="%Y/%m/%d"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Example: %Y/%m/%d creates YYYY/MM/DD folder structure
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={createDeviceBasedFolders}
                    onChange={(e) => setCreateDeviceBasedFolders(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Create Device-Based Folders
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create separate folders for each source device or drive
                    </p>
                  </div>
                </label>

                {createDeviceBasedFolders && (
                  <div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Device Folder Template
                    </label>
                    <input
                      type="text"
                      value={deviceFolderTemplate}
                      onChange={(e) => setDeviceFolderTemplate(e.target.value)}
                      placeholder="{device_name}"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Use {'{device_name}'} for the device name
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Media File Filtering */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Media File Filtering
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={transferOnlyMediaFiles}
                    onChange={(e) => setTransferOnlyMediaFiles(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Transfer Only Media Files
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Only transfer files with media extensions, ignoring other file types
                    </p>
                  </div>
                </label>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Media File Extensions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="e.g., .mp4, .mov"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <Button onClick={handleAddExtension} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mediaExtensions.map((ext) => (
                      <span
                        key={ext}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                      >
                        {ext}
                        <button
                          onClick={() => handleRemoveExtension(ext)}
                          className="ml-1 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Transfer Options */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Transfer Options
              </h3>
              <div className="space-y-4">
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

                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={generateMHLChecksumFiles}
                    onChange={(e) => setGenerateMHLChecksumFiles(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Generate MHL Checksum Files
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create Media Hash List (MHL) files for data integrity verification
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Performance Settings */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Performance Settings
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Buffer Size (bytes)
                  </label>
                  <input
                    type="number"
                    value={bufferSize}
                    onChange={(e) => setBufferSize(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Buffer size for file operations (default: 4MB). Higher values may improve
                    performance for large files.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Chunk Size (bytes)
                  </label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Chunk size for progress updates (default: 1MB). Smaller values provide more
                    frequent progress updates.
                  </p>
                </div>
              </div>
            </div>

            {/* UI Preferences */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                UI Preferences
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={showDetailedProgress}
                    onChange={(e) => setShowDetailedProgress(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Show Detailed Progress
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Display detailed progress information during transfers
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={autoCleanupLogs}
                    onChange={(e) => setAutoCleanupLogs(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Auto Cleanup Logs</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automatically clean up old log entries based on retention settings
                    </p>
                  </div>
                </label>

                {autoCleanupLogs && (
                  <div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Log Retention Days
                    </label>
                    <input
                      type="number"
                      value={logRetentionDays}
                      onChange={(e) => setLogRetentionDays(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Number of days to keep log entries (0 = keep forever)
                    </p>
                  </div>
                )}

                {/* Unit System */}
                <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                    File Size Display Units
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="unitSystem"
                        value="decimal"
                        checked={unitSystem === 'decimal'}
                        onChange={(e) => setUnitSystem(e.target.value as 'decimal')}
                        className="h-4 w-4 text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Decimal (GB, MB, KB) - 1000-based
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Matches standard storage device displays (1 GB = 1,000,000,000 bytes)
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="unitSystem"
                        value="binary"
                        checked={unitSystem === 'binary'}
                        onChange={(e) => setUnitSystem(e.target.value as 'binary')}
                        className="h-4 w-4 text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Binary (GiB, MiB, KiB) - 1024-based
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Traditional computer science units (1 GiB = 1,073,741,824 bytes)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Actions */}
        <div className="flex gap-3 border-t border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Button
            variant="outline"
            onClick={toggleSettings}
            className="flex-1 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
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
