/**
 * Version comparison utilities
 * Shared between main and renderer processes
 */

/**
 * Version comparison utilities for semantic versioning
 */
export class VersionUtils {
  /**
   * Compare two semantic versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   * Handles full semantic versioning (major.minor.patch[-prerelease])
   */
  static compare(a: string, b: string): number {
    // Remove prerelease suffixes for comparison (e.g., "2.0.1-alpha.2" -> "2.0.1")
    const cleanA = a.split('-')[0]
    const cleanB = b.split('-')[0]

    const aParts = cleanA.split('.').map(Number)
    const bParts = cleanB.split('.').map(Number)

    // Ensure both have at least 3 parts (major.minor.patch)
    while (aParts.length < 3) aParts.push(0)
    while (bParts.length < 3) bParts.push(0)

    for (let i = 0; i < 3; i++) {
      const aPart = aParts[i] || 0
      const bPart = bParts[i] || 0

      if (aPart < bPart) return -1
      if (aPart > bPart) return 1
    }

    return 0
  }

  /**
   * Check if a version is compatible with minimum supported version
   */
  static isCompatible(version: string, minVersion: string): boolean {
    return this.compare(version, minVersion) >= 0
  }

  /**
   * Parse semantic version into parts
   */
  static parse(version: string): {
    major: number
    minor: number
    patch: number
    prerelease?: string
  } {
    const [baseVersion, prerelease] = version.split('-')
    const [major, minor, patch] = baseVersion.split('.').map(Number)

    return {
      major: major || 0,
      minor: minor || 0,
      patch: patch || 0,
      prerelease
    }
  }
}
