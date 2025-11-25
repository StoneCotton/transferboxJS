/**
 * Hook for accessing UI density settings
 * Provides easy access to condensed/comfortable mode state
 */

import { useConfigStore } from '../store'
import type { UiDensity } from '../../../shared/types'

interface UiDensityHelpers {
  /** Current UI density setting */
  density: UiDensity
  /** Whether the UI is in condensed mode */
  isCondensed: boolean
  /** Whether the UI is in comfortable mode */
  isComfortable: boolean
}

/**
 * Hook to access UI density state and helpers
 * @returns UI density value and boolean helpers
 */
export function useUiDensity(): UiDensityHelpers {
  const { config } = useConfigStore()
  const density = config.uiDensity || 'comfortable'

  return {
    density,
    isCondensed: density === 'condensed',
    isComfortable: density === 'comfortable'
  }
}

