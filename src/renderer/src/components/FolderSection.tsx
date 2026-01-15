/**
 * FolderSection Component
 * Renders a collapsible folder section containing files with selection support.
 * Used in FileList for the folder-grouped file view in selective transfer feature.
 */

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '../lib/utils'
import { FileItem } from './FileItem'
import { getFolderSelectionState } from '../utils/fileGrouping'
import type { FolderGroup } from '../utils/fileGrouping'
import type { TransferProgress } from '../../../shared/types'

interface FolderSectionProps {
  /** The folder group containing files */
  group: FolderGroup
  /** Whether the folder is expanded */
  isExpanded: boolean
  /** Whether the folder is selected (all files selected by default) */
  isFolderSelected: boolean
  /** Set of deselected file paths within this folder */
  deselectedFiles: Set<string>
  /** Current transfer progress */
  progress: TransferProgress | null
  /** Whether to use condensed UI mode */
  isCondensed: boolean
  /** Callback when folder expand/collapse is toggled */
  onToggleExpand: () => void
  /** Callback when folder selection is toggled */
  onToggleFolderSelect: () => void
  /** Callback when a file's selection is toggled */
  onToggleFileSelect: (filePath: string) => void
  /** Whether selection is disabled (e.g., during transfer) */
  selectionDisabled?: boolean
}

/**
 * Formats bytes to a human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1000
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FolderSection({
  group,
  isExpanded,
  isFolderSelected,
  deselectedFiles,
  progress,
  isCondensed,
  onToggleExpand,
  onToggleFolderSelect,
  onToggleFileSelect,
  selectionDisabled = false
}: FolderSectionProps) {
  // Calculate selection state for this folder
  const selectionState = useMemo(() => {
    return getFolderSelectionState(group, isFolderSelected, deselectedFiles)
  }, [group, isFolderSelected, deselectedFiles])

  const { isFullySelected, isPartiallySelected, selectedCount, totalCount } = selectionState

  // Calculate transfer progress for this folder
  const folderProgress = useMemo(() => {
    if (!progress?.completedFiles) return null
    const completedInFolder = group.files.filter((f) =>
      progress.completedFiles?.some((cf) => cf.sourcePath === f.path && cf.status === 'complete')
    ).length
    return {
      completed: completedInFolder,
      total: group.fileCount
    }
  }, [group, progress])

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Folder Header */}
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700',
          isCondensed ? 'p-2' : 'p-3'
        )}
        onClick={onToggleExpand}
      >
        {/* Expand/Collapse Icon */}
        <button
          className="flex-shrink-0 p-0.5"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Checkbox with indeterminate state */}
        <input
          type="checkbox"
          checked={isFullySelected}
          ref={(el) => {
            if (el) el.indeterminate = isPartiallySelected
          }}
          onChange={(e) => {
            e.stopPropagation()
            onToggleFolderSelect()
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={selectionDisabled}
          className={cn(
            'rounded border-gray-300 text-brand-600 focus:ring-brand-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isCondensed ? 'h-3.5 w-3.5' : 'h-4 w-4'
          )}
        />

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-amber-500" />
        )}

        {/* Folder Name */}
        <span
          className={cn(
            'flex-1 truncate font-medium text-gray-900 dark:text-white',
            isCondensed ? 'text-xs' : 'text-sm'
          )}
        >
          {group.displayName}
        </span>

        {/* File Count & Size */}
        <span
          className={cn('flex-shrink-0 text-gray-500', isCondensed ? 'text-[10px]' : 'text-xs')}
        >
          {selectedCount}/{totalCount} files
          {!isCondensed && ` (${formatBytes(group.totalSize)})`}
        </span>

        {/* Progress indicator */}
        {folderProgress && folderProgress.completed > 0 && (
          <span className={cn('flex-shrink-0 text-green-600', isCondensed ? 'text-[10px]' : 'text-xs')}>
            {folderProgress.completed}/{folderProgress.total} done
          </span>
        )}
      </div>

      {/* File List (collapsed/expanded) */}
      {isExpanded && (
        <div
          className={cn(
            'divide-y divide-gray-100 dark:divide-gray-700',
            isCondensed ? 'space-y-1 p-2' : 'space-y-2 p-3'
          )}
        >
          {group.files.map((file) => {
            const isFileSelected = isFolderSelected && !deselectedFiles.has(file.path)
            return (
              <FileItem
                key={file.path}
                file={file}
                progress={progress}
                isSelected={isFileSelected}
                isCondensed={isCondensed}
                onToggleSelect={() => onToggleFileSelect(file.path)}
                selectionDisabled={selectionDisabled}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
