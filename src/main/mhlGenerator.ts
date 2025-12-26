/**
 * MHL (Media Hash List) Generator Module
 * Generates MHL 1.1 format XML files for media integrity verification
 *
 * MHL is an industry-standard format used in professional media workflows
 * to verify data integrity during file transfers.
 */

import { writeFile } from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { getLogger } from './logger'

/**
 * File hash entry for MHL generation
 */
export interface MhlFileEntry {
  /** Relative path from the destination root */
  relativePath: string
  /** File size in bytes */
  size: number
  /** XXHash64 checksum */
  xxhash64: string
  /** File modification date (ISO 8601 format) */
  lastModificationDate: string
}

/**
 * MHL generation options
 */
export interface MhlGeneratorOptions {
  /** Destination root directory where files were transferred */
  destinationRoot: string
  /** List of file entries with checksums */
  files: MhlFileEntry[]
  /** Optional session ID for the MHL filename */
  sessionId?: string
  /** Optional creator name (defaults to 'TransferBox') */
  creatorName?: string
  /** Transfer start time */
  startTime?: Date
  /** Transfer end time */
  endTime?: Date
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format date to ISO 8601 format for MHL
 */
function formatIsoDate(date: Date): string {
  return date.toISOString()
}

/**
 * Generate MHL 1.1 format XML content
 */
function generateMhlContent(options: MhlGeneratorOptions): string {
  const { files, creatorName = 'TransferBox', startTime, endTime } = options
  const appVersion = app.getVersion()
  const creationDate = formatIsoDate(endTime || new Date())

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<hashlist version="1.1">',
    '  <creatorinfo>',
    `    <name>${escapeXml(creatorName)}</name>`,
    `    <version>${escapeXml(appVersion)}</version>`,
    `    <creationdate>${creationDate}</creationdate>`,
    startTime ? `    <startdate>${formatIsoDate(startTime)}</startdate>` : '',
    endTime ? `    <finishdate>${formatIsoDate(endTime)}</finishdate>` : '',
    '  </creatorinfo>'
  ].filter(Boolean)

  // Add file entries
  for (const file of files) {
    lines.push('  <hash>')
    lines.push(`    <file>${escapeXml(file.relativePath)}</file>`)
    lines.push(`    <size>${file.size}</size>`)
    lines.push(`    <xxhash64>${file.xxhash64}</xxhash64>`)
    lines.push(`    <lastmodificationdate>${file.lastModificationDate}</lastmodificationdate>`)
    lines.push('  </hash>')
  }

  lines.push('</hashlist>')

  return lines.join('\n')
}

/**
 * Generate MHL filename based on timestamp and optional session ID
 */
function generateMhlFilename(sessionId?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  if (sessionId) {
    // Use only the first 8 characters of the session ID for brevity
    const shortId = sessionId.slice(0, 8)
    return `TransferBox_${timestamp}_${shortId}.mhl`
  }
  return `TransferBox_${timestamp}.mhl`
}

/**
 * Generate an MHL file for a transfer session
 *
 * @param options - MHL generation options
 * @returns Path to the generated MHL file
 */
export async function generateMhlFile(options: MhlGeneratorOptions): Promise<string> {
  const logger = getLogger()

  if (options.files.length === 0) {
    logger.warn('[MhlGenerator] No files provided for MHL generation')
    throw new Error('No files to generate MHL for')
  }

  const mhlFilename = generateMhlFilename(options.sessionId)
  const mhlPath = path.join(options.destinationRoot, mhlFilename)

  logger.info('[MhlGenerator] Generating MHL file', {
    destination: mhlPath,
    fileCount: options.files.length
  })

  try {
    const content = generateMhlContent(options)
    await writeFile(mhlPath, content, 'utf-8')

    logger.info('[MhlGenerator] MHL file generated successfully', {
      path: mhlPath,
      size: content.length
    })

    return mhlPath
  } catch (error) {
    logger.error('[MhlGenerator] Failed to generate MHL file', {
      error: error instanceof Error ? error.message : String(error),
      destination: mhlPath
    })
    throw error
  }
}

/**
 * Convert transfer results to MHL file entries
 *
 * @param destinationRoot - Destination root for relative path calculation
 * @param results - Transfer results with checksums
 * @returns Array of MHL file entries
 */
export function createMhlEntriesFromResults(
  destinationRoot: string,
  results: Array<{
    destPath: string
    bytesTransferred: number
    sourceChecksum?: string
    success: boolean
  }>
): MhlFileEntry[] {
  const entries: MhlFileEntry[] = []

  for (const result of results) {
    // Only include successful transfers with checksums
    if (!result.success || !result.sourceChecksum) {
      continue
    }

    const relativePath = path.relative(destinationRoot, result.destPath)
    // Normalize path separators for cross-platform compatibility
    const normalizedPath = relativePath.replace(/\\/g, '/')

    entries.push({
      relativePath: normalizedPath,
      size: result.bytesTransferred,
      xxhash64: result.sourceChecksum,
      lastModificationDate: formatIsoDate(new Date())
    })
  }

  return entries
}
