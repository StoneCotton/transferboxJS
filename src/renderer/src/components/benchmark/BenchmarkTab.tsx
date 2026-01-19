/**
 * BenchmarkTab Component
 * Settings tab for running and viewing benchmarks
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Play,
  FolderOpen,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  HardDrive
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Progress } from '../ui/Progress'
import { SpeedGraph } from './SpeedGraph'
import { useBenchmarkStore, useDriveStore, useTransferStore } from '../../store'
import { cn } from '../../lib/utils'
import type { BenchmarkHistoryEntry, DriveInfo } from '../../../../shared/types'
import { BENCHMARK_REQUIRED_SPACE, getBenchmarkTotalSize } from '../../../../shared/types/benchmark'

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Get phase display name
 */
function getPhaseDisplayName(phase: string): string {
  switch (phase) {
    case 'generating':
      return 'Generating test files...'
    case 'transferring':
      return 'Transferring files...'
    case 'verifying':
      return 'Verifying checksums...'
    case 'cleanup':
      return 'Cleaning up...'
    default:
      return 'Idle'
  }
}

export function BenchmarkTab() {
  const { detectedDrives } = useDriveStore()
  const { isTransferring } = useTransferStore()
  const {
    isRunning,
    currentPhase,
    progress,
    currentFile,
    currentFileIndex,
    totalFiles,
    bytesProcessed,
    totalBytes,
    currentSpeedMbps,
    elapsedMs,
    estimatedRemainingMs,
    speedSamples,
    currentResult,
    history,
    error,
    startBenchmark,
    updateProgress,
    addSpeedSample,
    completeBenchmark,
    failBenchmark,
    cancelBenchmark,
    setHistory,
    removeFromHistory,
    setCurrentResult
  } = useBenchmarkStore()

  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null)
  const [destinationPath, setDestinationPath] = useState<string>('')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)

  // Available removable drives for benchmark
  const removableDrives = detectedDrives.filter((d) => d.isRemovable || d.busType === 'USB')

  // Load benchmark history on mount
  useEffect(() => {
    window.api.getBenchmarkHistory().then(setHistory).catch(console.error)
  }, [setHistory])

  // Set up IPC event listeners
  useEffect(() => {
    const unsubProgress = window.api.onBenchmarkProgress(updateProgress)
    const unsubSample = window.api.onBenchmarkSpeedSample(addSpeedSample)
    const unsubComplete = window.api.onBenchmarkComplete((result) => {
      completeBenchmark(result)
      setShowProgressModal(false)
      setShowResultsModal(true)
    })
    const unsubError = window.api.onBenchmarkError((err) => {
      failBenchmark(err.message)
      setShowProgressModal(false)
    })

    return () => {
      unsubProgress()
      unsubSample()
      unsubComplete()
      unsubError()
    }
  }, [updateProgress, addSpeedSample, completeBenchmark, failBenchmark])

  // Select destination folder
  const handleSelectDestination = async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setDestinationPath(folder)
    }
  }

  // Start benchmark
  const handleRunBenchmark = async () => {
    if (!selectedDrive || !destinationPath) return

    startBenchmark()
    setShowProgressModal(true)

    try {
      await window.api.startBenchmark({
        sourceDeviceId: selectedDrive.mountpoints[0] || selectedDrive.device,
        destinationPath
      })
    } catch (err) {
      failBenchmark(err instanceof Error ? err.message : 'Failed to start benchmark')
      setShowProgressModal(false)
    }
  }

  // Cancel benchmark
  const handleCancelBenchmark = async () => {
    await window.api.cancelBenchmark()
    cancelBenchmark()
    setShowProgressModal(false)
  }

  // Delete history entry
  const handleDeleteHistory = async (id: string) => {
    await window.api.deleteBenchmark(id)
    removeFromHistory(id)
  }

  // View history entry details
  const handleViewResult = async (entry: BenchmarkHistoryEntry) => {
    const result = await window.api.getBenchmarkResult(entry.id)
    if (result) {
      setCurrentResult(result)
      setShowResultsModal(true)
    }
  }

  // Export benchmarks
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    const ids = history.map((h) => h.id)
    if (ids.length === 0) return

    const content = await window.api.exportBenchmarks(ids, format)

    // Create download
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmark-results.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [history])

  const canRunBenchmark = selectedDrive && destinationPath && !isRunning && !isTransferring
  const requiredSpaceGB = (BENCHMARK_REQUIRED_SPACE / (1024 * 1024 * 1024)).toFixed(0)
  const testSetSizeGB = (getBenchmarkTotalSize() / (1024 * 1024 * 1024)).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div>
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Run Benchmark
        </h4>

        <div className="space-y-4">
          {/* Source Drive Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Source Drive
            </label>
            <select
              value={selectedDrive?.device || ''}
              onChange={(e) => {
                const drive = removableDrives.find((d) => d.device === e.target.value)
                setSelectedDrive(drive || null)
              }}
              disabled={isRunning || isTransferring}
              className={cn(
                'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
                'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'dark:border-gray-600 dark:bg-gray-800 dark:text-white'
              )}
            >
              <option value="">Select a removable drive...</option>
              {removableDrives.map((drive) => (
                <option key={drive.device} value={drive.device}>
                  {drive.displayName} ({drive.mountpoints[0] || drive.device})
                </option>
              ))}
            </select>
            {removableDrives.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No removable drives detected. Please insert a USB drive or SD card.
              </p>
            )}
          </div>

          {/* Destination Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Destination
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={destinationPath}
                readOnly
                placeholder="Select destination folder..."
                className={cn(
                  'flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500'
                )}
              />
              <Button
                onClick={handleSelectDestination}
                disabled={isRunning || isTransferring}
                variant="outline"
                size="sm"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p>
                  Requires ~{requiredSpaceGB}GB free space on both drives.
                </p>
                <p className="mt-1 text-blue-700 dark:text-blue-300">
                  Test set: 20 files (25MB - 10GB) totaling ~{testSetSizeGB}GB
                </p>
              </div>
            </div>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRunBenchmark}
            disabled={!canRunBenchmark}
            className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/20"
          >
            <Play className="mr-2 h-4 w-4" />
            Run Benchmark
          </Button>

          {isTransferring && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400">
              Cannot run benchmark while a transfer is in progress
            </p>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* History Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Previous Results
          </h4>
          {history.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={() => handleExport('json')} variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                JSON
              </Button>
              <Button onClick={() => handleExport('csv')} variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/30">
            <Zap className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No benchmark results yet. Run a benchmark to see results here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        v{entry.appVersion}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>
                        {entry.sourceDriveName} ({entry.sourceDriveType}) → {entry.destinationPath.split('/').pop()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-brand-500" />
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {entry.avgSpeedMbps.toFixed(0)} MB/s
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(entry.totalBytes)} in {formatDuration(entry.totalDurationMs)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      onClick={() => handleViewResult(entry)}
                      variant="outline"
                      size="sm"
                    >
                      View
                    </Button>
                    <Button
                      onClick={() => handleDeleteHistory(entry.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {}}
        size="xl"
        hideHeader
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Running Benchmark
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {getPhaseDisplayName(currentPhase)}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              {currentFileIndex > 0 && `File ${currentFileIndex} of ${totalFiles}`}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progress} className="h-3" />
            <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{progress}%</span>
              <span>
                {formatBytes(bytesProcessed)} / {formatBytes(totalBytes)}
              </span>
            </div>
          </div>

          {/* Speed Graph */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <SpeedGraph
              samples={speedSamples}
              height={180}
              isLive={true}
              showLegend={true}
            />
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-5 gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 p-3 dark:from-blue-950/50 dark:to-blue-900/30">
              <p className="text-xs text-blue-600 dark:text-blue-400">Current</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {currentSpeedMbps.toFixed(0)} MB/s
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 p-3 dark:from-brand-950/50 dark:to-brand-900/30">
              <p className="text-xs text-brand-600 dark:text-brand-400">Average</p>
              <p className="text-lg font-bold text-brand-900 dark:text-brand-100">
                {speedSamples.length > 0
                  ? (speedSamples.reduce((a, b) => a + b.speedMbps, 0) / speedSamples.length).toFixed(0)
                  : '0'} MB/s
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-green-100 to-green-50 p-3 dark:from-green-950/50 dark:to-green-900/30">
              <p className="text-xs text-green-600 dark:text-green-400">Peak</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">
                {speedSamples.length > 0
                  ? Math.max(...speedSamples.map((s) => s.speedMbps)).toFixed(0)
                  : '0'} MB/s
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 p-3 dark:from-slate-800/50 dark:to-slate-700/30">
              <p className="text-xs text-slate-600 dark:text-slate-400">Elapsed</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatDuration(elapsedMs)}
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 p-3 dark:from-slate-800/50 dark:to-slate-700/30">
              <p className="text-xs text-slate-600 dark:text-slate-400">Remaining</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {estimatedRemainingMs ? `~${formatDuration(estimatedRemainingMs)}` : '--'}
              </p>
            </div>
          </div>

          {/* Current File */}
          {currentFile && (
            <p className="mb-6 truncate text-sm text-gray-500 dark:text-gray-400">
              Current file: {currentFile}
            </p>
          )}

          {/* Cancel Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleCancelBenchmark}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Cancel Benchmark
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        size="xl"
        title="Benchmark Complete"
      >
        {currentResult && (
          <div className="p-6">
            {/* Speed Graph */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <SpeedGraph
                samples={currentResult.samples}
                height={180}
                showLegend={true}
                showFileMarkers={true}
              />
            </div>

            {/* Summary Stats */}
            <div className="mb-6 grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 p-4 dark:from-brand-950/50 dark:to-brand-900/30">
                <p className="text-xs text-brand-600 dark:text-brand-400">Average Speed</p>
                <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">
                  {currentResult.metrics.avgSpeedMbps.toFixed(0)} MB/s
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-green-100 to-green-50 p-4 dark:from-green-950/50 dark:to-green-900/30">
                <p className="text-xs text-green-600 dark:text-green-400">Peak Speed</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {currentResult.metrics.peakSpeedMbps.toFixed(0)} MB/s
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 p-4 dark:from-blue-950/50 dark:to-blue-900/30">
                <p className="text-xs text-blue-600 dark:text-blue-400">Total Time</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatDuration(currentResult.metrics.totalDurationMs)}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 p-4 dark:from-purple-950/50 dark:to-purple-900/30">
                <p className="text-xs text-purple-600 dark:text-purple-400">Data Transferred</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatBytes(currentResult.metrics.totalBytes)}
                </p>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Detailed Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Read Speed</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentResult.metrics.readSpeedMbps.toFixed(1)} MB/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Write Speed</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentResult.metrics.writeSpeedMbps.toFixed(1)} MB/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Checksum Speed</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentResult.metrics.checksumSpeedMbps.toFixed(1)} MB/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Files Transferred</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentResult.metrics.totalFiles}
                  </span>
                </div>
              </div>
            </div>

            {/* Test Info */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Test Details
              </h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <span className="text-gray-500">Source:</span>{' '}
                  {currentResult.sourceDrive.name} ({currentResult.sourceDrive.type})
                </p>
                <p>
                  <span className="text-gray-500">Destination:</span>{' '}
                  {currentResult.destination.path}
                </p>
                <p>
                  <span className="text-gray-500">App Version:</span>{' '}
                  {currentResult.appVersion}
                </p>
                <p>
                  <span className="text-gray-500">Platform:</span>{' '}
                  {currentResult.os}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowResultsModal(false)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
