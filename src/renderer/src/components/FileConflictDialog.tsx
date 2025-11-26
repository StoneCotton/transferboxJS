/**
 * File Conflict Dialog
 * Shows conflicting files and allows user to choose resolution strategy
 */

import {
  AlertTriangle,
  FileX2,
  CheckCircle2,
  X,
  RefreshCw,
  SkipForward,
  Replace,
  FileCheck
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { formatBytes, formatDate } from '../lib/utils'
import { useConfigStore } from '../store'
import type { FileConflictInfo, ConflictResolutionChoice } from '../../../shared/types'

/**
 * Resolution choice for all files
 */
type BulkResolution = 'skip' | 'rename' | 'overwrite' | 'per-file'

interface FileConflictDialogProps {
  isOpen: boolean
  onConfirm: (resolutions: Record<string, ConflictResolutionChoice>) => void
  onCancel: () => void
  conflicts: FileConflictInfo[]
  driveName: string
  destination: string
}

export function FileConflictDialog({
  isOpen,
  onConfirm,
  onCancel,
  conflicts,
  driveName,
  destination
}: FileConflictDialogProps) {
  const { config } = useConfigStore()
  const unitSystem = config?.unitSystem || 'decimal'

  // Track bulk resolution or per-file resolutions
  const [bulkResolution, setBulkResolution] = useState<BulkResolution>('per-file')
  const [perFileResolutions, setPerFileResolutions] = useState<
    Record<string, ConflictResolutionChoice>
  >({})

  // Initialize per-file resolutions with 'skip' as default
  useMemo(() => {
    const initial: Record<string, ConflictResolutionChoice> = {}
    conflicts.forEach((conflict) => {
      initial[conflict.sourcePath] = 'skip'
    })
    setPerFileResolutions(initial)
  }, [conflicts])

  // Handle bulk resolution change
  const handleBulkResolutionChange = (resolution: BulkResolution): void => {
    setBulkResolution(resolution)
    if (resolution !== 'per-file') {
      // Apply to all files
      const newResolutions: Record<string, ConflictResolutionChoice> = {}
      conflicts.forEach((conflict) => {
        newResolutions[conflict.sourcePath] = resolution as ConflictResolutionChoice
      })
      setPerFileResolutions(newResolutions)
    }
  }

  // Handle per-file resolution change
  const handlePerFileChange = (sourcePath: string, resolution: ConflictResolutionChoice): void => {
    setBulkResolution('per-file')
    setPerFileResolutions((prev) => ({
      ...prev,
      [sourcePath]: resolution
    }))
  }

  // Calculate summary stats
  const stats = useMemo(() => {
    const skipCount = Object.values(perFileResolutions).filter((r) => r === 'skip').length
    const renameCount = Object.values(perFileResolutions).filter((r) => r === 'rename').length
    const overwriteCount = Object.values(perFileResolutions).filter((r) => r === 'overwrite').length
    return { skipCount, renameCount, overwriteCount }
  }, [perFileResolutions])

  // Handle confirm
  const handleConfirm = (): void => {
    onConfirm(perFileResolutions)
  }

  // Determine if source is newer
  const isSourceNewer = (conflict: FileConflictInfo): boolean => {
    return conflict.sourceModified > conflict.existingModified
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="File Conflicts Detected" size="lg">
      <div className="space-y-5">
        {/* Warning Icon and Message */}
        <div className="flex items-start gap-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {conflicts.length} file{conflicts.length !== 1 ? 's' : ''} already exist at the
              destination
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Choose how to handle these conflicts before starting the transfer from{' '}
              <span className="font-medium">{driveName}</span>
            </p>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Apply to all files:
          </p>
          <div className="flex flex-wrap gap-2">
            <Tooltip content="Don't transfer any conflicting files. The existing files at the destination will remain unchanged.">
              <Button
                variant={bulkResolution === 'skip' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleBulkResolutionChange('skip')}
                className={bulkResolution === 'skip' ? 'bg-blue-600' : ''}
              >
                <SkipForward className="mr-1.5 h-4 w-4" />
                Skip All
              </Button>
            </Tooltip>
            <Tooltip content="Automatically rename new files by adding a number suffix (e.g., file_1.mp4) to avoid conflicts.">
              <Button
                variant={bulkResolution === 'rename' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleBulkResolutionChange('rename')}
                className={bulkResolution === 'rename' ? 'bg-green-600' : ''}
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Rename All
              </Button>
            </Tooltip>
            <Tooltip content="Overwrite all existing files at the destination with the new files. This cannot be undone.">
              <Button
                variant={bulkResolution === 'overwrite' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleBulkResolutionChange('overwrite')}
                className={bulkResolution === 'overwrite' ? 'bg-red-600' : ''}
              >
                <Replace className="mr-1.5 h-4 w-4" />
                Replace All
              </Button>
            </Tooltip>
            <Tooltip content="Decide individually for each file whether to skip, rename, or replace.">
              <Button
                variant={bulkResolution === 'per-file' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleBulkResolutionChange('per-file')}
                className={bulkResolution === 'per-file' ? 'bg-purple-600' : ''}
              >
                <FileCheck className="mr-1.5 h-4 w-4" />
                Choose Per File
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Conflict List */}
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          {conflicts.map((conflict) => (
            <div
              key={conflict.sourcePath}
              className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileX2 className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="truncate font-medium text-gray-900 dark:text-white">
                      {conflict.fileName}
                    </span>
                    {isSourceNewer(conflict) && (
                      <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Source newer
                      </span>
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Source:</span>{' '}
                      {formatBytes(conflict.sourceSize, unitSystem)} •{' '}
                      {formatDate(conflict.sourceModified)}
                    </div>
                    <div>
                      <span className="font-medium">Existing:</span>{' '}
                      {formatBytes(conflict.existingSize, unitSystem)} •{' '}
                      {formatDate(conflict.existingModified)}
                    </div>
                  </div>
                </div>

                {/* Per-file resolution selector */}
                <div className="flex shrink-0 gap-1">
                  <Tooltip content="Skip: Don't transfer this file" position="top">
                    <button
                      onClick={() => handlePerFileChange(conflict.sourcePath, 'skip')}
                      className={`rounded p-1.5 transition-colors ${
                        perFileResolutions[conflict.sourcePath] === 'skip'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                          : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700'
                      }`}
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Rename: Add a number suffix to the new file" position="top">
                    <button
                      onClick={() => handlePerFileChange(conflict.sourcePath, 'rename')}
                      className={`rounded p-1.5 transition-colors ${
                        perFileResolutions[conflict.sourcePath] === 'rename'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                          : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700'
                      }`}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Replace: Overwrite the existing file" position="top">
                    <button
                      onClick={() => handlePerFileChange(conflict.sourcePath, 'overwrite')}
                      className={`rounded p-1.5 transition-colors ${
                        perFileResolutions[conflict.sourcePath] === 'overwrite'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Replace className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-2 text-sm dark:bg-gray-800">
          <span className="text-gray-600 dark:text-gray-400">Summary:</span>
          <div className="flex gap-4">
            {stats.skipCount > 0 && (
              <span className="text-blue-600 dark:text-blue-400">{stats.skipCount} skip</span>
            )}
            {stats.renameCount > 0 && (
              <span className="text-green-600 dark:text-green-400">{stats.renameCount} rename</span>
            )}
            {stats.overwriteCount > 0 && (
              <span className="text-red-600 dark:text-red-400">{stats.overwriteCount} replace</span>
            )}
          </div>
        </div>

        {/* Destination info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Destination:</span>
          <span className="truncate">{destination}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="flex-1 hover:bg-red-50 hover:text-red-600"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel Transfer
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 text-white"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Continue with {conflicts.length - stats.skipCount} file
            {conflicts.length - stats.skipCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
