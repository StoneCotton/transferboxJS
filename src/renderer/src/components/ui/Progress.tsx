/**
 * Progress Component
 */

import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface ProgressProps {
  value: number // 0-100
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, className, showLabel = false, size = 'md' }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value))

    return (
      <div ref={ref} className={cn('w-full', className)}>
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',
            {
              'h-1': size === 'sm',
              'h-2': size === 'md',
              'h-3': size === 'lg'
            }
          )}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${clampedValue}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1 text-right text-xs text-gray-600 dark:text-gray-400">
            {Math.round(clampedValue)}%
          </div>
        )}
      </div>
    )
  }
)

Progress.displayName = 'Progress'
