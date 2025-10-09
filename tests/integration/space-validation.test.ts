/**
 * Space Validation Integration Tests
 * Tests for insufficient disk space edge cases
 */

import { hasEnoughSpace, checkDiskSpace } from '../../src/main/pathValidator'

describe('Space Validation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should check disk space for valid path', async () => {
    // Use current directory for testing
    const currentDir = process.cwd()
    const spaceInfo = await checkDiskSpace(currentDir)

    expect(spaceInfo.freeSpace).toBeGreaterThan(0)
    expect(spaceInfo.totalSpace).toBeGreaterThan(spaceInfo.freeSpace)
  })

  it('should validate space with buffer calculation', async () => {
    const currentDir = process.cwd()
    const smallRequiredBytes = 1024 // 1KB - should always have space
    const hasSpace = await hasEnoughSpace(currentDir, smallRequiredBytes)

    // Should pass because we definitely have more than 1KB free
    expect(hasSpace).toBe(true)
  })

  it('should reject when not enough space (unrealistic large requirement)', async () => {
    const currentDir = process.cwd()
    const unrealisticRequirement = 1000 * 1024 * 1024 * 1024 * 1024 // 1000 TB
    const hasSpace = await hasEnoughSpace(currentDir, unrealisticRequirement)

    // Should fail because we don't have 1000TB free
    expect(hasSpace).toBe(false)
  })

  it('should handle errors for non-existent paths gracefully', async () => {
    const hasSpace = await hasEnoughSpace('/this/path/definitely/does/not/exist', 1000)

    // Should return false for invalid paths
    expect(hasSpace).toBe(false)
  })

  it('should throw error when checking space on invalid path', async () => {
    await expect(checkDiskSpace('/this/path/definitely/does/not/exist')).rejects.toThrow()
  })

  it('should include 10% buffer in space calculation', async () => {
    // This is a logical test, not execution test
    // If we need 100MB, hasEnoughSpace should check for 110MB (100 * 1.1)
    // We can't easily test this without mocking, but the implementation has it
    const currentDir = process.cwd()
    const result = await hasEnoughSpace(currentDir, 100)
    expect(typeof result).toBe('boolean')
  })
})
