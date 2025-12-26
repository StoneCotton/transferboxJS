/**
 * Transfer Stats Grid Component
 * Displays transfer statistics (files, size, speed, elapsed, ETA)
 */

import { FileCheck, HardDriveDownload, Zap, Clock } from 'lucide-react'
import { formatBytes, formatSpeed, formatTime, cn } from '../../lib/utils'
import type { UnitSystem } from '../../../../shared/types'

interface TransferProgress {
  totalFiles: number
  completedFilesCount: number
  transferredBytes: number
  totalBytes: number
  transferSpeed: number
  elapsedTime: number
  eta: number
}

export interface TransferStatsGridProps {
  progress: TransferProgress
  unitSystem: UnitSystem
  isCondensed: boolean
}

export function TransferStatsGrid({
  progress,
  unitSystem,
  isCondensed
}: TransferStatsGridProps): React.ReactElement {
  return (
    <div
      className={cn(
        'grid',
        isCondensed ? 'grid-cols-3 gap-2 md:grid-cols-5' : 'grid-cols-2 gap-4 md:grid-cols-5'
      )}
    >
      {/* Files */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 shadow-lg dark:from-brand-900/30 dark:to-brand-950/30',
          isCondensed ? 'p-2' : 'p-4'
        )}
      >
        {!isCondensed && (
          <div className="absolute right-2 top-2 opacity-10">
            <FileCheck className="h-12 w-12" />
          </div>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center font-semibold text-brand-600 dark:text-brand-400',
              isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
            )}
          >
            <FileCheck className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            <span>Files</span>
          </div>
          <p
            className={cn(
              'font-black text-brand-900 dark:text-brand-100',
              isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
            )}
          >
            {progress.completedFilesCount}/{progress.totalFiles}
          </p>
        </div>
      </div>

      {/* Size */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-lg dark:from-slate-900/30 dark:to-slate-950/30',
          isCondensed ? 'p-2' : 'p-4'
        )}
      >
        {!isCondensed && (
          <div className="absolute right-2 top-2 opacity-10">
            <HardDriveDownload className="h-12 w-12" />
          </div>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center font-semibold text-slate-600 dark:text-slate-400',
              isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
            )}
          >
            <HardDriveDownload className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            <span>Size</span>
          </div>
          <p
            className={cn(
              'font-black text-slate-900 dark:text-slate-100',
              isCondensed ? 'mt-1 text-xs' : 'mt-2 text-lg'
            )}
          >
            {formatBytes(progress.transferredBytes, unitSystem)}
          </p>
          {!isCondensed && (
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              of {formatBytes(progress.totalBytes, unitSystem)}
            </p>
          )}
        </div>
      </div>

      {/* Speed */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 shadow-lg dark:from-orange-900/30 dark:to-orange-950/30',
          isCondensed ? 'p-2' : 'p-4'
        )}
      >
        {!isCondensed && (
          <div className="absolute right-2 top-2 opacity-10">
            <Zap className="h-12 w-12" />
          </div>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center font-semibold text-orange-600 dark:text-orange-400',
              isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
            )}
          >
            <Zap className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            <span>Speed</span>
          </div>
          <p
            className={cn(
              'font-black text-orange-900 dark:text-orange-100',
              isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
            )}
          >
            {formatSpeed(progress.transferSpeed)}
          </p>
        </div>
      </div>

      {/* Elapsed Time */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 shadow-lg dark:from-purple-900/30 dark:to-purple-950/30',
          isCondensed ? 'p-2' : 'p-4'
        )}
      >
        {!isCondensed && (
          <div className="absolute right-2 top-2 opacity-10">
            <Clock className="h-12 w-12" />
          </div>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center font-semibold text-purple-600 dark:text-purple-400',
              isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
            )}
          >
            <Clock className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            <span>{isCondensed ? 'Time' : 'Elapsed Time'}</span>
          </div>
          <p
            className={cn(
              'font-black text-purple-900 dark:text-purple-100',
              isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
            )}
          >
            {formatTime(progress.elapsedTime)}
          </p>
        </div>
      </div>

      {/* ETA */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-pink-50 shadow-lg dark:from-pink-900/30 dark:to-pink-950/30',
          isCondensed ? 'p-2' : 'p-4'
        )}
      >
        {!isCondensed && (
          <div className="absolute right-2 top-2 opacity-10">
            <Clock className="h-12 w-12" />
          </div>
        )}
        <div className="relative">
          <div
            className={cn(
              'flex items-center font-semibold text-pink-600 dark:text-pink-400',
              isCondensed ? 'gap-1 text-[10px]' : 'gap-2 text-xs'
            )}
          >
            <Clock className={isCondensed ? 'h-3 w-3' : 'h-4 w-4'} />
            <span>{isCondensed ? 'ETA' : 'Remaining'}</span>
          </div>
          <p
            className={cn(
              'font-black text-pink-900 dark:text-pink-100',
              isCondensed ? 'mt-1 text-sm' : 'mt-2 text-2xl'
            )}
          >
            {progress.eta > 0 ? formatTime(progress.eta) : '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
