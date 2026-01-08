/**
 * Status Bar Component
 */

import { CheckCircle2, Info, Activity, HardDrive, Files, FolderOpen } from 'lucide-react'
import { useDriveStore, useTransferStore, useUIStore } from '../store'
import { useUiDensity } from '../hooks/useUiDensity'
import { cn } from '../lib/utils'

export function StatusBar() {
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { isTransferring } = useTransferStore()
  const { selectedDestination } = useUIStore()
  const { isCondensed } = useUiDensity()

  const canTransfer = selectedDrive && scannedFiles.length > 0 && selectedDestination

  return (
    <div
      className={cn(
        'relative flex items-center justify-between border-t backdrop-blur-xl transition-all',
        isCondensed ? 'px-3 py-2' : 'px-6 py-4',
        canTransfer
          ? 'border-green-300/50 bg-gradient-to-r from-green-50/90 via-emerald-50/90 to-teal-50/90 dark:border-green-700/50 dark:from-green-950/90 dark:via-emerald-950/90 dark:to-teal-950/90'
          : 'border-gray-200/50 bg-gray-50/90 dark:border-gray-800/50 dark:bg-gray-900/90'
      )}
    >
      {/* Top gradient accent */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 h-0.5 transition-all',
          canTransfer
            ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500'
            : 'bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700'
        )}
      />

      <div className={cn('flex items-center', isCondensed ? 'gap-2' : 'gap-3')}>
        {/* Status Icon and Text */}
        <div
          className={cn(
            'flex items-center justify-center rounded-lg shadow-lg',
            isCondensed ? 'h-6 w-6' : 'h-9 w-9',
            canTransfer
              ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          )}
        >
          {canTransfer ? (
            <CheckCircle2 className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
          ) : (
            <Info className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
          )}
        </div>
        <div>
          <p
            className={cn(
              'font-bold',
              isCondensed ? 'text-xs' : 'text-sm',
              canTransfer
                ? 'text-green-900 dark:text-green-100'
                : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {canTransfer ? 'Ready' : 'Setup'}
          </p>
          {!isCondensed && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {!selectedDrive
                ? 'Insert a drive to begin'
                : !selectedDestination
                  ? 'Select a destination folder'
                  : scannedFiles.length === 0
                    ? 'No media files found'
                    : 'All systems ready'}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={cn('flex items-center', isCondensed ? 'gap-2' : 'gap-6')}>
        {selectedDrive && (
          <div
            className={cn(
              'flex items-center rounded-lg bg-white/60 shadow-sm dark:bg-gray-800/60',
              isCondensed ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
            )}
          >
            <HardDrive
              className={cn(
                'text-blue-600 dark:text-blue-400',
                isCondensed ? 'h-3 w-3' : 'h-4 w-4'
              )}
            />
            {isCondensed ? (
              <span className="max-w-[60px] truncate text-[10px] font-bold text-gray-900 dark:text-white">
                {selectedDrive.volumeLabel || selectedDrive.displayName}
              </span>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Drive
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {selectedDrive.volumeLabel || selectedDrive.displayName}
                </span>
              </div>
            )}
          </div>
        )}
        {selectedDestination && (
          <div
            className={cn(
              'flex items-center rounded-lg bg-white/60 shadow-sm dark:bg-gray-800/60',
              isCondensed ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
            )}
          >
            <FolderOpen
              className={cn(
                'text-indigo-600 dark:text-indigo-400',
                isCondensed ? 'h-3 w-3' : 'h-4 w-4'
              )}
            />
            {isCondensed ? (
              <span className="max-w-[60px] truncate text-[10px] font-bold text-gray-900 dark:text-white">
                {selectedDestination.split('/').pop() || selectedDestination}
              </span>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Destination
                </span>
                <span className="max-w-[200px] truncate text-xs font-bold text-gray-900 dark:text-white">
                  {selectedDestination.split('/').pop() || selectedDestination}
                </span>
              </div>
            )}
          </div>
        )}
        {scannedFiles.length > 0 && (
          <div
            className={cn(
              'flex items-center rounded-lg bg-white/60 shadow-sm dark:bg-gray-800/60',
              isCondensed ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
            )}
          >
            <Files
              className={cn(
                'text-purple-600 dark:text-purple-400',
                isCondensed ? 'h-3 w-3' : 'h-4 w-4'
              )}
            />
            {isCondensed ? (
              <span className="text-[10px] font-bold text-gray-900 dark:text-white">
                {scannedFiles.length}
              </span>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Files
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {scannedFiles.length}
                </span>
              </div>
            )}
          </div>
        )}
        {isTransferring && (
          <div
            className={cn(
              'flex items-center rounded-lg bg-blue-100 shadow-lg dark:bg-blue-900/50',
              isCondensed ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
            )}
          >
            <Activity
              className={cn(
                'animate-pulse text-blue-600 dark:text-blue-400',
                isCondensed ? 'h-3 w-3' : 'h-4 w-4'
              )}
            />
            {isCondensed ? (
              <span className="text-[10px] font-bold text-blue-900 dark:text-blue-100">Active</span>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Status
                </span>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  Transferring
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
