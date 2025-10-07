/**
 * History Session Component
 * Displays individual transfer session details
 */

import { useState } from 'react'
import { TransferSession } from '../../../shared/types'
import { Button } from './ui/Button'
import { useConfigStore } from '../store'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  HardDrive,
  FolderOpen,
  FileText,
  Calendar,
  Timer,
  AlertCircle
} from 'lucide-react'
import { cn } from '../lib/utils'

interface HistorySessionProps {
  session: TransferSession
}

export function HistorySession({ session }: HistorySessionProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { config } = useConfigStore()

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    // Use config.unitSystem if available, otherwise default to decimal
    const unitSystem = config?.unitSystem || 'decimal'
    const k = unitSystem === 'binary' ? 1024 : 1000
    const sizes =
      unitSystem === 'binary' ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (startTime: number, endTime?: number | null) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diff = end.getTime() - start.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

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

    if (diff < 60000) {
      // Less than 1 minute
      return 'Just now'
    } else if (diff < 3600000) {
      // Less than 1 hour
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m ago`
    } else if (diff < 86400000) {
      // Less than 1 day
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      const days = Math.floor(diff / 86400000)
      return `${days}d ago`
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'cancelled':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'cancelled':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'running':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20'
      case 'cancelled':
        return 'bg-yellow-50 dark:bg-yellow-900/20'
      case 'running':
        return 'bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const handleCopy = async () => {
    const sessionText = `Transfer Session: ${session.id}
Status: ${session.status}
Drive: ${session.driveName} (${session.driveId})
Source: ${session.sourceRoot}
Destination: ${session.destinationRoot}
Start Time: ${formatTimestamp(session.startTime)}
End Time: ${session.endTime ? formatTimestamp(session.endTime) : 'N/A'}
Duration: ${formatDuration(session.startTime, session.endTime)}
Files: ${session.fileCount}
Size: ${formatBytes(session.totalBytes)}
${session.errorMessage ? `Error: ${session.errorMessage}` : ''}`

    try {
      await navigator.clipboard.writeText(sessionText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy session details:', error)
    }
  }

  return (
    <div
      className={cn(
        'p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        getStatusBgColor(session.status)
      )}
    >
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-1">{getStatusIcon(session.status)}</div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={cn(
                    'text-sm font-medium uppercase tracking-wide',
                    getStatusColor(session.status)
                  )}
                >
                  {session.status}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3" />
                  <span title={formatTimestamp(session.startTime)}>
                    {formatRelativeTime(session.startTime)}
                  </span>
                </div>
                {session.endTime && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Timer className="h-3 w-3" />
                    <span>{formatDuration(session.startTime, session.endTime)}</span>
                  </div>
                )}
              </div>

              {/* Drive and Paths */}
              <div className="space-y-1 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session.driveName}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">({session.driveId})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                  <span className="truncate" title={session.sourceRoot}>
                    {session.sourceRoot}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                  <span className="truncate" title={session.destinationRoot}>
                    {session.destinationRoot}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{session.fileCount} files</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>{formatBytes(session.totalBytes)}</span>
                </div>
              </div>

              {/* Error Message */}
              {session.errorMessage && (
                <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg mb-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    {session.errorMessage}
                  </span>
                </div>
              )}

              {/* Expand Toggle */}
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
                  <span>Details</span>
                </Button>
              </div>
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

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Session Details
                  </h4>
                  <div className="space-y-1 text-gray-600 dark:text-gray-300">
                    <div>
                      <span className="font-medium">ID:</span> {session.id}
                    </div>
                    <div>
                      <span className="font-medium">Start:</span>{' '}
                      {formatTimestamp(session.startTime)}
                    </div>
                    {session.endTime && (
                      <div>
                        <span className="font-medium">End:</span> {formatTimestamp(session.endTime)}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Duration:</span>{' '}
                      {formatDuration(session.startTime, session.endTime)}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transfer Info</h4>
                  <div className="space-y-1 text-gray-600 dark:text-gray-300">
                    <div>
                      <span className="font-medium">Files:</span>{' '}
                      {session.fileCount.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {formatBytes(session.totalBytes)}
                    </div>
                    <div>
                      <span className="font-medium">Drive:</span> {session.driveName}
                    </div>
                    <div>
                      <span className="font-medium">Device:</span> {session.driveId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
