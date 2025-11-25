/**
 * History Filters Component
 * Provides filtering controls for transfer history
 */

import { useState } from 'react'
import { Button } from './ui/Button'
import {
  Search,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Filter,
  Calendar
} from 'lucide-react'
import { cn } from '../lib/utils'

interface HistoryFiltersProps {
  filter: string
  statusFilter: string
  dateFilter: string
  onFilterChange: (filter: string) => void
  onStatusFilterChange: (status: string) => void
  onDateFilterChange: (date: string) => void
}

const statusOptions = [
  { value: 'all', label: 'All', icon: Filter, color: 'text-gray-500' },
  { value: 'complete', label: 'Complete', icon: CheckCircle, color: 'text-green-500' },
  { value: 'error', label: 'Error', icon: XCircle, color: 'text-red-500' },
  { value: 'cancelled', label: 'Cancelled', icon: AlertTriangle, color: 'text-yellow-500' },
  { value: 'running', label: 'Running', icon: Clock, color: 'text-blue-500' }
]

const dateOptions = [
  { value: 'all', label: 'All Time', icon: Calendar },
  { value: 'today', label: 'Today', icon: Calendar },
  { value: 'week', label: 'This Week', icon: Calendar },
  { value: 'month', label: 'This Month', icon: Calendar }
]

export function HistoryFilters({
  filter,
  statusFilter,
  dateFilter,
  onFilterChange,
  onStatusFilterChange,
  onDateFilterChange
}: HistoryFiltersProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  const handleClearFilter = () => {
    onFilterChange('')
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
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

      {/* Status Filter Buttons */}
      <div className="flex items-center gap-1">
        {statusOptions.map(({ value, label, icon: Icon, color }) => (
          <Button
            key={value}
            variant={statusFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusFilterChange(value)}
            className={cn(
              'flex items-center gap-2 transition-all',
              statusFilter === value && 'shadow-md'
            )}
          >
            <Icon className={cn('h-4 w-4', statusFilter === value ? 'text-white' : color)} />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      {/* Date Filter Buttons */}
      <div className="flex items-center gap-1">
        {dateOptions.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={dateFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateFilterChange(value)}
            className={cn(
              'flex items-center gap-2 transition-all',
              dateFilter === value && 'shadow-md'
            )}
          >
            <Icon
              className={cn('h-4 w-4', dateFilter === value ? 'text-white' : 'text-gray-500')}
            />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      {/* Filter Summary */}
      {(filter || statusFilter !== 'all' || dateFilter !== 'all') && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Filtered by:</span>
          {filter && <span className="font-medium">&quot;{filter}&quot;</span>}
          {statusFilter !== 'all' && (
            <span className="font-medium">
              {statusOptions.find((opt) => opt.value === statusFilter)?.label}
            </span>
          )}
          {dateFilter !== 'all' && (
            <span className="font-medium">
              {dateOptions.find((opt) => opt.value === dateFilter)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
