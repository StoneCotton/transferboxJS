/**
 * About Link Component
 * A styled button/link for the About section
 */

import React from 'react'
import { cn } from '../../../lib/utils'

export interface AboutLinkProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
  comingSoon?: boolean
}

export function AboutLink({
  icon,
  title,
  description,
  onClick,
  comingSoon
}: AboutLinkProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={comingSoon}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
        comingSoon
          ? 'cursor-not-allowed border-gray-200 bg-gray-50/50 opacity-60 dark:border-gray-700 dark:bg-gray-800/30'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-600 dark:hover:bg-brand-950/20'
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {comingSoon && (
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Coming Soon
        </span>
      )}
    </button>
  )
}
