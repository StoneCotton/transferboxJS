/**
 * Mode Indicator Component
 * Shows the current transfer mode
 */

import { Zap, CheckCircle2, Bot, Hand } from 'lucide-react'
import type { TransferMode } from '../../../shared/types'
import { useConfigStore } from '../store'
import { cn } from '../lib/utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ModeIndicator() {
  const { config } = useConfigStore()
  const mode = config.transferMode

  const modeConfig: Record<
    TransferMode,
    {
      label: string
      icon: typeof Zap
      color: string
      bgColor: string
      borderColor: string
    }
  > = {
    'auto-transfer': {
      label: 'Auto-Transfer',
      icon: Zap,
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-300 dark:border-blue-700'
    },
    'confirm-transfer': {
      label: 'Confirm Mode',
      icon: CheckCircle2,
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-300 dark:border-green-700'
    },
    'fully-autonomous': {
      label: 'Autonomous',
      icon: Bot,
      color: 'text-purple-700 dark:text-purple-300',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      borderColor: 'border-purple-300 dark:border-purple-700'
    },
    manual: {
      label: 'Manual',
      icon: Hand,
      color: 'text-slate-700 dark:text-slate-300',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
      borderColor: 'border-slate-300 dark:border-slate-700'
    }
  }

  const currentMode = modeConfig[mode]
  const Icon = currentMode.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 transition-all',
        currentMode.bgColor,
        currentMode.borderColor
      )}
    >
      <Icon className={cn('h-4 w-4', currentMode.color)} />
      <span className={cn('text-xs font-bold uppercase tracking-wide', currentMode.color)}>
        {currentMode.label}
      </span>
    </div>
  )
}
