/**
 * Benchmark Store Slice
 * Manages benchmark state in the renderer process
 */

import type { StateCreator } from 'zustand'
import type {
  BenchmarkPhase,
  BenchmarkResult,
  BenchmarkHistoryEntry,
  SpeedSample,
  BenchmarkProgressEvent
} from '../../../../shared/types'

/**
 * Benchmark state interface
 * Note: Property names prefixed with 'benchmark' to avoid collision with other slices
 */
export interface BenchmarkState {
  /** Whether a benchmark is currently running */
  benchmarkIsRunning: boolean
  /** Current phase of the benchmark */
  benchmarkPhase: BenchmarkPhase
  /** Progress percentage (0-100) */
  benchmarkProgress: number
  /** Current file being processed */
  benchmarkCurrentFile: string | null
  /** Current file index */
  benchmarkFileIndex: number
  /** Total files in benchmark */
  benchmarkTotalFiles: number
  /** Bytes processed so far */
  benchmarkBytesProcessed: number
  /** Total bytes to process */
  benchmarkTotalBytes: number
  /** Current speed in MB/s */
  benchmarkSpeedMbps: number
  /** Elapsed time in milliseconds */
  benchmarkElapsedMs: number
  /** Estimated remaining time in milliseconds */
  benchmarkRemainingMs: number | null
  /** Speed samples for graph */
  benchmarkSamples: SpeedSample[]
  /** Current benchmark result (after completion) */
  benchmarkResult: BenchmarkResult | null
  /** Historical benchmark runs */
  benchmarkHistory: BenchmarkHistoryEntry[]
  /** Error message if benchmark failed */
  benchmarkError: string | null
  /** IDs selected for comparison */
  benchmarkComparisonIds: string[]
}

/**
 * Benchmark slice actions
 */
export interface BenchmarkSlice extends BenchmarkState {
  // Actions
  startBenchmark: () => void
  updateBenchmarkProgress: (event: BenchmarkProgressEvent) => void
  addBenchmarkSample: (sample: SpeedSample) => void
  completeBenchmark: (result: BenchmarkResult) => void
  failBenchmark: (error: string) => void
  cancelBenchmark: () => void
  resetBenchmark: () => void
  setBenchmarkHistory: (history: BenchmarkHistoryEntry[]) => void
  addToBenchmarkHistory: (entry: BenchmarkHistoryEntry) => void
  removeFromBenchmarkHistory: (id: string) => void
  setBenchmarkResult: (result: BenchmarkResult | null) => void
  toggleBenchmarkComparison: (id: string) => void
  clearBenchmarkComparison: () => void
}

const initialState: BenchmarkState = {
  benchmarkIsRunning: false,
  benchmarkPhase: 'idle',
  benchmarkProgress: 0,
  benchmarkCurrentFile: null,
  benchmarkFileIndex: 0,
  benchmarkTotalFiles: 0,
  benchmarkBytesProcessed: 0,
  benchmarkTotalBytes: 0,
  benchmarkSpeedMbps: 0,
  benchmarkElapsedMs: 0,
  benchmarkRemainingMs: null,
  benchmarkSamples: [],
  benchmarkResult: null,
  benchmarkHistory: [],
  benchmarkError: null,
  benchmarkComparisonIds: []
}

/**
 * Create benchmark slice
 */
export const createBenchmarkSlice: StateCreator<BenchmarkSlice> = (set) => ({
  ...initialState,

  startBenchmark: () =>
    set({
      benchmarkIsRunning: true,
      benchmarkPhase: 'generating',
      benchmarkProgress: 0,
      benchmarkCurrentFile: null,
      benchmarkFileIndex: 0,
      benchmarkTotalFiles: 0,
      benchmarkBytesProcessed: 0,
      benchmarkTotalBytes: 0,
      benchmarkSpeedMbps: 0,
      benchmarkElapsedMs: 0,
      benchmarkRemainingMs: null,
      benchmarkSamples: [],
      benchmarkResult: null,
      benchmarkError: null
    }),

  updateBenchmarkProgress: (event: BenchmarkProgressEvent) =>
    set({
      benchmarkPhase: event.phase,
      benchmarkProgress: event.progress,
      benchmarkCurrentFile: event.currentFile || null,
      benchmarkFileIndex: event.fileIndex || 0,
      benchmarkTotalFiles: event.totalFiles || 0,
      benchmarkBytesProcessed: event.bytesProcessed || 0,
      benchmarkTotalBytes: event.totalBytes || 0,
      benchmarkSpeedMbps: event.currentSpeedMbps || 0,
      benchmarkElapsedMs: event.elapsedMs || 0,
      benchmarkRemainingMs: event.estimatedRemainingMs || null
    }),

  addBenchmarkSample: (sample: SpeedSample) =>
    set((state) => ({
      benchmarkSamples: [...state.benchmarkSamples, sample]
    })),

  completeBenchmark: (result: BenchmarkResult) =>
    set((state) => ({
      benchmarkIsRunning: false,
      benchmarkPhase: 'idle',
      benchmarkResult: result,
      benchmarkSamples: result.samples,
      // Add to history
      benchmarkHistory: [
        {
          id: result.id,
          timestamp: result.timestamp,
          appVersion: result.appVersion,
          sourceDriveName: result.sourceDrive.name,
          sourceDriveType: result.sourceDrive.type,
          destinationPath: result.destination.path,
          avgSpeedMbps: result.metrics.avgSpeedMbps,
          totalBytes: result.metrics.totalBytes,
          totalDurationMs: result.metrics.totalDurationMs
        },
        ...state.benchmarkHistory
      ]
    })),

  failBenchmark: (error: string) =>
    set({
      benchmarkIsRunning: false,
      benchmarkPhase: 'idle',
      benchmarkError: error
    }),

  cancelBenchmark: () =>
    set({
      benchmarkIsRunning: false,
      benchmarkPhase: 'idle',
      benchmarkProgress: 0,
      benchmarkCurrentFile: null,
      benchmarkSamples: []
    }),

  resetBenchmark: () => set(initialState),

  setBenchmarkHistory: (history: BenchmarkHistoryEntry[]) => set({ benchmarkHistory: history }),

  addToBenchmarkHistory: (entry: BenchmarkHistoryEntry) =>
    set((state) => ({
      benchmarkHistory: [entry, ...state.benchmarkHistory]
    })),

  removeFromBenchmarkHistory: (id: string) =>
    set((state) => ({
      benchmarkHistory: state.benchmarkHistory.filter((h) => h.id !== id),
      benchmarkComparisonIds: state.benchmarkComparisonIds.filter((cid) => cid !== id)
    })),

  setBenchmarkResult: (result: BenchmarkResult | null) => set({ benchmarkResult: result }),

  toggleBenchmarkComparison: (id: string) =>
    set((state) => {
      const exists = state.benchmarkComparisonIds.includes(id)
      if (exists) {
        return { benchmarkComparisonIds: state.benchmarkComparisonIds.filter((cid) => cid !== id) }
      }
      // Max 3 comparisons
      if (state.benchmarkComparisonIds.length >= 3) {
        return state
      }
      return { benchmarkComparisonIds: [...state.benchmarkComparisonIds, id] }
    }),

  clearBenchmarkComparison: () => set({ benchmarkComparisonIds: [] })
})
