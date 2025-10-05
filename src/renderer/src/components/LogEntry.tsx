/**
 * Log Entry Component
 * Displays individual log entries with proper formatting
 */

import { useState } from 'react'
import { LogEntry as LogEntryType } from '../../../shared/types'
import { Button } from './ui/Button'
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug, 
  ChevronDown, 
  ChevronRight,
  Copy,
  Clock
} from 'lucide-react'
import { cn } from '../lib/utils'

interface LogEntryProps {
  log: LogEntryType
}

export function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now'
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m ago`
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      const days = Math.floor(diff / 86400000)
      return `${days}d ago`
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'info':
        return 'text-blue-600 dark:text-blue-400'
      case 'debug':
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getLevelBgColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20'
      case 'warn':
        return 'bg-yellow-50 dark:bg-yellow-900/20'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20'
      case 'debug':
        return 'bg-gray-50 dark:bg-gray-900/20'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const handleCopy = async () => {
    const logText = `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}${
      log.context ? '\nContext: ' + JSON.stringify(log.context, null, 2) : ''
    }`
    
    try {
      await navigator.clipboard.writeText(logText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy log entry:', error)
    }
  }

  const hasContext = log.context && Object.keys(log.context).length > 0

  return (
    <div className={cn(
      'p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
      getLevelBgColor(log.level)
    )}>
      <div className="flex items-start gap-3">
        {/* Level Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getLevelIcon(log.level)}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-3 mb-1">
                <span className={cn(
                  'text-sm font-medium uppercase tracking-wide',
                  getLevelColor(log.level)
                )}>
                  {log.level}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span title={formatTimestamp(log.timestamp)}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              </div>

              {/* Message */}
              <p className="text-sm text-gray-900 dark:text-white break-words">
                {log.message}
              </p>

              {/* Context Toggle */}
              {hasContext && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 h-auto"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span>Context ({Object.keys(log.context!).length} fields)</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 h-auto"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Expanded Context */}
          {expanded && hasContext && (
            <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
