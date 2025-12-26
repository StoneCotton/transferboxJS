/**
 * Setting Number Input Component
 * A styled number input for numeric settings
 */

import React from 'react'
import { cn } from '../../../lib/utils'

export interface SettingNumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  hint?: string
  min?: number
  suffix?: string
}

export function SettingNumberInput({
  label,
  value,
  onChange,
  disabled,
  hint,
  min,
  suffix
}: SettingNumberInputProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          min={min}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white',
            suffix && 'pr-16'
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}
