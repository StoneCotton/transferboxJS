/**
 * FileList Component - Visual Transfer Queue with Folder-Grouped Selection
 * Displays scanned files grouped by folder with selection support for selective transfers.
 * Files can be selected/deselected individually or by folder.
 */

import { useMemo } from 'react'
import { Folder, FileType as FileTypeIcon, CheckSquare, Square } from 'lucide-react'
import {
  useDriveStore,
  useTransferStore,
  useFileGroups,
  useSelectionStats
} from '../store'
import { useUiDensity } from '../hooks/useUiDensity'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'
import { FolderSection } from './FolderSection'
import { cn } from '../lib/utils'
import { getFileTransferStatus } from '../utils/fileListHelpers'
import { getAllFolderPaths } from '../utils/fileGrouping'

export function FileList() {
  const {
    scannedFiles,
    scanInProgress,
    fileSelection,
    toggleFolderSelection,
    toggleFileSelection,
    toggleFolderExpanded,
    selectAllFolders,
    deselectAllFolders
  } = useDriveStore()
  const { progress, isTransferring } = useTransferStore()
  const { isCondensed } = useUiDensity()

  // Get files grouped by folder
  const folderGroups = useFileGroups()

  // Get selection statistics
  const selectionStats = useSelectionStats()

  // Calculate transfer status statistics
  const transferStats = useMemo(() => {
    const stats = {
      pending: 0,
      transferring: 0,
      verifying: 0,
      complete: 0,
      error: 0,
      skipped: 0
    }

    scannedFiles.forEach((file) => {
      const status = getFileTransferStatus(file.path, progress)
      stats[status]++
    })

    return stats
  }, [scannedFiles, progress])

  // Handle select all
  const handleSelectAll = () => {
    const allFolderPaths = getAllFolderPaths(folderGroups)
    selectAllFolders(allFolderPaths)
  }

  // Handle deselect all
  const handleDeselectAll = () => {
    deselectAllFolders()
  }

  // Check if all are selected
  const allSelected = selectionStats.selected === selectionStats.total && selectionStats.total > 0
  const noneSelected = selectionStats.selected === 0

  if (scanInProgress) {
    return (
      <Card className="border-0 bg-white/70 shadow-xl shadow-purple-500/10 backdrop-blur-sm dark:bg-gray-900/70">
        <CardContent
          className={cn(
            'flex flex-col items-center justify-center',
            isCondensed ? 'py-8' : 'py-16'
          )}
        >
          <div className="relative">
            <div
              className={cn(
                'absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600',
                isCondensed && 'border-2'
              )}
            />
            <div className={isCondensed ? 'h-10 w-10' : 'h-16 w-16'} />
          </div>
          <p
            className={cn(
              'font-semibold text-gray-900 dark:text-white',
              isCondensed ? 'mt-4 text-base' : 'mt-6 text-lg'
            )}
          >
            Scanning for Files
          </p>
          {!isCondensed && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This may take a moment...
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (scannedFiles.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-white/50 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/50">
        <CardContent
          className={cn(
            'flex flex-col items-center justify-center',
            isCondensed ? 'py-8' : 'py-16'
          )}
        >
          <div className="relative">
            <div
              className={cn(
                'flex items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
                isCondensed ? 'h-14 w-14' : 'h-20 w-20'
              )}
            >
              <Folder
                className={
                  isCondensed
                    ? 'h-7 w-7 text-purple-600 dark:text-purple-400'
                    : 'h-10 w-10 text-purple-600 dark:text-purple-400'
                }
              />
            </div>
          </div>
          <p
            className={cn(
              'font-bold text-gray-900 dark:text-white',
              isCondensed ? 'mt-4 text-base' : 'mt-6 text-xl'
            )}
          >
            No Files Found
          </p>
          <p
            className={cn(
              'text-center text-gray-600 dark:text-gray-400',
              isCondensed ? 'mt-1 text-xs' : 'mt-2 text-sm'
            )}
          >
            Select a drive to scan for files
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-white/70 shadow-xl shadow-purple-500/10 backdrop-blur-sm dark:bg-gray-900/70">
      <CardHeader className={isCondensed ? 'p-3' : undefined}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30',
                isCondensed ? 'h-6 w-6' : 'h-8 w-8'
              )}
            >
              <FileTypeIcon className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            </div>
            <div>
              <CardTitle className={isCondensed ? 'text-sm' : 'text-lg'}>Transfer Queue</CardTitle>
              <CardDescription className="text-xs">
                {selectionStats.selected} of {selectionStats.total} file
                {selectionStats.total !== 1 ? 's' : ''} selected
              </CardDescription>
            </div>
          </div>

          {/* Transfer Status Statistics */}
          <div className={cn('flex', isCondensed ? 'gap-1' : 'gap-2')}>
            <StatusBadge status="complete" count={transferStats.complete} isCondensed={isCondensed} />
            <StatusBadge
              status="transferring"
              count={transferStats.transferring}
              isCondensed={isCondensed}
            />
            <StatusBadge status="verifying" count={transferStats.verifying} isCondensed={isCondensed} />
            <StatusBadge status="error" count={transferStats.error} isCondensed={isCondensed} />
            <StatusBadge status="pending" count={transferStats.pending} isCondensed={isCondensed} />
          </div>
        </div>

        {/* Selection Controls */}
        <div
          className={cn('mt-3 flex items-center justify-between', isCondensed ? 'gap-2' : 'gap-3')}
        >
          <div className={cn('flex', isCondensed ? 'gap-1' : 'gap-2')}>
            <button
              onClick={handleSelectAll}
              disabled={allSelected || isTransferring}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <CheckSquare className="h-3 w-3" />
              {isCondensed ? 'All' : 'Select All'}
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={noneSelected || isTransferring}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <Square className="h-3 w-3" />
              {isCondensed ? 'None' : 'Deselect All'}
            </button>
          </div>

          {/* Folder count */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {folderGroups.length} folder{folderGroups.length !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>

      <CardContent className={isCondensed ? 'p-3 pt-0' : undefined}>
        <div
          className={cn(
            'overflow-y-auto rounded-lg bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50',
            isCondensed ? 'max-h-[300px] space-y-2 p-2' : 'max-h-[500px] space-y-3 p-3'
          )}
        >
          {folderGroups.map((group) => (
            <FolderSection
              key={group.relativePath}
              group={group}
              isExpanded={fileSelection.expandedFolders.has(group.relativePath)}
              isFolderSelected={fileSelection.selectedFolders.has(group.relativePath)}
              deselectedFiles={fileSelection.deselectedFiles}
              progress={progress}
              isCondensed={isCondensed}
              onToggleExpand={() => toggleFolderExpanded(group.relativePath)}
              onToggleFolderSelect={() => toggleFolderSelection(group.relativePath)}
              onToggleFileSelect={(filePath) => toggleFileSelection(filePath, group.relativePath)}
              selectionDisabled={isTransferring}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
