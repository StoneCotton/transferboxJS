/**
 * Benchmark Types
 * Types for the benchmark feature that measures transfer pipeline performance
 */

/**
 * Configuration for starting a benchmark run
 */
export interface BenchmarkConfig {
  /** Device ID of the source removable drive */
  sourceDeviceId: string
  /** Path to the destination folder */
  destinationPath: string
}

/**
 * Phase of the benchmark process
 */
export type BenchmarkPhase = 'idle' | 'generating' | 'transferring' | 'verifying' | 'cleanup'

/**
 * Speed sample for graph rendering
 *
 * Note: The `phase` field uses a reduced set ('transfer' | 'verify') rather than
 * the full BenchmarkPhase type because samples are only recorded during these
 * two phases. The mapping from BenchmarkPhase is:
 * - 'transferring' -> 'transfer'
 * - 'verifying' -> 'verify'
 * Other phases (idle, generating, cleanup) don't produce speed samples.
 */
export interface SpeedSample {
  /** Timestamp in milliseconds since benchmark start */
  timestampMs: number
  /** Transfer speed in MB/s */
  speedMbps: number
  /** Current phase when sample was taken (reduced from BenchmarkPhase) */
  phase: 'transfer' | 'verify'
  /** Name of the file being processed (optional) */
  currentFile?: string
  /** CPU usage percentage (0-100) */
  cpuPercent?: number
  /** Memory usage in MB */
  memoryUsedMB?: number
}

/**
 * Benchmark result metrics
 */
export interface BenchmarkMetrics {
  /** Total bytes transferred */
  totalBytes: number
  /** Total number of files */
  totalFiles: number
  /** Total duration in milliseconds (includes generation) */
  totalDurationMs: number
  /** Transfer-only duration in milliseconds (excludes file generation) */
  transferDurationMs: number
  /** Average transfer speed in MB/s (calculated from transfer phase only) */
  avgSpeedMbps: number
  /** Peak sustained speed in MB/s */
  peakSpeedMbps: number
  /** Read speed from source in MB/s */
  readSpeedMbps: number
  /** Write speed to destination in MB/s */
  writeSpeedMbps: number
  /** Checksum calculation speed in MB/s */
  checksumSpeedMbps: number
  /** Average CPU usage during transfer (0-100) */
  avgCpuPercent?: number
  /** Peak CPU usage during transfer (0-100) */
  peakCpuPercent?: number
  /** Average memory usage during transfer in MB */
  avgMemoryMB?: number
  /** Peak memory usage during transfer in MB */
  peakMemoryMB?: number
}

/**
 * Drive information for benchmark results
 */
export interface BenchmarkDriveInfo {
  /** Display name of the drive */
  name: string
  /** Type of drive (USB, SD, SSD, HDD, etc.) */
  type: string
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** Unique identifier for the run */
  id: string
  /** When the benchmark was run */
  timestamp: Date
  /** App version when benchmark was run */
  appVersion: string
  /** Source drive information */
  sourceDrive: BenchmarkDriveInfo
  /** Destination information */
  destination: {
    /** Full path to destination folder */
    path: string
    /** Type of destination drive */
    driveType: string
  }
  /** Performance metrics */
  metrics: BenchmarkMetrics
  /** Speed samples for graph rendering */
  samples: SpeedSample[]
  /** Operating system */
  os: string
  /** Platform (darwin, win32, linux) */
  platform: string
}

/**
 * Progress event sent during benchmark
 */
export interface BenchmarkProgressEvent {
  /** Current phase */
  phase: BenchmarkPhase
  /** Overall progress percentage (0-100) */
  progress: number
  /** Current file being processed */
  currentFile?: string
  /** Current file index */
  fileIndex?: number
  /** Total file count */
  totalFiles?: number
  /** Bytes processed so far */
  bytesProcessed?: number
  /** Total bytes to process */
  totalBytes?: number
  /** Current speed in MB/s */
  currentSpeedMbps?: number
  /** Elapsed time in milliseconds */
  elapsedMs?: number
  /** Estimated time remaining in milliseconds */
  estimatedRemainingMs?: number
}

/**
 * Error event for benchmark failures
 */
export interface BenchmarkErrorEvent {
  /** Error message */
  message: string
  /** Error code if available */
  code?: string
  /** Whether cleanup was successful */
  cleanupSuccessful: boolean
  /** Partial results if any */
  partialResults?: Partial<BenchmarkResult>
}

/**
 * Database row type for benchmark_runs table
 */
export interface BenchmarkRunRow {
  id: string
  timestamp: number
  app_version: string
  source_drive_name: string
  source_drive_type: string
  destination_path: string
  destination_drive_type: string
  total_bytes: number
  total_files: number
  total_duration_ms: number
  transfer_duration_ms: number
  avg_speed_mbps: number
  peak_speed_mbps: number
  read_speed_mbps: number
  write_speed_mbps: number
  checksum_speed_mbps: number
  avg_cpu_percent: number | null
  peak_cpu_percent: number | null
  avg_memory_mb: number | null
  peak_memory_mb: number | null
  os: string
  platform: string
}

/**
 * Database row type for benchmark_samples table
 */
export interface BenchmarkSampleRow {
  id?: number
  run_id: string
  timestamp_ms: number
  speed_mbps: number
  phase: string
  current_file: string | null
  cpu_percent: number | null
  memory_used_mb: number | null
}

/**
 * Benchmark history entry (for list display)
 */
export interface BenchmarkHistoryEntry {
  id: string
  timestamp: Date
  appVersion: string
  sourceDriveName: string
  sourceDriveType: string
  destinationPath: string
  avgSpeedMbps: number
  totalBytes: number
  totalDurationMs: number
}

/**
 * Export format options
 */
export type BenchmarkExportFormat = 'json' | 'csv'

/**
 * Test file specification for benchmark
 */
export interface BenchmarkTestFile {
  /** File name with .tbench_ prefix */
  name: string
  /** Size in bytes */
  size: number
  /** Purpose/description */
  purpose: string
}

/**
 * Constants for benchmark test file set
 * Total: ~22GB - Tests both many-file overhead and large-file throughput
 */
export const BENCHMARK_TEST_FILES: BenchmarkTestFile[] = [
  // 10 x 25MB files (Photos/proxies)
  ...Array.from({ length: 10 }, (_, i) => ({
    name: `.tbench_photo_${String(i + 1).padStart(3, '0')}.dat`,
    size: 25 * 1024 * 1024, // 25MB
    purpose: 'Photos/proxies'
  })),
  // 5 x 200MB files (Short clips)
  ...Array.from({ length: 5 }, (_, i) => ({
    name: `.tbench_clip_short_${String(i + 1).padStart(3, '0')}.dat`,
    size: 200 * 1024 * 1024, // 200MB
    purpose: 'Short clips'
  })),
  // 3 x 1GB files (Medium clips)
  ...Array.from({ length: 3 }, (_, i) => ({
    name: `.tbench_clip_medium_${String(i + 1).padStart(3, '0')}.dat`,
    size: 1024 * 1024 * 1024, // 1GB
    purpose: 'Medium clips'
  })),
  // 1 x 5GB file (Large clip)
  {
    name: '.tbench_clip_large_001.dat',
    size: 5 * 1024 * 1024 * 1024, // 5GB
    purpose: 'Large clip'
  },
  // 1 x 10GB file (Long-form video)
  {
    name: '.tbench_video_longform_001.dat',
    size: 10 * 1024 * 1024 * 1024, // 10GB
    purpose: 'Long-form video'
  }
]

/**
 * Calculate total benchmark test file size
 */
export function getBenchmarkTotalSize(): number {
  return BENCHMARK_TEST_FILES.reduce((total, file) => total + file.size, 0)
}

/**
 * Prefix used to identify benchmark test files
 */
export const BENCHMARK_FILE_PREFIX = '.tbench_'

/**
 * Required free space (with buffer) in bytes (~25GB)
 */
export const BENCHMARK_REQUIRED_SPACE = 25 * 1024 * 1024 * 1024

/**
 * Default number of benchmark runs to retain
 */
export const BENCHMARK_DEFAULT_RETENTION = 50

/**
 * Speed sample interval in milliseconds
 */
export const BENCHMARK_SAMPLE_INTERVAL_MS = 500
