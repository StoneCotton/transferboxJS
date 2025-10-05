/**
 * Log Viewer Component
 * Displays application logs with filtering and real-time updates
 */

import { useEffect, useState } from 'react'
import { useLogStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { LogEntry } from '../../../shared/types'
import { LogFilters } from './LogFilters'
import { LogEntry as LogEntryComponent } from './LogEntry'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { 
  Download, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  Bug,
  X
} from 'lucide-react'
import { cn } from '../lib/utils'

interface LogViewerProps {
  onClose: () => void
}

export function LogViewer({ onClose }: LogViewerProps) {
  const { logs, filter, level, setLogs, addLog, setFilter, setLevel, clearLogs, getFilteredLogs } = useLogStore()
  const { getRecentLogs, clearLogs: clearLogsIpc } = useIpc()
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Load initial logs
  useEffect(() => {
    loadLogs()
  }, [])

  // Set up real-time log updates
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!isRefreshing) {
        refreshLogs()
      }
    }, 2000) // Refresh every 2 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, isRefreshing])

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      const recentLogs = await getRecentLogs(1000)
      setLogs(recentLogs)
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshLogs = async () => {
    try {
      setIsRefreshing(true)
      const recentLogs = await getRecentLogs(100)
      // Only add new logs to avoid duplicates
      const existingTimestamps = new Set(logs.map(log => log.timestamp))
      const newLogs = recentLogs.filter(log => !existingTimestamps.has(log.timestamp))
      
      if (newLogs.length > 0) {
        newLogs.forEach(log => addLog(log))
      }
    } catch (error) {
      console.error('Failed to refresh logs:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await clearLogsIpc()
      clearLogs()
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const handleExportLogs = () => {
    const filteredLogs = getFilteredLogs()
    const logText = filteredLogs
      .map(log => `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transferbox-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredLogs = getFilteredLogs()
  const logCounts = {
    debug: logs.filter(log => log.level === 'debug').length,
    info: logs.filter(log => log.level === 'info').length,
    warn: logs.filter(log => log.level === 'warn').length,
    error: logs.filter(log => log.level === 'error').length
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getLevelIcon('info')}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Application Logs
              </h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Total: {logs.length}</span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                {logCounts.error}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {logCounts.warn}
              </span>
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3 text-blue-500" />
                {logCounts.info}
              </span>
              <span className="flex items-center gap-1">
                <Bug className="h-3 w-3 text-gray-500" />
                {logCounts.debug}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'flex items-center gap-2',
                autoRefresh && 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
              Auto-refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLogs}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <LogFilters
            filter={filter}
            level={level}
            onFilterChange={setFilter}
            onLevelChange={setLevel}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <Progress className="w-64" />
                <p className="text-gray-500 dark:text-gray-400">Loading logs...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {logs.length === 0 ? 'No logs available' : 'No logs match your filters'}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.map((log, index) => (
                  <LogEntryComponent key={`${log.timestamp}-${index}`} log={log} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
