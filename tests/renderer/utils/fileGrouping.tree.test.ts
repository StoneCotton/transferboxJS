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
