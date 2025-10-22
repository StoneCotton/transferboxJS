# Config Version Update Bug Fix

## Problem Description

When updating the application from version `2.0.1-beta.0` to `2.0.1-beta.1`, the config file's `configVersion` field was not being updated. The config remained at `2.0.1-beta.0` even though the app version showed `2.0.1-beta.1`.

## Root Cause

The bug was in the `VersionUtils.compare()` method in `src/shared/utils/versionUtils.ts`. The original implementation was stripping prerelease suffixes before comparing versions:

```typescript
// OLD - BUGGY CODE:
const cleanA = a.split('-')[0] // "2.0.1-beta.0" → "2.0.1"
const cleanB = b.split('-')[0] // "2.0.1-beta.1" → "2.0.1"
// Both became "2.0.1", so they were considered equal!
```

This meant that:

- `VersionUtils.compare('2.0.1-beta.0', '2.0.1-beta.1')` returned `0` (equal)
- The migration logic saw them as the same version
- The config version was never updated

## The Fix

### 1. Updated Version Comparison Logic

Rewrote `VersionUtils.compare()` to properly handle prerelease versions according to semantic versioning spec:

```typescript
// NEW - CORRECT CODE:
// Split on first hyphen only, preserving prerelease identifiers
const hyphenIndexA = a.indexOf('-')
const baseA = hyphenIndexA === -1 ? a : a.substring(0, hyphenIndexA)
const prereleaseA = hyphenIndexA === -1 ? undefined : a.substring(hyphenIndexA + 1)

// Compare base versions first (major.minor.patch)
// Then compare prerelease versions if base versions are equal
```

Key improvements:

- **Preserves prerelease identifiers**: `"2.0.1-beta.0"` and `"2.0.1-beta.1"` are now compared correctly
- **Follows semver spec**:
  - Prerelease versions are LESS than release versions (`1.0.0-beta < 1.0.0`)
  - Prerelease identifiers are compared lexicographically and numerically
  - Example: `1.0.0-alpha.1 < 1.0.0-alpha.2 < 1.0.0-beta.1 < 1.0.0`

### 2. Added Prerelease Comparison Method

Created a new `comparePrerelease()` method that properly compares prerelease identifiers:

```typescript
private static comparePrerelease(a: string, b: string): number {
  const aParts = a.split('.')  // "beta.0" → ["beta", "0"]
  const bParts = b.split('.')  // "beta.1" → ["beta", "1"]

  // Compare each identifier:
  // - Numeric identifiers as integers (0 < 1)
  // - Alphanumeric identifiers lexically
  // - Numeric < alphanumeric
}
```

### 3. Fixed Parse Method

Updated the `parse()` method to handle multiple hyphens in prerelease tags:

```typescript
// Handles "1.2.3-beta-1" correctly: base="1.2.3", prerelease="beta-1"
const hyphenIndex = version.indexOf('-')
const baseVersion = version.substring(0, hyphenIndex)
const prerelease = version.substring(hyphenIndex + 1)
```

### 4. Enhanced Test Coverage

Added comprehensive test suite (`tests/shared/utils/versionUtils.test.ts`) with 20 test cases covering:

- Basic version comparison
- Prerelease version comparison
- Edge cases (empty strings, multiple hyphens, numeric identifiers)
- Version parsing

### 5. Fixed Test Infrastructure

Updated Jest configuration to include shared tests:

```javascript
// jest.config.js
testMatch: [
  '<rootDir>/tests/main/**/*.test.ts',
  '<rootDir>/tests/integration/**/*.test.ts',
  '<rootDir>/tests/shared/**/*.test.ts' // Added this
]
```

Enhanced electron-store mock to support `set()` and `delete()` methods used by config manager.

## Verification

All 306 tests now pass, including:

- ✅ 20 new VersionUtils tests
- ✅ All existing ConfigManager tests
- ✅ All integration tests

## Impact

**Before Fix:**

- Config version stuck at `2.0.1-beta.0` when upgrading to `2.0.1-beta.1`
- Migrations would not run between prerelease versions
- New config fields might not be added properly

**After Fix:**

- Config version properly updates when upgrading between any versions
- Prerelease versions (`alpha`, `beta`, `rc`) are handled correctly
- Migration logic works as expected for all version transitions

## Example Behavior

```typescript
// Now works correctly:
VersionUtils.compare('2.0.1-beta.0', '2.0.1-beta.1') // Returns -1 (beta.0 < beta.1)
VersionUtils.compare('2.0.1-beta.1', '2.0.1') // Returns -1 (prerelease < release)
VersionUtils.compare('2.0.1', '2.0.1') // Returns 0 (equal)
```

## Files Changed

1. `src/shared/utils/versionUtils.ts` - Fixed version comparison logic
2. `tests/shared/utils/versionUtils.test.ts` - Added comprehensive tests (NEW)
3. `jest.config.js` - Added shared tests to test patterns
4. `tests/__mocks__/electron-store.ts` - Added missing methods to mock

## Next Steps for Users

When users upgrade to this version:

1. The config migration will now run properly between prerelease versions
2. The `configVersion` field will be updated to match the app version
3. Any new config fields added in newer versions will be properly initialized

## Technical Notes

This fix follows the [Semantic Versioning 2.0.0 spec](https://semver.org/), specifically section 11 which defines precedence rules for prerelease versions.
