/**
 * FileList Component - Visual Transfer Queue with Nested Folder Tree Selection
 * Displays scanned files in a hierarchical folder tree structure with selection support for selective transfers.
 * Files can be selected/deselected individually or by folder (including nested subfolders).
 */

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { FolderSection } from './FolderSection'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { useStore, useFolderTree, useFlatFileListFromTree, useSelectionStats } from '../store'
import { useShallow } from 'zustand/shallow'
import type { FolderTreeNode } from '../utils/fileGrouping'

export function FileList() {
  // Get folder tree instead of flat groups
  const folderTree = useFolderTree()
  const flatFileList = useFlatFileListFromTree()
  const selectionStats = useSelectionStats()

  const {
    scanInProgress,
    fileSelection,
    toggleFolderSelection,
    toggleFileSelection,
    toggleFolderExpanded,
    selectAllFolders,
    deselectAllFolders,
    setLastClickedFile,
    selectFileRange,
    isTransferring
  } = useStore(
    useShallow((state) => ({
      scanInProgress: state.scanInProgress,
      fileSelection: state.fileSelection,
      toggleFolderSelection: state.toggleFolderSelection,
      toggleFileSelection: state.toggleFileSelection,
      toggleFolderExpanded: state.toggleFolderExpanded,
      selectAllFolders: state.selectAllFolders,
      deselectAllFolders: state.deselectAllFolders,
      setLastClickedFile: state.setLastClickedFile,
      selectFileRange: state.selectFileRange,
      isTransferring: state.isTransferring
    }))
  )

  const { progress } = useStore(
    useShallow((state) => ({
      progress: state.progress
    }))
  )

  const { config } = useStore(
    useShallow((state) => ({
      config: state.config
    }))
  )

  const isCondensed = config?.uiDensity === 'condensed'

  // Get all folder paths for select/deselect all (flatten tree)
  const allFolderPaths = useMemo(() => {
    const paths: string[] = []
    function traverse(node: FolderTreeNode): void {
      paths.push(node.relativePath)
      for (const child of node.children) {
        traverse(child)
      }
    }
    for (const root of folderTree) {
      traverse(root)
    }
    return paths
  }, [folderTree])

  // Calculate start indices for each root node
  const rootStartIndices = useMemo(() => {
    const indices: number[] = []
    let currentIndex = 0
    for (const root of folderTree) {
      indices.push(currentIndex)
      const countFiles = (n: FolderTreeNode): number =>
        n.files.length + n.children.reduce((sum, c) => sum + countFiles(c), 0)
      currentIndex += countFiles(root)
    }
    return indices
  }, [folderTree])

  // Handlers
  const handleToggleFolderSelect = (
    relativePath: string,
    node: FolderTreeNode,
    _shiftKey: boolean
  ) => {
    toggleFolderSelection(relativePath, node)
  }

  const handleToggleFileSelect = (
    filePath: string,
    folderPath: string,
    index: number,
    shiftKey: boolean
  ) => {
    if (shiftKey && fileSelection.lastClickedFile) {
      selectFileRange(index, flatFileList)
    } else {
      toggleFileSelection(filePath, folderPath)
      setLastClickedFile(filePath, folderPath, index)
    }
  }

  const handleSelectAll = () => {
    selectAllFolders(allFolderPaths)
  }

  const handleDeselectAll = () => {
    deselectAllFolders()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Files to Transfer</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {selectionStats.selected} of {selectionStats.total} files selected
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={isTransferring}>
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={isTransferring}
            >
              Deselect All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {scanInProgress ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Scanning drive...</span>
          </div>
        ) : folderTree.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No files found. Select a drive to scan.
          </div>
        ) : (
          <div
            className={cn('max-h-[500px] overflow-y-auto', isCondensed ? 'space-y-1' : 'space-y-2')}
          >
            {folderTree.map((rootNode, index) => (
              <FolderSection
                key={rootNode.relativePath}
                node={rootNode}
                isExpanded={fileSelection.expandedFolders.has(rootNode.relativePath)}
                selectedFolders={fileSelection.selectedFolders}
                deselectedFiles={fileSelection.deselectedFiles}
                individuallySelectedFiles={fileSelection.individuallySelectedFiles}
                expandedFolders={fileSelection.expandedFolders}
                progress={progress}
                isCondensed={isCondensed}
                startFileIndex={rootStartIndices[index]}
                depth={0}
                onToggleExpand={toggleFolderExpanded}
                onToggleFolderSelect={handleToggleFolderSelect}
                onToggleFileSelect={handleToggleFileSelect}
                selectionDisabled={isTransferring}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
