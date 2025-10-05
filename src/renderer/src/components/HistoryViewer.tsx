/**
 * History Viewer Component
 * Displays transfer history with filtering and details
 */

import { useEffect, useState } from 'react'
import { useTransferStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { TransferSession } from '../../../shared/types'
import { HistoryFilters } from './HistoryFilters'
import { HistorySession } from './HistorySession'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Progress } from './ui/Progress'
import { 
  Download, 
  Trash2, 
  RefreshCw, 
  History, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  X
} from 'lucide-react'
import { cn } from '../lib/utils'

interface HistoryViewerProps {
  onClose: () => void
}

export function HistoryViewer({ onClose }: HistoryViewerProps) {
  const { history, setHistory } = useTransferStore()
  const { getHistory, clearHistory: clearHistoryIpc } = useIpc()
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  // Load initial history
  useEffect(() => {
    loadHistory()
  }, [])

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

  const loadHistory = async () => {
    try {
      setIsLoading(true)
      const historyData = await getHistory()
      setHistory(historyData)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshHistory = async () => {
    try {
      setIsRefreshing(true)
      const historyData = await getHistory()
      setHistory(historyData)
    } catch (error) {
      console.error('Failed to refresh history:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearHistory = async () => {
    try {
      await clearHistoryIpc()
      setHistory([])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  const handleExportHistory = () => {
    const filteredHistory = getFilteredHistory()
    const historyText = filteredHistory
      .map(session => {
        const startTime = new Date(session.startTime).toISOString()
        const endTime = session.endTime ? new Date(session.endTime).toISOString() : 'N/A'
        return `Session: ${session.id}
Status: ${session.status}
Drive: ${session.driveName} (${session.driveId})
Source: ${session.sourceRoot}
Destination: ${session.destinationRoot}
Start Time: ${startTime}
End Time: ${endTime}
Files: ${session.fileCount}
Size: ${formatBytes(session.totalBytes)}
${session.errorMessage ? `Error: ${session.errorMessage}` : ''}
---`
      })
      .join('\n')
    
    const blob = new Blob([historyText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transferbox-history-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getFilteredHistory = () => {
    let filtered = history

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter)
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const oneWeek = 7 * oneDay
      const oneMonth = 30 * oneDay

      filtered = filtered.filter(session => {
        const sessionTime = session.startTime
        switch (dateFilter) {
          case 'today':
            return now - sessionTime < oneDay
          case 'week':
            return now - sessionTime < oneWeek
          case 'month':
            return now - sessionTime < oneMonth
          default:
            return true
        }
      })
    }

    // Filter by search term
    if (filter) {
      const searchTerm = filter.toLowerCase()
      filtered = filtered.filter(session =>
        session.driveName.toLowerCase().includes(searchTerm) ||
        session.sourceRoot.toLowerCase().includes(searchTerm) ||
        session.destinationRoot.toLowerCase().includes(searchTerm) ||
        session.id.toLowerCase().includes(searchTerm)
      )
    }

    return filtered
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
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
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const filteredHistory = getFilteredHistory()
  const statusCounts = {
    complete: history.filter(session => session.status === 'complete').length,
    error: history.filter(session => session.status === 'error').length,
    cancelled: history.filter(session => session.status === 'cancelled').length,
    running: history.filter(session => session.status === 'running').length
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
              <History className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Transfer History
              </h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Total: {history.length}</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {statusCounts.complete}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {statusCounts.error}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {statusCounts.cancelled}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-500" />
                {statusCounts.running}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshHistory}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHistory}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
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
          <HistoryFilters
            filter={filter}
            statusFilter={statusFilter}
            dateFilter={dateFilter}
            onFilterChange={setFilter}
            onStatusFilterChange={setStatusFilter}
            onDateFilterChange={setDateFilter}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <Progress value={0} className="w-64" />
                <p className="text-gray-500 dark:text-gray-400">Loading history...</p>
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {history.length === 0 ? 'No transfer history available' : 'No transfers match your filters'}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredHistory.map((session) => (
                  <HistorySession key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
