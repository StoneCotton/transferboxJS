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
import { useUiDensity } from '../hooks/useUiDensity'
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
  const { isCondensed } = useUiDensity()
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
        <CardContent className={cn(
          'flex flex-col items-center justify-center',
          isCondensed ? 'py-8' : 'py-16'
        )}>
          <div className="relative">
            <div className={cn(
              'absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600',
              isCondensed && 'border-2'
            )} />
            <div className={isCondensed ? 'h-10 w-10' : 'h-16 w-16'} />
          </div>
          <p className={cn(
            'font-semibold text-gray-900 dark:text-white',
            isCondensed ? 'mt-4 text-base' : 'mt-6 text-lg'
          )}>
            Scanning for Media Files
          </p>
          {!isCondensed && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This may take a moment...</p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (scannedFiles.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-white/50 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/50">
        <CardContent className={cn(
          'flex flex-col items-center justify-center',
          isCondensed ? 'py-8' : 'py-16'
        )}>
          <div className="relative">
            <div className={cn(
              'flex items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
              isCondensed ? 'h-14 w-14' : 'h-20 w-20'
            )}>
              <Folder className={isCondensed ? 'h-7 w-7 text-purple-600 dark:text-purple-400' : 'h-10 w-10 text-purple-600 dark:text-purple-400'} />
            </div>
          </div>
          <p className={cn(
            'font-bold text-gray-900 dark:text-white',
            isCondensed ? 'mt-4 text-base' : 'mt-6 text-xl'
          )}>No Files Found</p>
          <p className={cn(
            'text-center text-gray-600 dark:text-gray-400',
            isCondensed ? 'mt-1 text-xs' : 'mt-2 text-sm'
          )}>
            Select a drive to scan for media files
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-white/70 shadow-xl shadow-purple-500/10 backdrop-blur-sm dark:bg-gray-900/70">
      <CardHeader className={isCondensed ? 'p-3' : undefined}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30',
              isCondensed ? 'h-6 w-6' : 'h-8 w-8'
            )}>
              <FileType className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            </div>
            <div>
              <CardTitle className={isCondensed ? 'text-sm' : 'text-lg'}>Transfer Queue</CardTitle>
              <CardDescription className="text-xs">
                {scannedFiles.length} file{scannedFiles.length !== 1 ? 's' : ''} in queue
              </CardDescription>
            </div>
          </div>

          {/* Transfer Status Statistics */}
          <div className={cn('flex', isCondensed ? 'gap-1' : 'gap-2')}>
            {transferStats.complete > 0 && (
              <div className={cn(
                'flex items-center rounded-lg bg-green-100 dark:bg-green-900/30',
                isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
              )}>
                <CheckCircle2 className={cn('text-green-600 dark:text-green-400', isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                <span className={cn('font-bold text-green-900 dark:text-green-100', isCondensed ? 'text-[10px]' : 'text-xs')}>
                  {transferStats.complete}
                </span>
              </div>
            )}
            {transferStats.transferring > 0 && (
              <div className={cn(
                'flex items-center rounded-lg bg-blue-100 dark:bg-blue-900/30',
                isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
              )}>
                <Loader2 className={cn('animate-spin text-blue-600 dark:text-blue-400', isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                <span className={cn('font-bold text-blue-900 dark:text-blue-100', isCondensed ? 'text-[10px]' : 'text-xs')}>
                  {transferStats.transferring}
                </span>
              </div>
            )}
            {transferStats.verifying > 0 && (
              <div className={cn(
                'flex items-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30',
                isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
              )}>
                <Clock className={cn('text-yellow-600 dark:text-yellow-400', isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                <span className={cn('font-bold text-yellow-900 dark:text-yellow-100', isCondensed ? 'text-[10px]' : 'text-xs')}>
                  {transferStats.verifying}
                </span>
              </div>
            )}
            {transferStats.error > 0 && (
              <div className={cn(
                'flex items-center rounded-lg bg-red-100 dark:bg-red-900/30',
                isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
              )}>
                <XCircle className={cn('text-red-600 dark:text-red-400', isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                <span className={cn('font-bold text-red-900 dark:text-red-100', isCondensed ? 'text-[10px]' : 'text-xs')}>
                  {transferStats.error}
                </span>
              </div>
            )}
            {transferStats.pending > 0 && (
              <div className={cn(
                'flex items-center rounded-lg bg-gray-100 dark:bg-gray-800',
                isCondensed ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'
              )}>
                <Clock className={cn('text-gray-600 dark:text-gray-400', isCondensed ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                <span className={cn('font-bold text-gray-900 dark:text-gray-100', isCondensed ? 'text-[10px]' : 'text-xs')}>
                  {transferStats.pending}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={isCondensed ? 'p-3 pt-0' : undefined}>
        <div className={cn(
          'overflow-y-auto rounded-lg bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50',
          isCondensed ? 'max-h-[300px] space-y-1 p-2' : 'max-h-[500px] space-y-2 p-3'
        )}>
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
                  'group flex items-center rounded-lg border transition-colors',
                  isCondensed ? 'gap-2 p-2' : 'gap-3 p-3',
                  getStatusColor(),
                  'hover:shadow-sm'
                )}
              >
                {/* File Icon */}
                <div
                  className={cn(
                    'flex flex-shrink-0 items-center justify-center rounded-lg',
                    isCondensed ? 'h-7 w-7' : 'h-10 w-10',
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
                  <Icon className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'truncate font-medium text-gray-900 dark:text-gray-100',
                      isCondensed ? 'text-xs' : 'text-sm'
                    )}>
                      {fileName}
                    </span>
                    {isCondensed ? null : getStatusIcon()}
                  </div>

                  {/* File creation date and time - hide in condensed mode */}
                  {!isCondensed && (
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Created: {formattedDate} at {formattedTime}
                      </span>
                    </div>
                  )}

                  {/* Elapsed time for completed files - hide in condensed mode */}
                  {!isCondensed && elapsedTime !== null && status === 'complete' && (
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Completed in: {formatDuration(elapsedTime)}
                      </span>
                    </div>
                  )}

                  {/* Checksum for completed files - hide in condensed mode */}
                  {!isCondensed && status === 'complete' && checksum && (
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
                      'inline-flex items-center rounded-full font-medium',
                      isCondensed ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
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
                    {isCondensed
                      ? status.charAt(0).toUpperCase()
                      : status.charAt(0).toUpperCase() + status.slice(1)}
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
