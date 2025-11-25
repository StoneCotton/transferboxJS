/**
 * Database row type definitions for SQLite queries
 * Provides type safety for database operations
 */

/**
 * Raw session row from transfer_sessions table
 */
export interface TransferSessionRow {
  id: string
  drive_id: string
  drive_name: string
  source_root: string
  destination_root: string
  start_time: number
  end_time: number | null
  status: string
  file_count: number
  total_bytes: number
  error_message: string | null
}

/**
 * Raw file row from transfer_files table
 */
export interface TransferFileRow {
  id: number
  session_id: string
  source_path: string
  destination_path: string
  file_name: string
  file_size: number
  bytes_transferred: number
  percentage: number
  status: string
  checksum: string | null
  error: string | null
  start_time: number | null
  end_time: number | null
  duration: number | null
}

/**
 * JOIN result for sessions with files
 */
export interface SessionFileJoinRow extends TransferSessionRow {
  file_id: number | null
  file_source_path: string | null
  file_destination_path: string | null
  file_name: string | null
  file_size: number | null
  file_bytes_transferred: number | null
  file_percentage: number | null
  file_status: string | null
  file_checksum: string | null
  file_error: string | null
  file_start_time: number | null
  file_end_time: number | null
  file_duration: number | null
}

/**
 * Raw log row from logs table
 */
export interface LogRow {
  id: number
  timestamp: number
  level: string
  message: string
  context: string | null
}

/**
 * Count query result
 */
export interface CountRow {
  count: number
}

/**
 * Generic database row (for flexible queries)
 */
export interface DatabaseRow {
  [key: string]: string | number | null | undefined
}
