/**
 * File List Component
 */

import {
  File,
  FileVideo,
  FileAudio,
  FileImage,
  Folder,
  Film,
  Music,
  ImageIcon,
  FileType
} from 'lucide-react'
import { useMemo } from 'react'
import { useDriveStore } from '../store'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { cn } from '../lib/utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getFileIcon(filePath: string) {
  const ext = filePath.toLowerCase().split('.').pop()

  if (['.MP4', '.mov', '.avi', '.mkv', '.mts', '.m4v'].includes(`.${ext}`)) {
    return FileVideo
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(`.${ext}`)) {
    return FileAudio
  }
  if (['.jpg', '.jpeg', '.png', '.raw', '.cr2', '.nef', '.arw', '.dng'].includes(`.${ext}`)) {
    return FileImage
  }
  return File
}

function getFileType(filePath: string): 'video' | 'audio' | 'image' | 'other' {
  const ext = filePath.toLowerCase().split('.').pop()

  if (['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m4v'].includes(`.${ext}`)) {
    return 'video'
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.m4a'].includes(`.${ext}`)) {
    return 'audio'
  }
  if (['.jpg', '.jpeg', '.png', '.raw', '.cr2', '.nef', '.arw', '.dng'].includes(`.${ext}`)) {
    return 'image'
  }
  return 'other'
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function FileList() {
  const { scannedFiles, scanInProgress } = useDriveStore()

  // Calculate file statistics
  const fileStats = useMemo(() => {
    const stats = {
      video: 0,
      audio: 0,
      image: 0,
      other: 0
    }

    scannedFiles.forEach((file) => {
      const type = getFileType(file)
      stats[type]++
    })

    return stats
  }, [scannedFiles])

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
              <CardTitle className="text-lg">Media Files</CardTitle>
              <CardDescription className="text-xs">
                {scannedFiles.length} file{scannedFiles.length !== 1 ? 's' : ''} ready to transfer
              </CardDescription>
            </div>
          </div>

          {/* File Type Statistics */}
          <div className="flex gap-4">
            {fileStats.video > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 dark:bg-blue-900/30">
                <Film className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  {fileStats.video}
                </span>
              </div>
            )}
            {fileStats.image > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 dark:bg-green-900/30">
                <ImageIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-900 dark:text-green-100">
                  {fileStats.image}
                </span>
              </div>
            )}
            {fileStats.audio > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 dark:bg-purple-900/30">
                <Music className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100">
                  {fileStats.audio}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-lg bg-gradient-to-br from-gray-50 to-white p-2 dark:from-gray-800/50 dark:to-gray-900/50">
          {scannedFiles.map((file, index) => {
            const Icon = getFileIcon(file)
            const fileName = file.split('/').pop() || file
            const fileType = getFileType(file)

            return (
              <div
                key={index}
                className={cn(
                  'group flex items-center gap-3 rounded-lg p-3 transition-all hover:scale-[1.02]',
                  fileType === 'video' && 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
                  fileType === 'image' && 'hover:bg-green-50 dark:hover:bg-green-950/30',
                  fileType === 'audio' && 'hover:bg-purple-50 dark:hover:bg-purple-950/30',
                  fileType === 'other' && 'hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                    fileType === 'video' &&
                      'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/30 dark:text-blue-400',
                    fileType === 'image' &&
                      'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white dark:bg-green-900/30 dark:text-green-400',
                    fileType === 'audio' &&
                      'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/30 dark:text-purple-400',
                    fileType === 'other' &&
                      'bg-gray-100 text-gray-600 group-hover:bg-gray-600 group-hover:text-white dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fileName}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
