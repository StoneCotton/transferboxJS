/**
 * File List Component
 */

import { File, FileVideo, FileAudio, FileImage, Folder } from 'lucide-react'
import { useDriveStore } from '../store'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'

function getFileIcon(filePath: string) {
  const ext = filePath.toLowerCase().split('.').pop()

  if (['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m4v'].includes(`.${ext}`)) {
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

export function FileList() {
  const { scannedFiles, scanInProgress } = useDriveStore()

  if (scanInProgress) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Scanning for media files...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (scannedFiles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Folder className="h-16 w-16 text-gray-300 dark:text-gray-700" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No Files Found</p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Select a drive to scan for media files
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scanned Files</CardTitle>
        <CardDescription>{scannedFiles.length} media files found</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] space-y-1 overflow-y-auto">
          {scannedFiles.map((file, index) => {
            const Icon = getFileIcon(file)
            const fileName = file.split('/').pop() || file

            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-600" />
                <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
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
