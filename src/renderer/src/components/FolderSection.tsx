/**
 * FolderSection Component
 * Renders a collapsible folder section containing files with selection support.
 * Used in FileList for the folder-grouped file view in selective transfer feature.
 * Now supports recursive rendering for nested folder hierarchies.
 */

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '../lib/utils'
import { FileItem } from './FileItem'
import { getTreeNodeSelectionState } from '../utils/fileGrouping'
import type { FolderTreeNode } from '../utils/fileGrouping'
import type { TransferProgress } from '../../../shared/types'

interface FolderSectionProps {
  /** The folder tree node */
  node: FolderTreeNode
  /** Whether the folder is expanded */
  isExpanded: boolean
  /** Set of selected folder relative paths */
  selectedFolders: Set<string>
  /** Set of deselected file paths within selected folders */
  deselectedFiles: Set<string>
  /** Set of individually selected file paths (when folder not selected) */
  individuallySelectedFiles: Set<string>
  /** Set of expanded folder paths (for children) */
  expandedFolders: Set<string>
  /** Current transfer progress */
  progress: TransferProgress | null
  /** Whether to use condensed UI mode */
  isCondensed: boolean
  /** Starting index for files in this folder (for shift-click calculation) */
  startFileIndex: number
  /** Nesting depth for indentation */
  depth: number
  /** Callback when folder expand/collapse is toggled */
  onToggleExpand: (relativePath: string) => void
  /** Callback when folder selection is toggled (with node for cascade) */
  onToggleFolderSelect: (relativePath: string, node: FolderTreeNode, shiftKey: boolean) => void
  /** Callback when a file's selection is toggled (with index and shift key state) */
  onToggleFileSelect: (
    filePath: string,
    folderPath: string,
    index: number,
    shiftKey: boolean
  ) => void
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
  node,
  isExpanded,
  selectedFolders,
  deselectedFiles,
  individuallySelectedFiles,
  expandedFolders,
  progress,
  isCondensed,
  startFileIndex,
  depth,
  onToggleExpand,
  onToggleFolderSelect,
  onToggleFileSelect,
  selectionDisabled = false
}: FolderSectionProps) {
  // Calculate selection state for this node (includes descendants)
  const selectionState = useMemo(() => {
    return getTreeNodeSelectionState(
      node,
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )
  }, [node, selectedFolders, deselectedFiles, individuallySelectedFiles])

  const { isFullySelected, isPartiallySelected, selectedCount, totalCount } = selectionState

  // Check if this folder itself is selected (for file selection logic)
  const isFolderSelected = selectedFolders.has(node.relativePath)

  // Calculate transfer progress for this folder (direct files only)
  const folderProgress = useMemo(() => {
    if (!progress?.completedFiles) return null
    const completedInFolder = node.files.filter((f) =>
      progress.completedFiles?.some((cf) => cf.sourcePath === f.path && cf.status === 'complete')
    ).length
    return {
      completed: completedInFolder,
      total: node.directFileCount
    }
  }, [node, progress])

  // Calculate start indices for children
  const childStartIndices = useMemo(() => {
    const indices: number[] = []
    let currentIndex = startFileIndex + node.files.length
    for (const child of node.children) {
      indices.push(currentIndex)
      // Count all files in child subtree
      const countFiles = (n: FolderTreeNode): number =>
        n.files.length + n.children.reduce((sum, c) => sum + countFiles(c), 0)
      currentIndex += countFiles(child)
    }
    return indices
  }, [node, startFileIndex])

  const hasContent = node.files.length > 0 || node.children.length > 0

  return (
    <div className={cn(depth > 0 && 'ml-4')}>
      {/* Folder Header */}
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
          isCondensed ? 'p-2' : 'p-3'
        )}
        onClick={() => onToggleExpand(node.relativePath)}
      >
        {/* Expand/Collapse Icon */}
        {hasContent ? (
          <button
            className="flex-shrink-0 p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.relativePath)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Checkbox with indeterminate state */}
        <input
          type="checkbox"
          checked={isFullySelected}
          ref={(el) => {
            if (el) el.indeterminate = isPartiallySelected
          }}
          onChange={(e) => {
            e.stopPropagation()
            const shiftKey = (e.nativeEvent as MouseEvent).shiftKey
            onToggleFolderSelect(node.relativePath, node, shiftKey)
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
          {node.displayName}
        </span>

        {/* File Count (shows recursive totals) */}
        <span
          className={cn('flex-shrink-0 text-gray-500', isCondensed ? 'text-[10px]' : 'text-xs')}
        >
          {selectedCount}/{totalCount} files
          {!isCondensed && ` (${formatBytes(node.totalSize)})`}
        </span>

        {/* Progress indicator */}
        {folderProgress && folderProgress.completed > 0 && (
          <span
            className={cn('flex-shrink-0 text-green-600', isCondensed ? 'text-[10px]' : 'text-xs')}
          >
            {folderProgress.completed}/{folderProgress.total} done
          </span>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={cn('mt-1', isCondensed ? 'space-y-1' : 'space-y-2')}>
          {/* Direct files */}
          {node.files.length > 0 && (
            <div
              className={cn(
                'ml-5 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700',
                isCondensed ? 'p-2' : 'p-3'
              )}
            >
              {node.files.map((file, fileIndex) => {
                const isFileSelected = isFolderSelected
                  ? !deselectedFiles.has(file.path)
                  : individuallySelectedFiles.has(file.path)

                const globalIndex = startFileIndex + fileIndex

                return (
                  <FileItem
                    key={file.path}
                    file={file}
                    progress={progress}
                    isSelected={isFileSelected}
                    isCondensed={isCondensed}
                    onToggleSelect={(shiftKey) =>
                      onToggleFileSelect(file.path, node.relativePath, globalIndex, shiftKey)
                    }
                    selectionDisabled={selectionDisabled}
                  />
                )
              })}
            </div>
          )}

          {/* Child folders (recursive) */}
          {node.children.map((child, childIndex) => (
            <FolderSection
              key={child.relativePath}
              node={child}
              isExpanded={expandedFolders.has(child.relativePath)}
              selectedFolders={selectedFolders}
              deselectedFiles={deselectedFiles}
              individuallySelectedFiles={individuallySelectedFiles}
              expandedFolders={expandedFolders}
              progress={progress}
              isCondensed={isCondensed}
              startFileIndex={childStartIndices[childIndex]}
              depth={depth + 1}
              onToggleExpand={onToggleExpand}
              onToggleFolderSelect={onToggleFolderSelect}
              onToggleFileSelect={onToggleFileSelect}
              selectionDisabled={selectionDisabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
