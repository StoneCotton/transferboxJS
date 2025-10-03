/**
 * Drive Selector Component
 */

import { HardDrive, Loader2, Usb } from 'lucide-react'
import { useDriveStore } from '../store'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { formatBytes, cn } from '../lib/utils'
import type { DriveInfo } from '../../../shared/types'

export function DriveSelector() {
  const { detectedDrives, selectedDrive, selectDrive, scanInProgress } = useDriveStore()

  const handleSelectDrive = (drive: DriveInfo) => {
    selectDrive(drive)
  }

  if (detectedDrives.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <HardDrive className="h-16 w-16 text-gray-300 dark:text-gray-700" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No Drives Detected
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Insert an SD card or USB drive to begin
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected Drives</CardTitle>
        <CardDescription>Select a drive to scan for media files</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {detectedDrives.map((drive) => {
            const isSelected = selectedDrive?.device === drive.device
            const isScanningThis = scanInProgress && isSelected

            return (
              <button
                key={drive.device}
                onClick={() => handleSelectDrive(drive)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-all',
                  'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-800'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      isSelected
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {isScanningThis ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : drive.busType === 'USB' ? (
                      <Usb className="h-6 w-6" />
                    ) : (
                      <HardDrive className="h-6 w-6" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {drive.displayName}
                      </h3>
                      {isSelected && !isScanningThis && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Selected
                        </span>
                      )}
                      {isScanningThis && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Scanning...
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                      {drive.description} • {formatBytes(drive.size)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                      {drive.mountpoints[0] || drive.device}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
