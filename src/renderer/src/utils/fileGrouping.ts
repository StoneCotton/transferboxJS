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
    const absoluteFolderPath = lastSeparator > 0 ? file.path.substring(0, lastSeparator) : normalizedRoot

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
