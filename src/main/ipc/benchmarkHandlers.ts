/**
 * Benchmark IPC Handlers
 * Handles benchmark-related IPC communication between main and renderer
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { BenchmarkConfig, BenchmarkExportFormat } from '../../shared/types'
import { getBenchmarkService } from '../services/benchmarkService'
import { getLogger } from '../logger'
import { getMainWindow } from './state'

/**
 * Setup benchmark IPC handlers
 */
export function setupBenchmarkHandlers(): void {
  const logger = getLogger()

  // Start benchmark
  ipcMain.handle(
    IPC_CHANNELS.BENCHMARK_START,
    async (_, config: BenchmarkConfig): Promise<void> => {
      logger.info('IPC: benchmark:start', { config })

      const service = getBenchmarkService()

      // Set main window for IPC events
      const mainWindow = getMainWindow()
      if (mainWindow) {
        service.setMainWindow(mainWindow)
      }

      // Start benchmark (async, will emit events)
      service.start(config).catch((error) => {
        logger.error('Benchmark start failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }
  )

  // Cancel benchmark
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_CANCEL, async (): Promise<void> => {
    logger.info('IPC: benchmark:cancel')

    const service = getBenchmarkService()
    await service.cancel()
  })

  // Get benchmark history
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_GET_HISTORY, async (_, limit?: number) => {
    logger.debug('IPC: benchmark:get-history', { limit })

    const service = getBenchmarkService()
    return service.getBenchmarkHistory(limit)
  })

  // Get specific benchmark result
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_GET_RESULT, async (_, id: string) => {
    logger.debug('IPC: benchmark:get-result', { id })

    const service = getBenchmarkService()
    return service.getBenchmarkResult(id)
  })

  // Delete benchmark
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_DELETE, async (_, id: string): Promise<void> => {
    logger.info('IPC: benchmark:delete', { id })

    const service = getBenchmarkService()
    service.deleteBenchmark(id)
  })

  // Export benchmarks
  ipcMain.handle(
    IPC_CHANNELS.BENCHMARK_EXPORT,
    async (_, args: { ids: string[]; format: BenchmarkExportFormat }): Promise<string> => {
      logger.info('IPC: benchmark:export', { ids: args.ids, format: args.format })

      const service = getBenchmarkService()
      return service.exportBenchmarks(args.ids, args.format)
    }
  )

  // Cleanup orphaned benchmark files
  ipcMain.handle(IPC_CHANNELS.BENCHMARK_CLEANUP_ORPHANS, async (): Promise<number> => {
    logger.info('IPC: benchmark:cleanup-orphans')

    const service = getBenchmarkService()
    return service.cleanupOrphans()
  })
}
