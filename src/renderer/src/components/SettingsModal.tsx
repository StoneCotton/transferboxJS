/**
 * Settings Modal Component
 * Modern sidebar-based settings interface
 */

import {
  Save,
  CheckCircle2,
  FolderOpen,
  Plus,
  X,
  Settings,
  FileText,
  Filter,
  Shield,
  Zap,
  Palette,
  ScrollText,
  Info,
  Download,
  BookOpen,
  Bug,
  History,
  ExternalLink
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { TransferMode, AppConfig, UiDensity } from '../../../shared/types'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { useConfigStore, useUIStore, useTransferStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { cn } from '../lib/utils'
import { SettingToggle, SettingInput, SettingNumberInput, AboutLink } from './settings/controls'

type SettingsCategory =
  | 'general'
  | 'files'
  | 'filtering'
  | 'verification'
  | 'performance'
  | 'interface'
  | 'logging'
  | 'about'

interface CategoryConfig {
  id: SettingsCategory
  label: string
  icon: React.ReactNode
  description: string
}

const categories: CategoryConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: <Settings className="h-5 w-5" />,
    description: 'Transfer mode and destination'
  },
  {
    id: 'files',
    label: 'Files',
    icon: <FileText className="h-5 w-5" />,
    description: 'Naming and folder structure'
  },
  {
    id: 'filtering',
    label: 'Filtering',
    icon: <Filter className="h-5 w-5" />,
    description: 'Media file extensions'
  },
  {
    id: 'verification',
    label: 'Verification',
    icon: <Shield className="h-5 w-5" />,
    description: 'Checksums and integrity'
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: <Zap className="h-5 w-5" />,
    description: 'Buffer and chunk settings'
  },
  {
    id: 'interface',
    label: 'Interface',
    icon: <Palette className="h-5 w-5" />,
    description: 'Display preferences'
  },
  {
    id: 'logging',
    label: 'Logging',
    icon: <ScrollText className="h-5 w-5" />,
    description: 'Log level and cleanup'
  },
  {
    id: 'about',
    label: 'About',
    icon: <Info className="h-5 w-5" />,
    description: 'Updates, help, and information'
  }
]

export function SettingsModal() {
  const { showSettings, toggleSettings } = useUIStore()
  const { config, setConfig } = useConfigStore()
  const { isTransferring } = useTransferStore()
  const ipc = useIpc()

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general')

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
  const [uiDensity, setUiDensity] = useState<UiDensity>(config.uiDensity || 'comfortable')
  const [showTooltips, setShowTooltips] = useState(config.showTooltips ?? true)
  // Logging level
  const [logLevel, setLogLevel] = useState<AppConfig['logLevel']>(config.logLevel || 'info')

  const [isSaving, setIsSaving] = useState(false)

  // About section state
  const [appVersion, setAppVersion] = useState<string>('')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateCheckResult, setUpdateCheckResult] = useState<{
    hasUpdate: boolean
    latestVersion: string
  } | null>(null)

  // Disable form controls during transfers (except UI-only settings like density)
  const isFormDisabled = isTransferring || isSaving
  // UI-only settings can be changed during transfers since they don't affect transfer logic
  const isUiOnlyDisabled = isSaving

  // Sync local state with config changes
  useEffect(() => {
    setTransferMode(config.transferMode)
    setDefaultDestination(config.defaultDestination)
    setVerifyChecksums(config.verifyChecksums)
    setAddTimestampToFilename(config.addTimestampToFilename)
    setKeepOriginalFilename(config.keepOriginalFilename)
    setFilenameTemplate(config.filenameTemplate)
    setTimestampFormat(config.timestampFormat)
    setCreateDateBasedFolders(config.createDateBasedFolders)
    setDateFolderFormat(config.dateFolderFormat)
    setCreateDeviceBasedFolders(config.createDeviceBasedFolders)
    setDeviceFolderTemplate(config.deviceFolderTemplate)
    setKeepFolderStructure(config.keepFolderStructure)
    setTransferOnlyMediaFiles(config.transferOnlyMediaFiles)
    setMediaExtensions(config.mediaExtensions)
    setGenerateMHLChecksumFiles(config.generateMHLChecksumFiles)
    setBufferSize(config.bufferSize)
    setChunkSize(config.chunkSize)
    setShowDetailedProgress(config.showDetailedProgress)
    setAutoCleanupLogs(config.autoCleanupLogs)
    setLogRetentionDays(config.logRetentionDays)
    setUnitSystem(config.unitSystem)
    setUiDensity(config.uiDensity || 'comfortable')
    setShowTooltips(config.showTooltips ?? true)
    setLogLevel(config.logLevel || 'info')
  }, [config])

  // Load app version when modal opens
  useEffect(() => {
    if (showSettings) {
      ipc.getAppVersion().then(setAppVersion).catch(console.error)
    }
  }, [showSettings, ipc])

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
        unitSystem,
        uiDensity,
        showTooltips,

        // Logging
        logLevel
      }

      const updatedConfig = await ipc.updateConfig(updates)
      setConfig(updatedConfig)
      // Show toast notification (logs are already created in main process)
      useStore.getState().addToast({
        type: 'success',
        message: 'Settings saved successfully',
        duration: 3000
      })
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

  // Render functions for each category
  const renderGeneralSettings = (): React.ReactNode => (
    <div className="space-y-6">
      {/* Transfer Modes */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Transfer Mode
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setTransferMode(mode.id)}
              disabled={isFormDisabled}
              className={cn(
                'group relative rounded-xl border-2 p-4 text-left transition-all duration-200',
                transferMode === mode.id
                  ? 'border-brand-500 bg-brand-50/80 shadow-md shadow-brand-500/10 dark:border-brand-400 dark:bg-brand-950/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600',
                isFormDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{mode.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={cn(
                        'font-semibold text-sm',
                        transferMode === mode.id
                          ? 'text-brand-900 dark:text-brand-100'
                          : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {mode.name}
                    </h4>
                    {transferMode === mode.id && (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-brand-500" />
                    )}
                  </div>
                  <p
                    className={cn(
                      'mt-1 text-xs leading-relaxed',
                      transferMode === mode.id
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-gray-500 dark:text-gray-400'
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
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Default Destination
          </h4>
          <div className="space-y-3">
            {defaultDestination ? (
              <div className="rounded-xl border-2 border-emerald-400/50 bg-emerald-50/50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                <p className="break-all font-mono text-sm text-emerald-800 dark:text-emerald-200">
                  {defaultDestination}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-50/50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ No destination set - Fully Autonomous mode requires a default destination
                </p>
              </div>
            )}
            <Button
              onClick={handleSelectDestination}
              disabled={isFormDisabled}
              variant="outline"
              className="w-full"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {defaultDestination ? 'Change Destination' : 'Set Default Destination'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const renderFilesSettings = (): React.ReactNode => (
    <div className="space-y-6">
      {/* File Naming */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          File Naming
        </h4>
        <div className="space-y-3">
          <SettingToggle
            checked={addTimestampToFilename}
            onChange={setAddTimestampToFilename}
            disabled={isFormDisabled}
            title="Add Timestamp to Filename"
            description="Add a timestamp to prevent duplicates and track ingestion time"
          />

          {addTimestampToFilename && (
            <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
              <SettingToggle
                checked={keepOriginalFilename}
                onChange={setKeepOriginalFilename}
                disabled={isFormDisabled}
                title="Keep Original Filename"
                description="Preserve the original filename when adding timestamps"
              />

              <SettingInput
                label="Filename Template"
                value={filenameTemplate}
                onChange={setFilenameTemplate}
                disabled={isFormDisabled}
                placeholder="{original}_{timestamp}"
                hint="Use {original} for original name and {timestamp} for timestamp"
              />

              <SettingInput
                label="Timestamp Format"
                value={timestampFormat}
                onChange={setTimestampFormat}
                disabled={isFormDisabled}
                placeholder="%Y%m%d_%H%M%S"
                hint="%Y (year), %m (month), %d (day), %H (hour), %M (min), %S (sec)"
              />
            </div>
          )}
        </div>
      </div>

      {/* Directory Structure */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Directory Structure
        </h4>
        <div className="space-y-3">
          <SettingToggle
            checked={keepFolderStructure}
            onChange={setKeepFolderStructure}
            disabled={isFormDisabled}
            title="Keep Folder Structure"
            description="Maintain the original folder structure from the source drive"
          />

          <SettingToggle
            checked={createDateBasedFolders}
            onChange={setCreateDateBasedFolders}
            disabled={isFormDisabled}
            title="Create Date-Based Folders"
            description="Organize files into folders based on their creation date"
          />

          {createDateBasedFolders && (
            <div className="ml-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
              <SettingInput
                label="Date Folder Format"
                value={dateFolderFormat}
                onChange={setDateFolderFormat}
                disabled={isFormDisabled}
                placeholder="%Y/%m/%d"
                hint="Example: %Y/%m/%d creates YYYY/MM/DD folder structure"
              />
            </div>
          )}

          <SettingToggle
            checked={createDeviceBasedFolders}
            onChange={setCreateDeviceBasedFolders}
            disabled={isFormDisabled}
            title="Create Device-Based Folders"
            description="Create separate folders for each source device or drive"
          />

          {createDeviceBasedFolders && (
            <div className="ml-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
              <SettingInput
                label="Device Folder Template"
                value={deviceFolderTemplate}
                onChange={setDeviceFolderTemplate}
                disabled={isFormDisabled}
                placeholder="{device_name}"
                hint="Use {device_name} for the device name"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderFilteringSettings = (): React.ReactNode => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Media File Filtering
        </h4>
        <div className="space-y-4">
          <SettingToggle
            checked={transferOnlyMediaFiles}
            onChange={setTransferOnlyMediaFiles}
            disabled={isFormDisabled}
            title="Transfer Only Media Files"
            description="Only transfer files with media extensions, ignoring other file types"
          />

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Media File Extensions
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExtension}
                onChange={(e) => setNewExtension(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., .mp4, .mov"
                disabled={isFormDisabled}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
              <Button onClick={handleAddExtension} size="sm" disabled={isFormDisabled}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
              {mediaExtensions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No extensions added</p>
              ) : (
                mediaExtensions.map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/50 dark:text-brand-200"
                  >
                    {ext}
                    <button
                      onClick={() => handleRemoveExtension(ext)}
                      disabled={isFormDisabled}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-brand-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-brand-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderVerificationSettings = (): React.ReactNode => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Transfer Verification
        </h4>
        <div className="space-y-3">
          <SettingToggle
            checked={verifyChecksums}
            onChange={setVerifyChecksums}
            disabled={isFormDisabled}
            title="Verify Checksums"
            description="Verify file integrity after transfer (recommended)"
            badge="Recommended"
          />

          <SettingToggle
            checked={generateMHLChecksumFiles}
            onChange={setGenerateMHLChecksumFiles}
            disabled={isFormDisabled}
            title="Generate MHL Checksum Files"
            description="Create Media Hash List (MHL) files for data integrity verification"
          />
        </div>
      </div>
    </div>
  )

  const renderPerformanceSettings = (): React.ReactNode => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Transfer Performance
        </h4>
        <div className="space-y-4">
          <SettingNumberInput
            label="Buffer Size"
            value={bufferSize}
            onChange={setBufferSize}
            disabled={isFormDisabled}
            hint="Buffer size for file operations (default: 4MB). Higher values may improve performance for large files."
            suffix="bytes"
          />

          <SettingNumberInput
            label="Chunk Size"
            value={chunkSize}
            onChange={setChunkSize}
            disabled={isFormDisabled}
            hint="Chunk size for progress updates (default: 1MB). Smaller values provide more frequent progress updates."
            suffix="bytes"
          />
        </div>
      </div>
    </div>
  )

  const renderInterfaceSettings = (): React.ReactNode => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Display Preferences
        </h4>
        <div className="space-y-4">
          <SettingToggle
            checked={showDetailedProgress}
            onChange={setShowDetailedProgress}
            disabled={isFormDisabled}
            title="Show Detailed Progress"
            description="Display detailed progress information during transfers"
          />

          <SettingToggle
            checked={showTooltips}
            onChange={setShowTooltips}
            disabled={isUiOnlyDisabled}
            title="Show Tooltips"
            description="Display helpful hints when hovering over buttons and icons"
          />

          {/* UI Density */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              UI Density
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUiDensity('comfortable')}
                disabled={isUiOnlyDisabled}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  uiDensity === 'comfortable'
                    ? 'border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50',
                  isUiOnlyDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Comfortable</span>
                  {uiDensity === 'comfortable' && (
                    <CheckCircle2 className="h-4 w-4 text-brand-500" />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Spacious layout with larger elements
                </p>
              </button>
              <button
                onClick={() => setUiDensity('condensed')}
                disabled={isUiOnlyDisabled}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  uiDensity === 'condensed'
                    ? 'border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50',
                  isUiOnlyDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Condensed</span>
                  {uiDensity === 'condensed' && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Compact layout for small screens
                </p>
              </button>
            </div>
          </div>

          {/* Unit System */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              File Size Display Units
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUnitSystem('decimal')}
                disabled={isUiOnlyDisabled}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  unitSystem === 'decimal'
                    ? 'border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50',
                  isUiOnlyDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Decimal</span>
                  {unitSystem === 'decimal' && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  GB, MB, KB (1000-based)
                </p>
              </button>
              <button
                onClick={() => setUnitSystem('binary')}
                disabled={isUiOnlyDisabled}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  unitSystem === 'binary'
                    ? 'border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50',
                  isUiOnlyDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Binary</span>
                  {unitSystem === 'binary' && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  GiB, MiB, KiB (1024-based)
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLoggingSettings = (): React.ReactNode => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Log Settings
        </h4>
        <div className="space-y-4">
          {/* Log Level */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Log Level
            </label>
            <select
              value={logLevel || 'info'}
              onChange={(e) => setLogLevel(e.target.value as AppConfig['logLevel'])}
              disabled={isFormDisabled}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Controls what the app records. The Logs panel filter only affects display.
            </p>
          </div>

          <SettingToggle
            checked={autoCleanupLogs}
            onChange={setAutoCleanupLogs}
            disabled={isFormDisabled}
            title="Auto Cleanup Logs"
            description="Automatically clean up old log entries based on retention settings"
          />

          {autoCleanupLogs && (
            <div className="ml-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
              <SettingNumberInput
                label="Log Retention Days"
                value={logRetentionDays}
                onChange={setLogRetentionDays}
                disabled={isFormDisabled}
                hint="Number of days to keep log entries (0 = keep forever)"
                min={0}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const handleCheckForUpdates = async (): Promise<void> => {
    setIsCheckingUpdate(true)
    setUpdateCheckResult(null)
    try {
      const result = await ipc.checkForUpdates(true) // Force refresh to bypass cache
      setUpdateCheckResult({
        hasUpdate: result.hasUpdate,
        latestVersion: result.latestVersion
      })
      if (result.hasUpdate) {
        useStore.getState().addToast({
          type: 'info',
          message: `Update available: v${result.latestVersion}`,
          duration: 5000
        })
      } else {
        useStore.getState().addToast({
          type: 'success',
          message: "You're running the latest version!",
          duration: 3000
        })
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      useStore.getState().addToast({
        type: 'error',
        message: 'Failed to check for updates',
        duration: 4000
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const renderAboutSettings = (): React.ReactNode => (
    <div className="space-y-6">
      {/* App Info */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Application
        </h4>
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">TransferBox</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version {appVersion || 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Updates */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Updates
        </h4>
        <div className="space-y-3">
          <button
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            className={cn(
              'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
              'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-600 dark:hover:bg-brand-950/20',
              isCheckingUpdate && 'cursor-wait opacity-70'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                updateCheckResult?.hasUpdate
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              <Download className={cn('h-5 w-5', isCheckingUpdate && 'animate-pulse')} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">Check for Updates</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isCheckingUpdate
                  ? 'Checking...'
                  : updateCheckResult?.hasUpdate
                    ? `Update available: v${updateCheckResult.latestVersion}`
                    : updateCheckResult
                      ? 'You have the latest version'
                      : 'Check if a newer version is available'}
              </p>
            </div>
            {updateCheckResult?.hasUpdate && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                New
              </span>
            )}
          </button>

          {updateCheckResult?.hasUpdate && (
            <Button
              onClick={() => ipc.openReleasesPage()}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Update
              <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
            </Button>
          )}
        </div>
      </div>

      {/* Help & Resources */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Help & Resources
        </h4>
        <div className="space-y-2">
          <AboutLink
            icon={<BookOpen className="h-5 w-5" />}
            title="Documentation"
            description="Learn how to use TransferBox"
            comingSoon
          />
          <AboutLink
            icon={<History className="h-5 w-5" />}
            title="View Changelog"
            description="See what's new in each version"
            comingSoon
          />
          <AboutLink
            icon={<Bug className="h-5 w-5" />}
            title="Report Issue"
            description="Report bugs or request features"
            comingSoon
          />
        </div>
      </div>

      {/* Credits */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Credits
        </h4>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            TransferBox is a media ingest utility for professional workflows.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            © {new Date().getFullYear()} Created by Tyler Saari
          </p>
        </div>
      </div>
    </div>
  )

  const renderActiveCategory = (): React.ReactNode => {
    switch (activeCategory) {
      case 'general':
        return renderGeneralSettings()
      case 'files':
        return renderFilesSettings()
      case 'filtering':
        return renderFilteringSettings()
      case 'verification':
        return renderVerificationSettings()
      case 'performance':
        return renderPerformanceSettings()
      case 'interface':
        return renderInterfaceSettings()
      case 'logging':
        return renderLoggingSettings()
      case 'about':
        return renderAboutSettings()
      default:
        return null
    }
  }

  return (
    <Modal isOpen={showSettings} onClose={toggleSettings} size="2xl" hideHeader>
      <div className="flex h-[600px] max-h-[85vh]">
        {/* Sidebar */}
        <div className="flex w-56 flex-col border-r border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
                  activeCategory === category.id
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-800 dark:text-brand-400'
                    : 'text-gray-600 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200'
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    activeCategory === category.id
                      ? 'text-brand-500'
                      : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {category.icon}
                </span>
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            ))}
          </nav>

          {/* Transfer warning */}
          {isTransferring && (
            <div className="border-t border-gray-200 p-3 dark:border-gray-800">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/30">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  ⚠️ Transfer in progress
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Content Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {categories.find((c) => c.id === activeCategory)?.label}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {categories.find((c) => c.id === activeCategory)?.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSettings}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">{renderActiveCategory()}</div>

          {/* Actions Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
            <Button
              variant="outline"
              onClick={toggleSettings}
              disabled={isSaving}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px] bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/20"
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
