/**
 * Tests for VersionUtils
 */

import { VersionUtils } from '../../../src/shared/utils/versionUtils'

describe('VersionUtils', () => {
  describe('compare', () => {
    describe('basic version comparison', () => {
      it('should return 0 for identical versions', () => {
        expect(VersionUtils.compare('1.0.0', '1.0.0')).toBe(0)
        expect(VersionUtils.compare('2.5.3', '2.5.3')).toBe(0)
      })

      it('should return -1 when first version is less than second', () => {
        expect(VersionUtils.compare('1.0.0', '2.0.0')).toBe(-1)
        expect(VersionUtils.compare('1.0.0', '1.1.0')).toBe(-1)
        expect(VersionUtils.compare('1.0.0', '1.0.1')).toBe(-1)
      })

      it('should return 1 when first version is greater than second', () => {
        expect(VersionUtils.compare('2.0.0', '1.0.0')).toBe(1)
        expect(VersionUtils.compare('1.1.0', '1.0.0')).toBe(1)
        expect(VersionUtils.compare('1.0.1', '1.0.0')).toBe(1)
      })

      it('should handle missing patch versions', () => {
        expect(VersionUtils.compare('1.0', '1.0.0')).toBe(0)
        expect(VersionUtils.compare('1.0', '1.0.1')).toBe(-1)
        expect(VersionUtils.compare('1.0.1', '1.0')).toBe(1)
      })

      it('should handle missing minor versions', () => {
        expect(VersionUtils.compare('1', '1.0.0')).toBe(0)
        expect(VersionUtils.compare('1', '1.1.0')).toBe(-1)
        expect(VersionUtils.compare('1.1.0', '1')).toBe(1)
      })
    })

    describe('prerelease version comparison', () => {
      it('should return 0 for identical prerelease versions', () => {
        expect(VersionUtils.compare('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(0)
        expect(VersionUtils.compare('2.0.1-beta.0', '2.0.1-beta.0')).toBe(0)
      })

      it('should compare prerelease versions correctly', () => {
        // beta.0 < beta.1
        expect(VersionUtils.compare('2.0.1-beta.0', '2.0.1-beta.1')).toBe(-1)
        expect(VersionUtils.compare('2.0.1-beta.1', '2.0.1-beta.0')).toBe(1)

        // alpha < beta (lexicographic)
        expect(VersionUtils.compare('1.0.0-alpha.1', '1.0.0-beta.1')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-beta.1', '1.0.0-alpha.1')).toBe(1)

        // alpha.1 < alpha.2
        expect(VersionUtils.compare('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1)
      })

      it('should treat prerelease versions as less than release versions', () => {
        // Any prerelease is less than the release
        expect(VersionUtils.compare('1.0.0-alpha.1', '1.0.0')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-beta.1', '1.0.0')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-rc.1', '1.0.0')).toBe(-1)

        // Release is greater than any prerelease
        expect(VersionUtils.compare('1.0.0', '1.0.0-alpha.1')).toBe(1)
        expect(VersionUtils.compare('1.0.0', '1.0.0-beta.1')).toBe(1)
        expect(VersionUtils.compare('1.0.0', '1.0.0-rc.1')).toBe(1)
      })

      it('should compare base versions before prerelease versions', () => {
        // 1.0.0-beta < 1.0.1-alpha (base version takes precedence)
        expect(VersionUtils.compare('1.0.0-beta.1', '1.0.1-alpha.1')).toBe(-1)
        expect(VersionUtils.compare('1.0.1-alpha.1', '1.0.0-beta.1')).toBe(1)
      })

      it('should handle prerelease versions with multiple identifiers', () => {
        expect(VersionUtils.compare('1.0.0-alpha.1.2', '1.0.0-alpha.1.3')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-alpha.1.3', '1.0.0-alpha.1.2')).toBe(1)
      })

      it('should handle numeric prerelease identifiers', () => {
        expect(VersionUtils.compare('1.0.0-1', '1.0.0-2')).toBe(-1)
        expect(VersionUtils.compare('1.0.0-2', '1.0.0-1')).toBe(1)
        expect(VersionUtils.compare('1.0.0-10', '1.0.0-2')).toBe(1) // numeric comparison: 10 > 2
      })
    })

    describe('edge cases', () => {
      it('should handle empty strings gracefully', () => {
        expect(VersionUtils.compare('1.0.0', '')).toBe(1)
        expect(VersionUtils.compare('', '1.0.0')).toBe(-1)
        expect(VersionUtils.compare('', '')).toBe(0)
      })

      it('should handle versions with leading zeros', () => {
        expect(VersionUtils.compare('1.0.0', '1.00.0')).toBe(0)
        expect(VersionUtils.compare('01.0.0', '1.0.0')).toBe(0)
      })
    })
  })

  describe('isCompatible', () => {
    it('should return true for compatible versions', () => {
      expect(VersionUtils.isCompatible('2.0.0', '2.0.0')).toBe(true)
      expect(VersionUtils.isCompatible('2.0.1', '2.0.0')).toBe(true)
      expect(VersionUtils.isCompatible('2.1.0', '2.0.0')).toBe(true)
      expect(VersionUtils.isCompatible('3.0.0', '2.0.0')).toBe(true)
    })

    it('should return false for incompatible versions', () => {
      expect(VersionUtils.isCompatible('1.9.9', '2.0.0')).toBe(false)
      expect(VersionUtils.isCompatible('1.0.0', '2.0.0')).toBe(false)
    })

    it('should handle prerelease versions', () => {
      expect(VersionUtils.isCompatible('2.0.1-beta.1', '2.0.0')).toBe(true)
      expect(VersionUtils.isCompatible('2.0.0-beta.1', '2.0.0')).toBe(false) // prerelease < release
    })
  })

  describe('parse', () => {
    it('should parse standard versions', () => {
      const result = VersionUtils.parse('1.2.3')
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined
      })
    })

    it('should parse versions with prerelease', () => {
      const result = VersionUtils.parse('1.2.3-beta.1')
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.1'
      })
    })

    it('should handle missing parts', () => {
      const result = VersionUtils.parse('1')
      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: undefined
      })
    })

    it('should handle prerelease with multiple hyphens', () => {
      const result = VersionUtils.parse('1.2.3-beta-1')
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta-1'
      })
    })
  })
})
