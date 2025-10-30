/**
 * Log Viewer Component
 * Displays application logs with filtering and real-time updates
 */

import { useEffect, useState } from 'react'
import { useLogStore, useStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { LogFilters } from './LogFilters'
import { LogEntry as LogEntryComponent } from './LogEntry'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { ConfirmDialog } from './ui/ConfirmDialog'
import {
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  X,
  Bell,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react'
import { cn } from '../lib/utils'

interface LogViewerProps {
  onClose: () => void
}

export function LogViewer({ onClose }: LogViewerProps) {
  const { logs, filter, level, setLogs, addLog, setFilter, setLevel, clearLogs, getFilteredLogs } =
    useLogStore()
  const notificationHistory = useStore((state) => state.notificationHistory || [])
  const clearNotificationHistory = useStore((state) => state.clearNotificationHistory)
  const { getRecentLogs, clearLogs: clearLogsIpc } = useIpc()
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [activeTab, setActiveTab] = useState<'logs' | 'notifications'>('logs')
  const [notificationFilter, setNotificationFilter] = useState<string>('')
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<
    'all' | 'info' | 'success' | 'warning' | 'error'
  >('all')

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
      const existingTimestamps = new Set(logs.map((log) => log.timestamp))
      const newLogs = recentLogs.filter((log) => !existingTimestamps.has(log.timestamp))

      if (newLogs.length > 0) {
        newLogs.forEach((log) => addLog(log))
      }
    } catch (error) {
      console.error('Failed to refresh logs:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      setIsClearing(true)
      await clearLogsIpc()
      clearLogs()
      setShowClearConfirm(false)
    } catch (error) {
      console.error('Failed to clear logs:', error)
    } finally {
      setIsClearing(false)
    }
  }

  const handleExportLogs = () => {
    const filteredLogs = getFilteredLogs()
    const logText = filteredLogs
      .map(
        (log) =>
          `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
      )
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

  const handleClearNotifications = () => {
    if (clearNotificationHistory) {
      clearNotificationHistory()
    }
    setShowClearConfirm(false)
  }

  const handleExportNotifications = () => {
    const filteredNotifications = getFilteredNotifications()
    const notificationText = filteredNotifications
      .map(
        (notification) =>
          `[${new Date(notification.timestamp).toISOString()}] ${notification.type.toUpperCase()}: ${notification.message}`
      )
      .join('\n')

    const blob = new Blob([notificationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transferbox-notifications-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getFilteredNotifications = () => {
    const history = notificationHistory || []
    return history.filter((notification) => {
      if (notificationTypeFilter !== 'all' && notification.type !== notificationTypeFilter) {
        return false
      }
      if (
        notificationFilter &&
        !notification.message.toLowerCase().includes(notificationFilter.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }

  const filteredLogs = getFilteredLogs()
  const filteredNotifications = getFilteredNotifications()
  const logCounts = {
    debug: logs.filter((log) => log.level === 'debug').length,
    info: logs.filter((log) => log.level === 'info').length,
    warn: logs.filter((log) => log.level === 'warn').length,
    error: logs.filter((log) => log.level === 'error').length
  }

  const notificationCounts = {
    info: (notificationHistory || []).filter((n) => n.type === 'info').length,
    success: (notificationHistory || []).filter((n) => n.type === 'success').length,
    warning: (notificationHistory || []).filter((n) => n.type === 'warning').length,
    error: (notificationHistory || []).filter((n) => n.type === 'error').length
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getNotificationColorClasses = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20'
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getNotificationTextColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'warning':
        return 'text-amber-600 dark:text-amber-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'info':
      default:
        return 'text-blue-600 dark:text-blue-400'
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
              {activeTab === 'logs' ? (
                getLevelIcon('info')
              ) : (
                <Bell className="h-4 w-4 text-blue-500" />
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {activeTab === 'logs' ? 'Application Logs' : 'Notifications'}
              </h2>
            </div>
            {activeTab === 'logs' ? (
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
            ) : (
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>Total: {(notificationHistory || []).length}</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {notificationCounts.success}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  {notificationCounts.warning}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {notificationCounts.error}
                </span>
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3 text-blue-500" />
                  {notificationCounts.info}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'logs' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn(
                    'flex items-center gap-2',
                    autoRefresh &&
                      'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
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
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportNotifications}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </>
            )}
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2',
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2',
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </div>
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'logs' ? (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <LogFilters
              filter={filter}
              level={level}
              onFilterChange={setFilter}
              onLevelChange={setLevel}
            />
          </div>
        ) : (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Filter notifications..."
                value={notificationFilter}
                onChange={(e) => setNotificationFilter(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
              <select
                value={notificationTypeFilter}
                onChange={(e) =>
                  setNotificationTypeFilter(
                    e.target.value as 'all' | 'info' | 'success' | 'warning' | 'error'
                  )
                }
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option
                  value="all"
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                >
                  All Types
                </option>
                <option
                  value="info"
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                >
                  Info
                </option>
                <option
                  value="success"
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                >
                  Success
                </option>
                <option
                  value="warning"
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                >
                  Warning
                </option>
                <option
                  value="error"
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                >
                  Error
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'logs' ? (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4">
                    <Progress value={0} className="w-64" />
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
            </>
          ) : (
            <>
              {filteredNotifications.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {(notificationHistory || []).length === 0
                        ? 'No notifications yet'
                        : 'No notifications match your filters'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-auto">
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                          getNotificationColorClasses(notification.type)
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={cn(
                                  'text-xs font-semibold uppercase',
                                  getNotificationTextColor(notification.type)
                                )}
                              >
                                {notification.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(notification.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={activeTab === 'logs' ? handleClearLogs : handleClearNotifications}
        title={activeTab === 'logs' ? 'Clear Application Logs' : 'Clear Notification History'}
        message={
          activeTab === 'logs'
            ? `Are you sure you want to clear all application logs? This will permanently delete ${logs.length} log entr${logs.length !== 1 ? 'ies' : 'y'} and cannot be undone.`
            : `Are you sure you want to clear all notifications? This will permanently delete ${(notificationHistory || []).length} notification${(notificationHistory || []).length !== 1 ? 's' : ''} and cannot be undone.`
        }
        confirmText={activeTab === 'logs' ? 'Clear Logs' : 'Clear Notifications'}
        cancelText="Cancel"
        variant="danger"
        isLoading={isClearing}
      />
    </div>
  )
}
