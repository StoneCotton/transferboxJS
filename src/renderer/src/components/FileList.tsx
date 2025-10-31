/**
 * File List Component - Visual Transfer Queue
 */

import {
  File,
  FileVideo,
  FileAudio,
  FileImage,
  Folder,
  FileType,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Copy
} from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useDriveStore, useTransferStore } from '../store'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { cn, formatDuration } from '../lib/utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getFileIcon(filePath: string) {
  const ext = filePath.toLowerCase().split('.').pop()

  if (
    [
      '.mp4',
      '.mov',
      '.avi',
      '.mkv',
      '.mts',
      '.m2ts',
      '.m4v',
      '.mpg',
      '.mpeg',
      '.crm',
      '.mxf',
      '.webm',
      '.braw',
      '.r3d'
    ].includes(`.${ext}`)
  ) {
    return FileVideo
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(`.${ext}`)) {
    return FileAudio
  }
  if (
    [
      '.jpg',
      '.jpeg',
      '.png',
      '.raw',
      '.cr2',
      '.cr3',
      '.nef',
      '.arw',
      '.dng',
      '.heic',
      '.heif'
    ].includes(`.${ext}`)
  ) {
    return FileImage
  }
  if (['.xml'].includes(`.${ext}`)) {
    return FileType
  }
  return File
}

function getFileType(filePath: string): 'video' | 'audio' | 'image' | 'other' {
  const ext = filePath.toLowerCase().split('.').pop()

  if (
    [
      '.mp4',
      '.mov',
      '.avi',
      '.mkv',
      '.mts',
      '.m2ts',
      '.m4v',
      '.mpg',
      '.mpeg',
      '.crm',
      '.mxf',
      '.webm',
      '.braw',
      '.r3d'
    ].includes(`.${ext}`)
  ) {
    return 'video'
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(`.${ext}`)) {
    return 'audio'
  }
  if (
    [
      '.jpg',
      '.jpeg',
      '.png',
      '.raw',
      '.cr2',
      '.cr3',
      '.nef',
      '.arw',
      '.dng',
      '.heic',
      '.heif'
    ].includes(`.${ext}`)
  ) {
    return 'image'
  }
  if (['.xml'].includes(`.${ext}`)) {
    return 'other'
  }
  return 'other'
}

// Helper function to get file transfer status
function getFileTransferStatus(
  filePath: string,
  progress: unknown
): 'pending' | 'transferring' | 'verifying' | 'complete' | 'error' | 'skipped' {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return 'pending'
  }

  const progressObj = progress as {
    activeFiles?: Array<{ sourcePath: string; status: string }>
    currentFile?: { sourcePath: string; status: string }
    completedFiles?: Array<{ sourcePath: string; status: string }>
  }

  // Check if file is in completed files first
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile) {
      return completedFile.status as
        | 'pending'
        | 'transferring'
        | 'verifying'
        | 'complete'
        | 'error'
        | 'skipped'
    }
  }

  // Check if file is currently being transferred
  if (progressObj.currentFile && progressObj.currentFile.sourcePath === filePath) {
    return progressObj.currentFile.status as
      | 'pending'
      | 'transferring'
      | 'verifying'
      | 'complete'
      | 'error'
      | 'skipped'
  }

  // Check if file is in active files (parallel transfers)
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile) {
      return activeFile.status as
        | 'pending'
        | 'transferring'
        | 'verifying'
        | 'complete'
        | 'error'
        | 'skipped'
    }
  }

  return 'pending'
}

// Helper function to get checksum for completed files
function getFileChecksum(filePath: string, progress: unknown): string | null {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return null
  }

  const progressObj = progress as {
    activeFiles?: Array<{ sourcePath: string; checksum?: string }>
    currentFile?: { sourcePath: string; checksum?: string }
    completedFiles?: Array<{ sourcePath: string; checksum?: string }>
  }

  // Check completed files first (most likely to have checksums)
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile?.checksum) {
      return completedFile.checksum
    }
  }

  // Check current file
  if (
    progressObj.currentFile &&
    progressObj.currentFile.sourcePath === filePath &&
    progressObj.currentFile.checksum
  ) {
    return progressObj.currentFile.checksum
  }

  // Check active files
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile?.checksum) {
      return activeFile.checksum
    }
  }

  return null
}

// Helper function to get file elapsed time
function getFileElapsedTime(filePath: string, progress: unknown): number | null {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return null
  }

  const progressObj = progress as {
    activeFiles?: Array<{ sourcePath: string; duration?: number }>
    currentFile?: { sourcePath: string; duration?: number }
    completedFiles?: Array<{ sourcePath: string; duration?: number }>
  }

  // Check if file is currently being transferred
  if (progressObj.currentFile && progressObj.currentFile.sourcePath === filePath) {
    return progressObj.currentFile.duration || null
  }

  // Check if file is in active files (parallel transfers)
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile?.duration) {
      return activeFile.duration
    }
  }

  // Check if file is in completed files
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile?.duration) {
      return completedFile.duration
    }
  }

  return null
}

// Helper function to copy checksum to clipboard
function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch((err) => {
    console.error('Failed to copy to clipboard:', err)
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function FileList() {
  const { scannedFiles, scanInProgress } = useDriveStore()
  const { progress } = useTransferStore()
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null)

  // Calculate transfer status statistics
  const transferStats = useMemo(() => {
    const stats = {
      pending: 0,
      transferring: 0,
      verifying: 0,
      complete: 0,
      error: 0,
      skipped: 0
    }

    scannedFiles.forEach((file) => {
      const status = getFileTransferStatus(file.path, progress)
      stats[status]++
    })

    return stats
  }, [scannedFiles, progress])

  // Handle checksum copy
  const handleCopyChecksum = (checksum: string): void => {
    copyToClipboard(checksum)
    setCopiedChecksum(checksum)
    setTimeout(() => setCopiedChecksum(null), 2000)
  }

  if (scanInProgress) {
    return (
      <Card className="border-0 bg-white/70 shadow-xl shadow-purple-500/10 backdrop-blur-sm dark:bg-gray-900/70">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <div className="h-16 w-16" />
          </div>
          <p className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">
            Scanning for Media Files
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This may take a moment...</p>
        </CardContent>
      </Card>
    )
  }

  if (scannedFiles.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-white/50 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
              <Folder className="h-10 w-10 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="mt-6 text-xl font-bold text-gray-900 dark:text-white">No Files Found</p>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Select a drive to scan for media files
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-white/70 shadow-xl shadow-purple-500/10 backdrop-blur-sm dark:bg-gray-900/70">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30">
              <FileType className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Transfer Queue</CardTitle>
              <CardDescription className="text-xs">
                {scannedFiles.length} file{scannedFiles.length !== 1 ? 's' : ''} in queue
              </CardDescription>
            </div>
          </div>

          {/* Transfer Status Statistics */}
          <div className="flex gap-2">
            {transferStats.complete > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-green-100 px-2 py-1 dark:bg-green-900/30">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-900 dark:text-green-100">
                  {transferStats.complete}
                </span>
              </div>
            )}
            {transferStats.transferring > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-2 py-1 dark:bg-blue-900/30">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  {transferStats.transferring}
                </span>
              </div>
            )}
            {transferStats.verifying > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-yellow-100 px-2 py-1 dark:bg-yellow-900/30">
                <Clock className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-bold text-yellow-900 dark:text-yellow-100">
                  {transferStats.verifying}
                </span>
              </div>
            )}
            {transferStats.error > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1 dark:bg-red-900/30">
                <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-xs font-bold text-red-900 dark:text-red-100">
                  {transferStats.error}
                </span>
              </div>
            )}
            {transferStats.pending > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 dark:bg-gray-800">
                <Clock className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {transferStats.pending}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] space-y-2 overflow-y-auto rounded-lg bg-gradient-to-br from-gray-50 to-white p-3 dark:from-gray-800/50 dark:to-gray-900/50">
          {scannedFiles.map((file, index) => {
            const filePath = file.path
            const Icon = getFileIcon(filePath)
            const fileName = filePath.split('/').pop() || filePath
            const fileType = getFileType(filePath)
            const status = getFileTransferStatus(filePath, progress)
            const checksum = getFileChecksum(filePath, progress)
            const elapsedTime = getFileElapsedTime(filePath, progress)
            
            // Format creation date and time
            const creationDate = new Date(file.birthtime)
            const formattedDate = creationDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
            const formattedTime = creationDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })

            // Status icon and colors
            const getStatusIcon = (): ReactElement => {
              switch (status) {
                case 'complete':
                  return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                case 'transferring':
                  return (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  )
                case 'verifying':
                  return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                case 'error':
                  return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                case 'skipped':
                  return <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                default:
                  return <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              }
            }

            const getStatusColor = (): string => {
              switch (status) {
                case 'complete':
                  return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                case 'transferring':
                  return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                case 'verifying':
                  return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                case 'error':
                  return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                case 'skipped':
                  return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
                default:
                  return 'bg-white border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
              }
            }

            return (
              <div
                key={index}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  getStatusColor(),
                  'hover:shadow-sm'
                )}
              >
                {/* File Icon */}
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                    fileType === 'video' &&
                      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                    fileType === 'image' &&
                      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                    fileType === 'audio' &&
                      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
                    fileType === 'other' &&
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {fileName}
                    </span>
                    {getStatusIcon()}
                  </div>

                  {/* File creation date and time */}
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Created: {formattedDate} at {formattedTime}
                    </span>
                  </div>

                  {/* Elapsed time for completed files */}
                  {elapsedTime !== null && status === 'complete' && (
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Completed in: {formatDuration(elapsedTime)}
                      </span>
                    </div>
                  )}

                  {/* Checksum for completed files */}
                  {status === 'complete' && checksum && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Checksum:</span>
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-gray-700 dark:text-gray-300">
                        {checksum}
                      </code>
                      <button
                        onClick={() => handleCopyChecksum(checksum)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedChecksum === checksum ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                      status === 'complete' &&
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                      status === 'transferring' &&
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                      status === 'verifying' &&
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                      status === 'error' &&
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                      status === 'skipped' &&
                        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                      status === 'pending' &&
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
