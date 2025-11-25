/**
 * Log Filters Component
 * Provides filtering controls for log entries
 */

import { useState } from 'react'
import { Button } from './ui/Button'
import { Search, X, AlertCircle, AlertTriangle, Info, Bug, Filter } from 'lucide-react'
import { cn } from '../lib/utils'

interface LogFiltersProps {
  filter: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'all'
  onFilterChange: (filter: string) => void
  onLevelChange: (level: 'debug' | 'info' | 'warn' | 'error' | 'all') => void
}

const logLevels = [
  { value: 'all', label: 'All', icon: Filter, color: 'text-gray-500' },
  { value: 'error', label: 'Errors', icon: AlertCircle, color: 'text-red-500' },
  { value: 'warn', label: 'Warnings', icon: AlertTriangle, color: 'text-yellow-500' },
  { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500' },
  { value: 'debug', label: 'Debug', icon: Bug, color: 'text-gray-500' }
]

export function LogFilters({ filter, level, onFilterChange, onLevelChange }: LogFiltersProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  const handleClearFilter = () => {
    onFilterChange('')
  }

  return (
    <div className="flex items-center gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all',
              searchFocused && 'ring-2 ring-brand-500 border-transparent'
            )}
          />
          {filter && (
            <button
              onClick={handleClearFilter}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Level Filter Buttons */}
      <div className="flex items-center gap-1">
        {logLevels.map(({ value, label, icon: Icon, color }) => (
          <Button
            key={value}
            variant={level === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onLevelChange(value as 'debug' | 'info' | 'warn' | 'error' | 'all')}
            className={cn('flex items-center gap-2 transition-all', level === value && 'shadow-md')}
          >
            <Icon className={cn('h-4 w-4', level === value ? 'text-white' : color)} />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      {/* Filter Summary */}
      {filter && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Filtered by:</span>
          <span className="font-medium">&quot;{filter}&quot;</span>
        </div>
      )}
    </div>
  )
}
