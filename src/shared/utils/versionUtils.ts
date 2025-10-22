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
   *
   * According to semver spec:
   * - Prerelease versions have LOWER precedence than normal versions
   * - Example: 1.0.0-alpha < 1.0.0
   * - When comparing two prerelease versions, compare identifiers lexicographically
   */
  static compare(a: string, b: string): number {
    // Handle empty strings
    if (!a && !b) return 0
    if (!a) return -1
    if (!b) return 1

    // Split version and prerelease on first hyphen only
    // This preserves hyphens within prerelease (e.g., "1.0.0-beta-1" -> base: "1.0.0", prerelease: "beta-1")
    const hyphenIndexA = a.indexOf('-')
    const hyphenIndexB = b.indexOf('-')

    const baseA = hyphenIndexA === -1 ? a : a.substring(0, hyphenIndexA)
    const prereleaseA = hyphenIndexA === -1 ? undefined : a.substring(hyphenIndexA + 1)

    const baseB = hyphenIndexB === -1 ? b : b.substring(0, hyphenIndexB)
    const prereleaseB = hyphenIndexB === -1 ? undefined : b.substring(hyphenIndexB + 1)

    // Parse base version parts
    const aBaseParts = baseA.split('.').map(Number)
    const bBaseParts = baseB.split('.').map(Number)

    // Ensure both have at least 3 parts (major.minor.patch)
    while (aBaseParts.length < 3) aBaseParts.push(0)
    while (bBaseParts.length < 3) bBaseParts.push(0)

    // Compare base versions (major.minor.patch)
    for (let i = 0; i < 3; i++) {
      const aPart = aBaseParts[i] || 0
      const bPart = bBaseParts[i] || 0

      if (aPart < bPart) return -1
      if (aPart > bPart) return 1
    }

    // Base versions are equal, now compare prerelease versions
    // According to semver: version without prerelease > version with prerelease
    if (!prereleaseA && !prereleaseB) return 0 // Both are releases: 1.0.0 === 1.0.0
    if (!prereleaseA && prereleaseB) return 1 // Release > prerelease: 1.0.0 > 1.0.0-beta
    if (prereleaseA && !prereleaseB) return -1 // Prerelease < release: 1.0.0-beta < 1.0.0

    // Both have prerelease, compare them (TypeScript: we've checked both are defined above)
    return this.comparePrerelease(prereleaseA as string, prereleaseB as string)
  }

  /**
   * Compare two prerelease version strings
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   *
   * Follows semver spec 11.4:
   * - Split prerelease into dot-separated identifiers
   * - Numeric identifiers are compared as integers
   * - Alphanumeric identifiers are compared lexically in ASCII sort order
   * - Numeric identifiers always have lower precedence than alphanumeric
   * - Larger set of identifiers has higher precedence if all preceding are equal
   */
  private static comparePrerelease(a: string, b: string): number {
    const aParts = a.split('.')
    const bParts = b.split('.')

    const maxLength = Math.max(aParts.length, bParts.length)

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i]
      const bPart = bParts[i]

      // If one has more identifiers and all preceding are equal, it has higher precedence
      if (aPart === undefined) return -1 // a is shorter, so a < b
      if (bPart === undefined) return 1 // b is shorter, so a > b

      // Check if parts are numeric
      const aIsNumeric = /^\d+$/.test(aPart)
      const bIsNumeric = /^\d+$/.test(bPart)

      // If both are numeric, compare as integers
      if (aIsNumeric && bIsNumeric) {
        const aNum = parseInt(aPart, 10)
        const bNum = parseInt(bPart, 10)
        if (aNum < bNum) return -1
        if (aNum > bNum) return 1
        continue
      }

      // If one is numeric and one is not, numeric has lower precedence
      if (aIsNumeric && !bIsNumeric) return -1
      if (!aIsNumeric && bIsNumeric) return 1

      // Both are alphanumeric, compare lexically
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
    // Split on first hyphen only to keep everything after as prerelease
    // This handles cases like "1.2.3-beta-1" where prerelease is "beta-1"
    const hyphenIndex = version.indexOf('-')
    let baseVersion: string
    let prerelease: string | undefined

    if (hyphenIndex === -1) {
      baseVersion = version
      prerelease = undefined
    } else {
      baseVersion = version.substring(0, hyphenIndex)
      prerelease = version.substring(hyphenIndex + 1)
    }

    const [major, minor, patch] = baseVersion.split('.').map(Number)

    return {
      major: major || 0,
      minor: minor || 0,
      patch: patch || 0,
      prerelease
    }
  }
}
