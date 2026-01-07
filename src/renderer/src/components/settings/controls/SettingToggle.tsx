/**
 * Setting Toggle Component
 * A styled checkbox toggle for boolean settings
 */

import React from 'react'
import { cn } from '../../../lib/utils'

export interface SettingToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title: string
  description: string
  badge?: string
}

export function SettingToggle({
  checked,
  onChange,
  disabled,
  title,
  description,
  badge
}: SettingToggleProps): React.ReactElement {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all',
        checked
          ? 'border-brand-500/30 bg-brand-50/30 dark:border-brand-500/20 dark:bg-brand-950/10'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 dark:text-white">{title}</p>
          {badge && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </label>
  )
}
