/**
 * FileItem Component
 * Renders a single file row in the file list with selection checkbox, status, and metadata.
 * Extracted from FileList.tsx to support the selective file transfer feature.
 */

import { useState, type ReactElement } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Copy
} from 'lucide-react'
import { cn, formatDuration } from '../lib/utils'
import { Tooltip } from './ui/Tooltip'
import {
  getFileIcon,
  getFileType,
  getFileTransferStatus,
  getFileChecksum,
  getFileElapsedTime,
  copyToClipboard
} from '../utils/fileListHelpers'
import type { ScannedFile, TransferProgress } from '../../../shared/types'

export type FileTransferStatus =
  | 'pending'
  | 'transferring'
  | 'verifying'
  | 'complete'
  | 'error'
  | 'skipped'

interface FileItemProps {
  /** The scanned file to display */
  file: ScannedFile
  /** Current transfer progress (null if not transferring) */
  progress: TransferProgress | null
  /** Whether the file is selected for transfer */
  isSelected: boolean
  /** Whether to use condensed UI mode */
  isCondensed: boolean
  /** Callback when selection changes */
  onToggleSelect: () => void
  /** Whether selection is disabled (e.g., during transfer) */
  selectionDisabled?: boolean
}

export function FileItem({
  file,
  progress,
  isSelected,
  isCondensed,
  onToggleSelect,
  selectionDisabled = false
}: FileItemProps) {
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null)

  const filePath = file.path
  const Icon = getFileIcon(filePath)
  const fileName = filePath.split('/').pop() || filePath
  const fileType = getFileType(filePath)
  const status = getFileTransferStatus(filePath, progress)
  const checksum = getFileChecksum(filePath, progress)
  const elapsedTime = getFileElapsedTime(filePath, progress)

  // Format creation date and time
  const creationDate = new Date(file.birthtime)
  const formattedDate = creationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  const formattedTime = creationDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Handle checksum copy
  const handleCopyChecksum = (checksum: string): void => {
    copyToClipboard(checksum)
    setCopiedChecksum(checksum)
    setTimeout(() => setCopiedChecksum(null), 2000)
  }

  // Status icon and colors
  const getStatusIcon = (): ReactElement => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'transferring':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
      case 'verifying':
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
    }
  }

  const getStatusColor = (): string => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
      case 'transferring':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
      case 'verifying':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
      case 'skipped':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
      default:
        return 'bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
    }
  }

  // Visual indication for deselected files
  const isDeselected = !isSelected

  return (
    <div
      className={cn(
        'group flex items-center rounded-lg border transition-colors',
        isCondensed ? 'gap-2 p-2' : 'gap-3 p-3',
        getStatusColor(),
        'hover:shadow-sm',
        isDeselected && 'opacity-50'
      )}
    >
      {/* Selection Checkbox */}
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          disabled={selectionDisabled}
          className={cn(
            'rounded border-gray-300 text-brand-600 focus:ring-brand-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isCondensed ? 'h-3.5 w-3.5' : 'h-4 w-4'
          )}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* File Icon */}
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-lg',
          isCondensed ? 'h-7 w-7' : 'h-10 w-10',
          fileType === 'video' &&
            'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
          fileType === 'image' &&
            'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
          fileType === 'audio' &&
            'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
          fileType === 'other' &&
            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        )}
      >
        <Icon className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate font-medium text-gray-900 dark:text-gray-100',
              isCondensed ? 'text-xs' : 'text-sm'
            )}
          >
            {fileName}
          </span>
          {isCondensed ? null : getStatusIcon()}
        </div>

        {/* File creation date and time - hide in condensed mode */}
        {!isCondensed && (
          <div className="mt-1 flex items-center gap-2">
            <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Created: {formattedDate} at {formattedTime}
            </span>
          </div>
        )}

        {/* Elapsed time for completed files - hide in condensed mode */}
        {!isCondensed && elapsedTime !== null && status === 'complete' && (
          <div className="mt-1 flex items-center gap-2">
            <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Completed in: {formatDuration(elapsedTime)}
            </span>
          </div>
        )}

        {/* Checksum for completed files - hide in condensed mode */}
        {!isCondensed && status === 'complete' && checksum && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Checksum:</span>
            <Tooltip
              content="XXH3 checksum used to verify file integrity after transfer"
              position="top"
            >
              <code className="cursor-help rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {checksum}
              </code>
            </Tooltip>
            <Tooltip
              content="Copy checksum to clipboard for manual verification"
              position="top"
            >
              <button
                onClick={() => handleCopyChecksum(checksum)}
                className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Copy className="h-3 w-3" />
                {copiedChecksum === checksum ? 'Copied!' : 'Copy'}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0">
        <span
          className={cn(
            'inline-flex items-center rounded-full font-medium',
            isCondensed ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            status === 'complete' &&
              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            status === 'transferring' &&
              'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            status === 'verifying' &&
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            status === 'error' &&
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            status === 'skipped' &&
              'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
            status === 'pending' &&
              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          )}
        >
          {isCondensed
            ? status.charAt(0).toUpperCase()
            : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  )
}
