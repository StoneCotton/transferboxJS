/**
 * Progress Service
 * Business logic for transfer progress reporting
 */

import { IPC_CHANNELS } from '../../shared/types'
import { getDatabaseManager } from '../databaseManager'
import { TransferProgressData } from './transferService'

export interface CompletionContext {
  totalFiles: number
  totalBytes: number
  startTime: number
  sessionId: string
  completedCount: number
  failedCount: number
}

/**
 * Send final progress update on transfer completion
 */
export function sendCompletionProgress(
  sender: Electron.WebContents,
  context: CompletionContext
): void {
  const db = getDatabaseManager()
  const completedFiles = db.getFilesByStatus(context.sessionId, 'complete')
  const failedFiles = db.getFilesByStatus(context.sessionId, 'error')

  const progressData: TransferProgressData = {
    status: context.failedCount > 0 ? 'error' : 'complete',
    totalFiles: context.totalFiles,
    completedFilesCount: context.completedCount,
    failedFiles: context.failedCount,
    skippedFiles: 0,
    totalBytes: context.totalBytes,
    transferredBytes: context.totalBytes,
    overallPercentage: 100,
    currentFile: null,
    activeFiles: [],
    completedFiles: [...completedFiles, ...failedFiles].map((f) => ({
      sourcePath: f.sourcePath,
      destinationPath: f.destinationPath,
      fileName: f.fileName,
      fileSize: f.fileSize,
      bytesTransferred: f.bytesTransferred,
      percentage: f.percentage,
      status: f.status as 'complete' | 'error' | 'skipped',
      error: f.error,
      checksum: f.checksum
    })),
    transferSpeed: 0,
    averageSpeed: 0,
    eta: 0,
    elapsedTime: (Date.now() - context.startTime) / 1000,
    startTime: context.startTime,
    endTime: Date.now(),
    errorCount: context.failedCount
  }

  sender.send(IPC_CHANNELS.TRANSFER_PROGRESS, progressData)
}
