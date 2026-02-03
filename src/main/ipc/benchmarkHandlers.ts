/**
 * Benchmark IPC Handlers
 * Handles benchmark-related IPC communication between main and renderer
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getBenchmarkService } from '../services/benchmarkService'
import { getLogger } from '../logger'
import { getMainWindow } from './state'
import {
  validateBenchmarkConfig,
  validateBenchmarkId,
  validateBenchmarkExportRequest,
  validateLimit
} from '../utils/ipcValidator'

/**
 * Setup benchmark IPC handlers
 */
export function setupBenchmarkHandlers(): void {
  const logger = getLogger()

  // Start benchmark
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_START, async (_, config: unknown): Promise<void> => {
    // Validate input
    const validatedConfig = validateBenchmarkConfig(config)
    logger.info('IPC: benchmark:start', { config: validatedConfig })

    const service = getBenchmarkService()

    // Set main window for IPC events
    const mainWindow = getMainWindow()
    if (mainWindow) {
      service.setMainWindow(mainWindow)
    }

    // Start benchmark (async, will emit events)
    service.start(validatedConfig).catch((error) => {
      logger.error('Benchmark start failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    })
  })

  // Cancel benchmark
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_CANCEL, async (): Promise<void> => {
    logger.info('IPC: benchmark:cancel')

    const service = getBenchmarkService()
    await service.cancel()
  })

  // Get benchmark history
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_GET_HISTORY, async (_, limit?: unknown) => {
    const validatedLimit = limit !== undefined ? validateLimit(limit, 100) : undefined
    logger.debug('IPC: benchmark:get-history', { limit: validatedLimit })

    const service = getBenchmarkService()
    return service.getBenchmarkHistory(validatedLimit)
  })

  // Get specific benchmark result
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_GET_RESULT, async (_, id: unknown) => {
    const validatedId = validateBenchmarkId(id)
    logger.debug('IPC: benchmark:get-result', { id: validatedId })

    const service = getBenchmarkService()
    return service.getBenchmarkResult(validatedId)
  })

  // Delete benchmark
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_DELETE, async (_, id: unknown): Promise<void> => {
    const validatedId = validateBenchmarkId(id)
    logger.info('IPC: benchmark:delete', { id: validatedId })

    const service = getBenchmarkService()
    service.deleteBenchmark(validatedId)
  })

  // Export benchmarks
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_EXPORT, async (_, args: unknown): Promise<string> => {
    const { ids, format } = validateBenchmarkExportRequest(args)
    logger.info('IPC: benchmark:export', { ids, format })

    const service = getBenchmarkService()
    return service.exportBenchmarks(ids, format)
  })

  // Cleanup orphaned benchmark files
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_CLEANUP_ORPHANS, async (): Promise<number> => {
    logger.info('IPC: benchmark:cleanup-orphans')

    const service = getBenchmarkService()
    return service.cleanupOrphans()
  })
}
