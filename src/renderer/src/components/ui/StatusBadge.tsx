/**
 * StatusBadge Component
 * Displays a colored badge with an icon and count for transfer status
 */

import { memo } from 'react'
import { CheckCircle2, Loader2, Clock, XCircle, AlertCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip } from './Tooltip'

export type StatusType = 'complete' | 'transferring' | 'verifying' | 'error' | 'pending' | 'skipped'

export interface StatusBadgeProps {
  status: StatusType
  count: number
  isCondensed?: boolean
}

interface StatusConfig {
  icon: LucideIcon
  animate?: boolean
  bgClass: string
  iconClass: string
  textClass: string
  tooltipSingular: string
  tooltipPlural: string
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  complete: {
    icon: CheckCircle2,
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
    textClass: 'text-green-900 dark:text-green-100',
    tooltipSingular: 'file successfully transferred and verified',
    tooltipPlural: 'files successfully transferred and verified'
  },
  transferring: {
    icon: Loader2,
    animate: true,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
    textClass: 'text-blue-900 dark:text-blue-100',
    tooltipSingular: 'file currently being transferred',
    tooltipPlural: 'files currently being transferred'
  },
  verifying: {
    icon: Clock,
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
    textClass: 'text-yellow-900 dark:text-yellow-100',
    tooltipSingular: 'file being verified with checksum',
    tooltipPlural: 'files being verified with checksum'
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-100',
    tooltipSingular: 'file failed to transfer',
    tooltipPlural: 'files failed to transfer'
  },
  pending: {
    icon: Clock,
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    iconClass: 'text-gray-600 dark:text-gray-400',
    textClass: 'text-gray-900 dark:text-gray-100',
    tooltipSingular: 'file waiting to be transferred',
    tooltipPlural: 'files waiting to be transferred'
  },
  skipped: {
    icon: AlertCircle,
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    iconClass: 'text-orange-600 dark:text-orange-400',
    textClass: 'text-orange-900 dark:text-orange-100',
    tooltipSingular: 'file skipped',
    tooltipPlural: 'files skipped'
  }
}

export const StatusBadge = memo(function StatusBadge({
  status,
  count,
  isCondensed = false
}: StatusBadgeProps) {
  if (count === 0) return null

  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const tooltipText = `${count} ${count === 1 ? config.tooltipSingular : config.tooltipPlural}`

  return (
    <Tooltip content={tooltipText} position="bottom">
      <div
        className={cn(
          'flex items-center rounded-lg',
          config.bgClass,
          isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
        )}
      >
        <Icon
          className={cn(
            config.iconClass,
            config.animate && 'animate-spin',
            isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3'
          )}
        />
        <span
          className={cn('font-bold', config.textClass, isCondensed ? 'text-[10px]' : 'text-xs')}
        >
          {count}
        </span>
      </div>
    </Tooltip>
  )
})
