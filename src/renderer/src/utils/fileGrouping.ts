/**
 * File Grouping Utility
 * Groups scanned files by their parent folder for hierarchical display in the UI.
 * Used by FileList component to show files organized by folder with selection support.
 */

import type { ScannedFile } from '../../../shared/types'

/**
 * Represents a folder containing files for the grouped file view
 */
export interface FolderGroup {
  /** Relative folder path from drive root (e.g., "DCIM/100CANON") */
  relativePath: string
  /** Display name for the folder (last path segment, e.g., "100CANON") */
  displayName: string
  /** Full absolute path to the folder */
  absolutePath: string
  /** Files in this folder (direct children only) */
  files: ScannedFile[]
  /** Total size of all files in this folder in bytes */
  totalSize: number
  /** Number of files in this folder */
  fileCount: number
}

/**
 * Represents a node in the folder tree structure.
 * Can contain both direct files and nested subfolders.
 */
export interface FolderTreeNode {
  /** Relative folder path from drive root (e.g., "DCIM/100CANON") */
  relativePath: string
  /** Display name (last path segment, e.g., "100CANON") */
  displayName: string
  /** Full absolute path to the folder */
  absolutePath: string
  /** Files directly in this folder (not in subfolders) */
  files: ScannedFile[]
  /** Nested subfolders */
  children: FolderTreeNode[]
  /** Nesting depth (0 = root level) */
  depth: number
  /** Number of files directly in this folder */
  directFileCount: number
  /** Total files including all descendants */
  totalFileCount: number
  /** Size of files directly in this folder */
  directSize: number
  /** Total size including all descendants */
  totalSize: number
}

/**
 * Selection state for a tree node including cascade information.
 * Used for tri-state checkbox rendering.
 */
export interface TreeNodeSelectionState {
  /** All files in this node and descendants are selected */
  isFullySelected: boolean
  /** Some but not all files are selected */
  isPartiallySelected: boolean
  /** Count of selected files (this node + descendants) */
  selectedCount: number
  /** Total file count (this node + descendants) */
  totalCount: number
}

/**
 * Groups scanned files by their parent folder
 *
 * @param files - Array of scanned files with absolute paths
 * @param driveRoot - The mount point of the drive (e.g., "/Volumes/SD_CARD")
 * @returns Array of folder groups sorted alphabetically by relative path (root first)
 */
export function groupFilesByFolder(files: ScannedFile[], driveRoot: string): FolderGroup[] {
  const folderMap = new Map<string, FolderGroup>()

  // Normalize drive root (remove trailing slash)
  const normalizedRoot = driveRoot.replace(/[/\\]+$/, '')

  for (const file of files) {
    // Extract the directory portion of the file path
    const lastSeparator = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'))
    const absoluteFolderPath =
      lastSeparator > 0 ? file.path.substring(0, lastSeparator) : normalizedRoot

    // Calculate relative path from drive root
    let relativePath = absoluteFolderPath
    if (absoluteFolderPath.startsWith(normalizedRoot)) {
      relativePath = absoluteFolderPath.substring(normalizedRoot.length)
      // Remove leading separator
      relativePath = relativePath.replace(/^[/\\]+/, '')
    }

    // Handle root folder case
    if (!relativePath) {
      relativePath = '/'
    }

    // Get or create folder group
    let group = folderMap.get(relativePath)
    if (!group) {
      const displayName =
        relativePath === '/' ? 'Root' : relativePath.split(/[/\\]/).pop() || relativePath

      group = {
        relativePath,
        displayName,
        absolutePath: absoluteFolderPath,
        files: [],
        totalSize: 0,
        fileCount: 0
      }
      folderMap.set(relativePath, group)
    }

    group.files.push(file)
    group.totalSize += file.size
    group.fileCount++
  }

  // Convert to array and sort by path (alphabetically, root first)
  return Array.from(folderMap.values()).sort((a, b) => {
    if (a.relativePath === '/') return -1
    if (b.relativePath === '/') return 1
    return a.relativePath.localeCompare(b.relativePath)
  })
}

/**
 * Computes which file paths are selected based on folder and file selections.
 * A file is selected if:
 * - Its folder is in selectedFolders AND it is not in deselectedFiles, OR
 * - Its folder is NOT in selectedFolders AND it is in individuallySelectedFiles
 *
 * @param groups - All folder groups from groupFilesByFolder
 * @param selectedFolders - Set of relative folder paths that are selected
 * @param deselectedFiles - Set of absolute file paths that are individually deselected
 * @param individuallySelectedFiles - Set of absolute file paths selected when folder is not selected
 * @returns Array of selected file absolute paths
 */
export function getSelectedFilePaths(
  groups: FolderGroup[],
  selectedFolders: Set<string>,
  deselectedFiles: Set<string>,
  individuallySelectedFiles: Set<string>
): string[] {
  const selectedPaths: string[] = []

  for (const group of groups) {
    if (selectedFolders.has(group.relativePath)) {
      // Folder is selected: include all except deselected
      for (const file of group.files) {
        if (!deselectedFiles.has(file.path)) {
          selectedPaths.push(file.path)
        }
      }
    } else {
      // Folder is NOT selected: include only individually selected
      for (const file of group.files) {
        if (individuallySelectedFiles.has(file.path)) {
          selectedPaths.push(file.path)
        }
      }
    }
  }

  return selectedPaths
}

/**
 * Computes selection statistics for display in the UI
 *
 * @param groups - All folder groups
 * @param selectedFolders - Set of selected folder relative paths
 * @param deselectedFiles - Set of deselected file absolute paths
 * @param individuallySelectedFiles - Set of individually selected file absolute paths
 * @returns Object with selected and total file counts
 */
export function getSelectionStats(
  groups: FolderGroup[],
  selectedFolders: Set<string>,
  deselectedFiles: Set<string>,
  individuallySelectedFiles: Set<string>
): { selected: number; total: number; totalSize: number; selectedSize: number } {
  let total = 0
  let selected = 0
  let totalSize = 0
  let selectedSize = 0

  for (const group of groups) {
    const folderIsSelected = selectedFolders.has(group.relativePath)

    for (const file of group.files) {
      total++
      totalSize += file.size

      // File is selected if:
      // - Folder is selected AND file is not deselected, OR
      // - Folder is not selected AND file is individually selected
      const isSelected = folderIsSelected
        ? !deselectedFiles.has(file.path)
        : individuallySelectedFiles.has(file.path)

      if (isSelected) {
        selected++
        selectedSize += file.size
      }
    }
  }

  return { selected, total, totalSize, selectedSize }
}

/**
 * Computes selection state for a specific folder
 *
 * @param group - The folder group to check
 * @param isSelected - Whether the folder is in selectedFolders
 * @param deselectedFiles - Set of deselected file paths
 * @param individuallySelectedFiles - Set of individually selected file paths
 * @returns Object with selection state info
 */
export function getFolderSelectionState(
  group: FolderGroup,
  isSelected: boolean,
  deselectedFiles: Set<string>,
  individuallySelectedFiles: Set<string>
): {
  isFullySelected: boolean
  isPartiallySelected: boolean
  selectedCount: number
  totalCount: number
} {
  if (!isSelected) {
    // Folder not selected: check for individually selected files
    const individuallySelectedInFolder = group.files.filter((f) =>
      individuallySelectedFiles.has(f.path)
    ).length

    return {
      isFullySelected: false,
      isPartiallySelected: individuallySelectedInFolder > 0, // Show indeterminate if some files selected
      selectedCount: individuallySelectedInFolder,
      totalCount: group.fileCount
    }
  }

  // Folder is selected: check for deselected files
  const deselectedInFolder = group.files.filter((f) => deselectedFiles.has(f.path)).length
  const selectedCount = group.fileCount - deselectedInFolder

  return {
    isFullySelected: selectedCount === group.fileCount,
    isPartiallySelected: selectedCount > 0 && selectedCount < group.fileCount,
    selectedCount,
    totalCount: group.fileCount
  }
}

/**
 * Gets all folder relative paths from the groups (useful for select all)
 *
 * @param groups - Array of folder groups
 * @returns Array of relative folder paths
 */
export function getAllFolderPaths(groups: FolderGroup[]): string[] {
  return groups.map((g) => g.relativePath)
}

/**
 * Builds a hierarchical folder tree from a flat list of scanned files.
 * Creates intermediate empty folders that exist only as containers.
 *
 * @param files - Array of scanned files with absolute paths
 * @param driveRoot - The mount point of the drive (e.g., "/Volumes/SD_CARD")
 * @returns Array of root-level FolderTreeNode (top-level folders)
 */
export function buildFolderTree(files: ScannedFile[], driveRoot: string): FolderTreeNode[] {
  const normalizedRoot = driveRoot.replace(/[/\\]+$/, '')
  const nodeMap = new Map<string, FolderTreeNode>()

  // Helper to get or create a node
  function getOrCreateNode(relativePath: string, absolutePath: string): FolderTreeNode {
    let node = nodeMap.get(relativePath)
    if (!node) {
      const displayName =
        relativePath === '/' ? 'Root' : relativePath.split(/[/\\]/).pop() || relativePath
      node = {
        relativePath,
        displayName,
        absolutePath,
        files: [],
        children: [],
        depth: relativePath === '/' ? 0 : relativePath.split(/[/\\]/).length - 1,
        directFileCount: 0,
        totalFileCount: 0,
        directSize: 0,
        totalSize: 0
      }
      nodeMap.set(relativePath, node)
    }
    return node
  }

  // Helper to ensure all ancestor folders exist
  function ensureAncestors(relativePath: string): void {
    if (relativePath === '/' || relativePath === '') return

    const segments = relativePath.split(/[/\\]/)
    let currentPath = ''
    let currentAbsPath = normalizedRoot

    for (let i = 0; i < segments.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${segments[i]}` : segments[i]
      currentAbsPath = `${currentAbsPath}/${segments[i]}`

      const node = getOrCreateNode(currentPath, currentAbsPath)
      // Adjust depth for intermediate nodes
      node.depth = i
    }
  }

  // Process each file
  for (const file of files) {
    const lastSeparator = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'))
    const absoluteFolderPath =
      lastSeparator > 0 ? file.path.substring(0, lastSeparator) : normalizedRoot

    let relativePath = absoluteFolderPath
    if (absoluteFolderPath.startsWith(normalizedRoot)) {
      relativePath = absoluteFolderPath.substring(normalizedRoot.length)
      relativePath = relativePath.replace(/^[/\\]+/, '')
    }
    if (!relativePath) {
      relativePath = '/'
    }

    // Ensure all ancestor folders exist
    ensureAncestors(relativePath)

    // Add file to its folder
    const node = getOrCreateNode(relativePath, absoluteFolderPath)
    node.files.push(file)
    node.directFileCount++
    node.directSize += file.size
  }

  // Build parent-child relationships
  for (const node of nodeMap.values()) {
    if (node.relativePath === '/' || node.relativePath === '') continue

    const lastSlash = node.relativePath.lastIndexOf('/')
    const parentPath = lastSlash > 0 ? node.relativePath.substring(0, lastSlash) : ''

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children.push(node)
    }
  }

  // Sort children alphabetically at each level
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  // Calculate recursive totals (post-order traversal)
  function calculateTotals(node: FolderTreeNode): { fileCount: number; size: number } {
    let totalFileCount = node.directFileCount
    let totalSize = node.directSize

    for (const child of node.children) {
      const childTotals = calculateTotals(child)
      totalFileCount += childTotals.fileCount
      totalSize += childTotals.size
    }

    node.totalFileCount = totalFileCount
    node.totalSize = totalSize

    return { fileCount: totalFileCount, size: totalSize }
  }

  // Get root-level nodes (no parent or parent is empty string)
  const rootNodes: FolderTreeNode[] = []
  for (const node of nodeMap.values()) {
    const lastSlash = node.relativePath.lastIndexOf('/')
    const parentPath = lastSlash > 0 ? node.relativePath.substring(0, lastSlash) : ''

    // Root level if: is "/" OR has no parent in the map
    if (node.relativePath === '/' || (!parentPath && node.relativePath !== '/')) {
      rootNodes.push(node)
    }
  }

  // Calculate totals for all root nodes
  for (const root of rootNodes) {
    calculateTotals(root)
  }

  // Sort root nodes: "/" first, then alphabetically
  rootNodes.sort((a, b) => {
    if (a.relativePath === '/') return -1
    if (b.relativePath === '/') return 1
    return a.displayName.localeCompare(b.displayName)
  })

  return rootNodes
}

/**
 * Computes the selection state for a tree node considering cascade behavior.
 * Recursively checks all descendants to determine tri-state checkbox state.
 *
 * @param node - The folder tree node
 * @param selectedFolders - Set of selected folder relative paths
 * @param deselectedFiles - Set of deselected file absolute paths
 * @param individuallySelectedFiles - Set of individually selected file paths
 * @returns TreeNodeSelectionState for checkbox rendering
 */
export function getTreeNodeSelectionState(
  node: FolderTreeNode,
  selectedFolders: Set<string>,
  deselectedFiles: Set<string>,
  individuallySelectedFiles: Set<string>
): TreeNodeSelectionState {
  let selectedCount = 0
  let totalCount = 0

  // Count files in this node
  const folderIsSelected = selectedFolders.has(node.relativePath)
  for (const file of node.files) {
    totalCount++
    const isSelected = folderIsSelected
      ? !deselectedFiles.has(file.path)
      : individuallySelectedFiles.has(file.path)
    if (isSelected) {
      selectedCount++
    }
  }

  // Recursively count children
  for (const child of node.children) {
    const childState = getTreeNodeSelectionState(
      child,
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )
    selectedCount += childState.selectedCount
    totalCount += childState.totalCount
  }

  return {
    isFullySelected: totalCount > 0 && selectedCount === totalCount,
    isPartiallySelected: selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
    totalCount
  }
}

/**
 * Gets all descendant folder paths for cascade selection.
 * Includes the node itself.
 *
 * @param node - The starting folder node
 * @returns Array of all descendant relative paths (including the node itself)
 */
export function getDescendantFolderPaths(node: FolderTreeNode): string[] {
  const paths: string[] = [node.relativePath]

  for (const child of node.children) {
    paths.push(...getDescendantFolderPaths(child))
  }

  return paths
}

/**
 * Gets all file paths within a node and all its descendants.
 *
 * @param node - The folder tree node
 * @returns Array of absolute file paths
 */
export function getAllFilesInSubtree(node: FolderTreeNode): string[] {
  const paths: string[] = node.files.map((f) => f.path)

  for (const child of node.children) {
    paths.push(...getAllFilesInSubtree(child))
  }

  return paths
}
