# Nested Folder Tree Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform flat folder list into hierarchical tree with nested folders, cascade selection, and tri-state checkboxes.

**Architecture:** Keep existing `scannedFiles` flat array and `FileSelectionState` model. Build tree structure at render time via new `buildFolderTree()` utility. FolderSection becomes recursive component with depth-based indentation. Selection cascades to descendants when toggling parent folders.

**Tech Stack:** React, Zustand, TypeScript

---

## Task 1: Add FolderTreeNode Interface

**Files:**
- Modify: `src/renderer/src/utils/fileGrouping.ts:1-25`

**Step 1: Add the new interface after FolderGroup**

```typescript
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
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (interface has no dependencies yet)

**Step 3: Commit**

```bash
git add src/renderer/src/utils/fileGrouping.ts
git commit -m "feat: add FolderTreeNode interface for nested folder support"
```

---

## Task 2: Write Failing Test for buildFolderTree

**Files:**
- Create: `tests/renderer/utils/fileGrouping.tree.test.ts`

**Step 1: Create the test file with first test**

```typescript
/**
 * Tests for folder tree building functionality
 */
import { buildFolderTree } from '../../../src/renderer/src/utils/fileGrouping'
import type { ScannedFile } from '../../../src/shared/types'

// Helper to create mock ScannedFile
function createFile(path: string, size: number = 1000): ScannedFile {
  return {
    path,
    name: path.split('/').pop() || path,
    size,
    created: new Date(),
    modified: new Date()
  }
}

describe('buildFolderTree', () => {
  const driveRoot = '/Volumes/SD_CARD'

  it('should create flat structure for files in single folder', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/IMG_001.jpg', 1000),
      createFile('/Volumes/SD_CARD/DCIM/IMG_002.jpg', 2000)
    ]

    const tree = buildFolderTree(files, driveRoot)

    expect(tree).toHaveLength(1)
    expect(tree[0].relativePath).toBe('DCIM')
    expect(tree[0].displayName).toBe('DCIM')
    expect(tree[0].files).toHaveLength(2)
    expect(tree[0].children).toHaveLength(0)
    expect(tree[0].depth).toBe(0)
    expect(tree[0].directFileCount).toBe(2)
    expect(tree[0].totalFileCount).toBe(2)
    expect(tree[0].directSize).toBe(3000)
    expect(tree[0].totalSize).toBe(3000)
  })

  it('should create nested structure for deep paths', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg', 1000),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_002.jpg', 2000)
    ]

    const tree = buildFolderTree(files, driveRoot)

    // Should have DCIM at root
    expect(tree).toHaveLength(1)
    expect(tree[0].relativePath).toBe('DCIM')
    expect(tree[0].depth).toBe(0)
    expect(tree[0].files).toHaveLength(0) // No direct files
    expect(tree[0].children).toHaveLength(1)

    // DCIM should have 100CANON as child
    const child = tree[0].children[0]
    expect(child.relativePath).toBe('DCIM/100CANON')
    expect(child.displayName).toBe('100CANON')
    expect(child.depth).toBe(1)
    expect(child.files).toHaveLength(2)
    expect(child.children).toHaveLength(0)

    // Totals should roll up
    expect(tree[0].directFileCount).toBe(0)
    expect(tree[0].totalFileCount).toBe(2)
    expect(tree[0].directSize).toBe(0)
    expect(tree[0].totalSize).toBe(3000)
  })

  it('should create intermediate empty folders', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/A/B/C/file.jpg', 1000)
    ]

    const tree = buildFolderTree(files, driveRoot)

    // A at root
    expect(tree).toHaveLength(1)
    expect(tree[0].relativePath).toBe('A')
    expect(tree[0].files).toHaveLength(0)

    // A/B as child of A
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].relativePath).toBe('A/B')
    expect(tree[0].children[0].files).toHaveLength(0)

    // A/B/C as child of A/B
    expect(tree[0].children[0].children).toHaveLength(1)
    expect(tree[0].children[0].children[0].relativePath).toBe('A/B/C')
    expect(tree[0].children[0].children[0].files).toHaveLength(1)
  })

  it('should handle files in root folder', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/readme.txt', 500)
    ]

    const tree = buildFolderTree(files, driveRoot)

    expect(tree).toHaveLength(1)
    expect(tree[0].relativePath).toBe('/')
    expect(tree[0].displayName).toBe('Root')
    expect(tree[0].files).toHaveLength(1)
  })

  it('should handle mixed depth files', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/IMG_ROOT.jpg', 1000),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg', 2000),
      createFile('/Volumes/SD_CARD/DCIM/200CANON/IMG_002.jpg', 3000)
    ]

    const tree = buildFolderTree(files, driveRoot)

    expect(tree).toHaveLength(1)
    const dcim = tree[0]
    expect(dcim.relativePath).toBe('DCIM')
    expect(dcim.files).toHaveLength(1) // IMG_ROOT.jpg
    expect(dcim.children).toHaveLength(2) // 100CANON, 200CANON
    expect(dcim.directFileCount).toBe(1)
    expect(dcim.totalFileCount).toBe(3)
    expect(dcim.totalSize).toBe(6000)
  })

  it('should sort children alphabetically', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/ZZZ/file.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/AAA/file.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/MMM/file.jpg')
    ]

    const tree = buildFolderTree(files, driveRoot)

    expect(tree[0].children[0].displayName).toBe('AAA')
    expect(tree[0].children[1].displayName).toBe('MMM')
    expect(tree[0].children[2].displayName).toBe('ZZZ')
  })

  it('should sort root level alphabetically with Root first', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/root.txt'),
      createFile('/Volumes/SD_CARD/ZFolder/file.jpg'),
      createFile('/Volumes/SD_CARD/AFolder/file.jpg')
    ]

    const tree = buildFolderTree(files, driveRoot)

    expect(tree[0].relativePath).toBe('/')
    expect(tree[1].displayName).toBe('AFolder')
    expect(tree[2].displayName).toBe('ZFolder')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderer/utils/fileGrouping.tree.test.ts`
Expected: FAIL with "buildFolderTree is not exported" or similar

---

## Task 3: Implement buildFolderTree Function

**Files:**
- Modify: `src/renderer/src/utils/fileGrouping.ts`

**Step 1: Add the buildFolderTree function**

Add after `getAllFolderPaths` function:

```typescript
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
      const displayName = relativePath === '/' ? 'Root' : relativePath.split(/[/\\]/).pop() || relativePath
      node = {
        relativePath,
        displayName,
        absolutePath,
        files: [],
        children: [],
        depth: relativePath === '/' ? 0 : relativePath.split(/[/\\]/).length,
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
      const prevPath = currentPath
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
    const absoluteFolderPath = lastSeparator > 0 ? file.path.substring(0, lastSeparator) : normalizedRoot

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
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- tests/renderer/utils/fileGrouping.tree.test.ts`
Expected: PASS (all 7 tests)

**Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (no regressions)

**Step 4: Commit**

```bash
git add src/renderer/src/utils/fileGrouping.ts tests/renderer/utils/fileGrouping.tree.test.ts
git commit -m "feat: implement buildFolderTree for nested folder hierarchy"
```

---

## Task 4: Write Tests for Tree Selection Utilities

**Files:**
- Modify: `tests/renderer/utils/fileGrouping.tree.test.ts`

**Step 1: Add tests for getTreeNodeSelectionState**

Append to the test file:

```typescript
import {
  buildFolderTree,
  getTreeNodeSelectionState,
  getDescendantFolderPaths,
  getAllFilesInSubtree
} from '../../../src/renderer/src/utils/fileGrouping'

describe('getTreeNodeSelectionState', () => {
  const driveRoot = '/Volumes/SD_CARD'

  it('should return fully selected when folder and all descendants selected', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_002.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)
    const selectedFolders = new Set(['DCIM', 'DCIM/100CANON'])
    const deselectedFiles = new Set<string>()
    const individuallySelectedFiles = new Set<string>()

    const state = getTreeNodeSelectionState(
      tree[0], // DCIM
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )

    expect(state.isFullySelected).toBe(true)
    expect(state.isPartiallySelected).toBe(false)
    expect(state.selectedCount).toBe(2)
    expect(state.totalCount).toBe(2)
  })

  it('should return partial when some descendants deselected', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_002.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)
    const selectedFolders = new Set(['DCIM', 'DCIM/100CANON'])
    const deselectedFiles = new Set(['/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg'])
    const individuallySelectedFiles = new Set<string>()

    const state = getTreeNodeSelectionState(
      tree[0], // DCIM
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )

    expect(state.isFullySelected).toBe(false)
    expect(state.isPartiallySelected).toBe(true)
    expect(state.selectedCount).toBe(1)
    expect(state.totalCount).toBe(2)
  })

  it('should return partial when child folder not selected', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/200CANON/IMG_002.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)
    const selectedFolders = new Set(['DCIM', 'DCIM/100CANON']) // 200CANON not selected
    const deselectedFiles = new Set<string>()
    const individuallySelectedFiles = new Set<string>()

    const state = getTreeNodeSelectionState(
      tree[0], // DCIM
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )

    expect(state.isFullySelected).toBe(false)
    expect(state.isPartiallySelected).toBe(true)
    expect(state.selectedCount).toBe(1)
    expect(state.totalCount).toBe(2)
  })

  it('should return unselected when folder not selected and no individual files', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/IMG_001.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)
    const selectedFolders = new Set<string>()
    const deselectedFiles = new Set<string>()
    const individuallySelectedFiles = new Set<string>()

    const state = getTreeNodeSelectionState(
      tree[0],
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )

    expect(state.isFullySelected).toBe(false)
    expect(state.isPartiallySelected).toBe(false)
    expect(state.selectedCount).toBe(0)
    expect(state.totalCount).toBe(1)
  })

  it('should handle individually selected files in unselected folder', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/IMG_001.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/IMG_002.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)
    const selectedFolders = new Set<string>()
    const deselectedFiles = new Set<string>()
    const individuallySelectedFiles = new Set(['/Volumes/SD_CARD/DCIM/IMG_001.jpg'])

    const state = getTreeNodeSelectionState(
      tree[0],
      selectedFolders,
      deselectedFiles,
      individuallySelectedFiles
    )

    expect(state.isFullySelected).toBe(false)
    expect(state.isPartiallySelected).toBe(true)
    expect(state.selectedCount).toBe(1)
    expect(state.totalCount).toBe(2)
  })
})

describe('getDescendantFolderPaths', () => {
  const driveRoot = '/Volumes/SD_CARD'

  it('should return all nested folder paths including self', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/100CANON/RAW/file.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/200CANON/file.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)

    const paths = getDescendantFolderPaths(tree[0]) // DCIM

    expect(paths).toContain('DCIM')
    expect(paths).toContain('DCIM/100CANON')
    expect(paths).toContain('DCIM/100CANON/RAW')
    expect(paths).toContain('DCIM/200CANON')
    expect(paths).toHaveLength(4)
  })

  it('should return only self for leaf folder', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/file.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)

    const paths = getDescendantFolderPaths(tree[0])

    expect(paths).toEqual(['DCIM'])
  })
})

describe('getAllFilesInSubtree', () => {
  const driveRoot = '/Volumes/SD_CARD'

  it('should return all files in node and descendants', () => {
    const files: ScannedFile[] = [
      createFile('/Volumes/SD_CARD/DCIM/root.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg'),
      createFile('/Volumes/SD_CARD/DCIM/100CANON/IMG_002.jpg')
    ]
    const tree = buildFolderTree(files, driveRoot)

    const filePaths = getAllFilesInSubtree(tree[0]) // DCIM

    expect(filePaths).toHaveLength(3)
    expect(filePaths).toContain('/Volumes/SD_CARD/DCIM/root.jpg')
    expect(filePaths).toContain('/Volumes/SD_CARD/DCIM/100CANON/IMG_001.jpg')
    expect(filePaths).toContain('/Volumes/SD_CARD/DCIM/100CANON/IMG_002.jpg')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/renderer/utils/fileGrouping.tree.test.ts`
Expected: FAIL with "getTreeNodeSelectionState is not exported"

---

## Task 5: Implement Tree Selection Utilities

**Files:**
- Modify: `src/renderer/src/utils/fileGrouping.ts`

**Step 1: Add TreeNodeSelectionState interface**

Add after FolderTreeNode interface:

```typescript
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
```

**Step 2: Add getTreeNodeSelectionState function**

Add after buildFolderTree:

```typescript
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
```

**Step 3: Add getDescendantFolderPaths function**

```typescript
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
```

**Step 4: Add getAllFilesInSubtree function**

```typescript
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
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/renderer/utils/fileGrouping.tree.test.ts`
Expected: PASS (all tests)

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/renderer/src/utils/fileGrouping.ts tests/renderer/utils/fileGrouping.tree.test.ts
git commit -m "feat: add tree selection utilities for cascade behavior"
```

---

## Task 6: Add useFolderTree Hook

**Files:**
- Modify: `src/renderer/src/store/index.ts:18-24` (imports)
- Modify: `src/renderer/src/store/index.ts:202-217` (after useFileGroups)

**Step 1: Update imports**

Change the import block to include new exports:

```typescript
import {
  groupFilesByFolder,
  buildFolderTree,
  getSelectedFilePaths,
  getSelectionStats,
  getAllFolderPaths,
  type FolderGroup,
  type FolderTreeNode
} from '../utils/fileGrouping'
```

**Step 2: Add useFolderTree hook after useFileGroups**

```typescript
/**
 * Hook to get folder tree structure for hierarchical display.
 * Memoized based on scanned files and drive root.
 */
export function useFolderTree(): FolderTreeNode[] {
  const { scannedFiles, selectedDrive } = useStore(
    useShallow((state) => ({
      scannedFiles: state.scannedFiles,
      selectedDrive: state.selectedDrive
    }))
  )

  return useMemo(() => {
    if (!selectedDrive || scannedFiles.length === 0) {
      return []
    }
    const driveRoot = selectedDrive.mountpoints[0] || ''
    return buildFolderTree(scannedFiles, driveRoot)
  }, [scannedFiles, selectedDrive])
}
```

**Step 3: Add re-export for FolderTreeNode at the end**

```typescript
// Re-export FolderGroup and FolderTreeNode types for convenience
export type { FolderGroup, FolderTreeNode }
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/store/index.ts
git commit -m "feat: add useFolderTree hook for hierarchical folder display"
```

---

## Task 7: Add useFlatFileListFromTree Hook

**Files:**
- Modify: `src/renderer/src/store/index.ts`

**Step 1: Add the hook after useFolderTree**

```typescript
/**
 * Hook to get flat file list in DFS tree traversal order.
 * Used for shift-click range selection across nested structure.
 */
export function useFlatFileListFromTree(): Array<{
  path: string
  folderPath: string
  index: number
}> {
  const folderTree = useFolderTree()

  return useMemo(() => {
    const list: Array<{ path: string; folderPath: string; index: number }> = []

    function traverse(node: FolderTreeNode): void {
      // Add files in this node first
      for (const file of node.files) {
        list.push({
          path: file.path,
          folderPath: node.relativePath,
          index: list.length
        })
      }
      // Then traverse children in order
      for (const child of node.children) {
        traverse(child)
      }
    }

    for (const root of folderTree) {
      traverse(root)
    }

    return list
  }, [folderTree])
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/store/index.ts
git commit -m "feat: add useFlatFileListFromTree hook for shift-click in tree"
```

---

## Task 8: Update toggleFolderSelection for Cascade

**Files:**
- Modify: `src/renderer/src/store/slices/driveSlice.ts:10-11` (imports)
- Modify: `src/renderer/src/store/slices/driveSlice.ts:37-39` (interface)
- Modify: `src/renderer/src/store/slices/driveSlice.ts:173-230` (implementation)

**Step 1: Update imports**

```typescript
import {
  groupFilesByFolder,
  getAllFolderPaths,
  getDescendantFolderPaths,
  getAllFilesInSubtree
} from '../../utils/fileGrouping'
import type { FolderTreeNode } from '../../utils/fileGrouping'
```

**Step 2: Update interface signature**

Change `toggleFolderSelection` in the interface:

```typescript
/** Toggle selection state for a folder (with optional tree node for cascade) */
toggleFolderSelection: (relativePath: string, treeNode?: FolderTreeNode) => void
```

**Step 3: Update the implementation**

Replace the `toggleFolderSelection` action:

```typescript
toggleFolderSelection: (relativePath, treeNode) =>
  set((state) => {
    const newSelectedFolders = new Set(state.fileSelection.selectedFolders)
    const newDeselectedFiles = new Set(state.fileSelection.deselectedFiles)
    const newIndividuallySelectedFiles = new Set(state.fileSelection.individuallySelectedFiles)

    const isCurrentlySelected = newSelectedFolders.has(relativePath)

    if (treeNode) {
      // Cascade mode: affect this folder and all descendants
      const descendantPaths = getDescendantFolderPaths(treeNode)
      const subtreeFiles = getAllFilesInSubtree(treeNode)

      if (isCurrentlySelected) {
        // Deselect folder and all descendants
        for (const path of descendantPaths) {
          newSelectedFolders.delete(path)
        }
        // Clear any file-level overrides in subtree
        for (const filePath of subtreeFiles) {
          newDeselectedFiles.delete(filePath)
          newIndividuallySelectedFiles.delete(filePath)
        }
      } else {
        // Select folder and all descendants
        for (const path of descendantPaths) {
          newSelectedFolders.add(path)
        }
        // Clear any file-level overrides in subtree
        for (const filePath of subtreeFiles) {
          newDeselectedFiles.delete(filePath)
          newIndividuallySelectedFiles.delete(filePath)
        }
      }
    } else {
      // Non-cascade mode (backward compatibility)
      if (isCurrentlySelected) {
        newSelectedFolders.delete(relativePath)
      } else {
        newSelectedFolders.add(relativePath)

        // Clear file overrides for this folder only
        if (state.selectedDrive && state.scannedFiles.length > 0) {
          const driveRoot = state.selectedDrive.mountpoints[0] || ''
          const normalizedRoot = driveRoot.replace(/[/\\]+$/, '')

          const getFileRelativePath = (filePath: string): string => {
            const lastSeparator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
            const absoluteFolderPath =
              lastSeparator > 0 ? filePath.substring(0, lastSeparator) : normalizedRoot
            let fileRelativePath = absoluteFolderPath
            if (absoluteFolderPath.startsWith(normalizedRoot)) {
              fileRelativePath = absoluteFolderPath.substring(normalizedRoot.length)
              fileRelativePath = fileRelativePath.replace(/^[/\\]+/, '')
            }
            return fileRelativePath || '/'
          }

          for (const filePath of newDeselectedFiles) {
            if (getFileRelativePath(filePath) === relativePath) {
              newDeselectedFiles.delete(filePath)
            }
          }

          for (const filePath of newIndividuallySelectedFiles) {
            if (getFileRelativePath(filePath) === relativePath) {
              newIndividuallySelectedFiles.delete(filePath)
            }
          }
        }
      }
    }

    return {
      fileSelection: {
        ...state.fileSelection,
        selectedFolders: newSelectedFolders,
        deselectedFiles: newDeselectedFiles,
        individuallySelectedFiles: newIndividuallySelectedFiles
      }
    }
  }),
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/src/store/slices/driveSlice.ts
git commit -m "feat: add cascade selection support to toggleFolderSelection"
```

---

## Task 9: Update setScannedFilesWithSelection for Default Expand

**Files:**
- Modify: `src/renderer/src/store/slices/driveSlice.ts:114-130`

**Step 1: Update the action to expand top-level folders**

Replace `setScannedFilesWithSelection`:

```typescript
setScannedFilesWithSelection: (files, driveRoot) =>
  set(() => {
    // Group files by folder and select all folders by default
    const groups = groupFilesByFolder(files, driveRoot)
    const allFolderPaths = getAllFolderPaths(groups)

    // Build tree to get top-level folder paths for default expansion
    const tree = buildFolderTree(files, driveRoot)
    const topLevelPaths = tree.map((node) => node.relativePath)

    return {
      scannedFiles: files,
      fileSelection: {
        selectedFolders: new Set(allFolderPaths),
        deselectedFiles: new Set(),
        individuallySelectedFiles: new Set(),
        expandedFolders: new Set(topLevelPaths), // Expand only top-level
        lastClickedFile: null
      }
    }
  }),
```

**Step 2: Update import to include buildFolderTree**

```typescript
import {
  groupFilesByFolder,
  buildFolderTree,
  getAllFolderPaths,
  getDescendantFolderPaths,
  getAllFilesInSubtree
} from '../../utils/fileGrouping'
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/store/slices/driveSlice.ts
git commit -m "feat: expand only top-level folders by default after scan"
```

---

## Task 10: Refactor FolderSection to Accept FolderTreeNode

**Files:**
- Modify: `src/renderer/src/components/FolderSection.tsx`

**Step 1: Update imports**

```typescript
import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '../lib/utils'
import { FileItem } from './FileItem'
import { getTreeNodeSelectionState } from '../utils/fileGrouping'
import type { FolderTreeNode } from '../utils/fileGrouping'
import type { TransferProgress } from '../../../shared/types'
```

**Step 2: Update interface**

```typescript
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
  onToggleFileSelect: (filePath: string, folderPath: string, index: number, shiftKey: boolean) => void
  /** Whether selection is disabled (e.g., during transfer) */
  selectionDisabled?: boolean
}
```

**Step 3: Update component implementation**

```typescript
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
          <div className="w-5" /> // Spacer for alignment
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
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL (FileList still passes old props) - this is expected, we'll fix in next task

**Step 5: Commit (partial - component ready)**

```bash
git add src/renderer/src/components/FolderSection.tsx
git commit -m "refactor: update FolderSection for recursive tree rendering"
```

---

## Task 11: Update FileList to Use Tree Structure

**Files:**
- Modify: `src/renderer/src/components/FileList.tsx`

**Step 1: Update imports**

```typescript
import { useMemo } from 'react'
import { FolderSection } from './FolderSection'
import { useStore, useFolderTree, useFlatFileListFromTree, useSelectionStats } from '../store'
import { useShallow } from 'zustand/shallow'
import type { FolderTreeNode } from '../utils/fileGrouping'
```

**Step 2: Update the component to use tree hooks**

Replace the hooks section with:

```typescript
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
    shiftKey: boolean
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

  // ... rest of component (loading states, empty states, render)
```

**Step 3: Update the render section**

```typescript
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Files to Transfer</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {selectionStats.selected} of {selectionStats.total} files selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={isTransferring}
            >
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
          <div className={cn('max-h-[500px] overflow-y-auto', isCondensed ? 'space-y-1' : 'space-y-2')}>
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
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/src/components/FileList.tsx
git commit -m "feat: update FileList to render nested folder tree"
```

---

## Task 12: Manual Testing

**Step 1: Start development server**

Run: `npm run dev`
Expected: App launches without errors

**Step 2: Test with nested folder structure**

1. Insert a drive with nested folders (or use a test folder)
2. Verify tree displays with proper indentation
3. Verify top-level folders are expanded, nested are collapsed
4. Click chevron to expand/collapse nested folders

**Step 3: Test cascade selection**

1. Select a parent folder checkbox
2. Verify all child folders become selected (check in nested folders)
3. Deselect a child file
4. Verify parent shows indeterminate state (partial checkbox)
5. Deselect parent folder
6. Verify all descendants become deselected

**Step 4: Test shift-click**

1. Click a file to select it
2. Shift-click another file (even in different nested folder)
3. Verify range selection works across nested structure

**Step 5: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 6: Final commit**

```bash
git add -A
git commit -m "test: verify nested folder tree functionality"
```

---

## Summary

This plan implements nested folder tree support in 12 tasks:

1. Add `FolderTreeNode` interface
2. Write failing tests for `buildFolderTree`
3. Implement `buildFolderTree`
4. Write tests for tree selection utilities
5. Implement tree selection utilities
6. Add `useFolderTree` hook
7. Add `useFlatFileListFromTree` hook
8. Update `toggleFolderSelection` for cascade
9. Update default expand state
10. Refactor `FolderSection` for recursion
11. Update `FileList` for tree rendering
12. Manual testing

Each task is a small, atomic change that can be committed independently.
