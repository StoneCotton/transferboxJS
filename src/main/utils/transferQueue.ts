/**
 * Transfer Queue Utility
 * Manages concurrent file transfer operations with configurable parallelism
 */

import { getLogger } from '../logger'

/**
 * Default configuration values
 */
const DEFAULT_CONCURRENT_LIMIT = 3
const MIN_CONCURRENT_LIMIT = 1
const MAX_CONCURRENT_LIMIT = 10

/**
 * Transfer task representing a single file transfer
 */
export interface TransferTask<T> {
  index: number
  execute: () => Promise<T>
}

/**
 * Queue options
 */
export interface TransferQueueOptions {
  concurrencyLimit?: number
  onTaskComplete?: (index: number, result: unknown, success: boolean) => void
  onTaskStart?: (index: number) => void
  continueOnError?: boolean
}

/**
 * Transfer Queue Class
 * Manages parallel execution of transfer tasks with configurable concurrency
 */
export class TransferQueue<T> {
  private concurrencyLimit: number
  private continueOnError: boolean
  private onTaskComplete?: (index: number, result: unknown, success: boolean) => void
  private onTaskStart?: (index: number) => void

  private tasks: TransferTask<T>[] = []
  private activeTransfers = new Map<number, Promise<T>>()
  private results: (T | null)[] = []
  private nextTaskIndex = 0
  private completedCount = 0
  private stopped = false
  private errors: Error[] = []

  constructor(options?: TransferQueueOptions) {
    // Validate and set concurrency limit
    let limit = options?.concurrencyLimit || DEFAULT_CONCURRENT_LIMIT
    if (limit < MIN_CONCURRENT_LIMIT || limit > MAX_CONCURRENT_LIMIT) {
      limit = DEFAULT_CONCURRENT_LIMIT
      getLogger().warn('Invalid concurrency limit, using default', {
        provided: options?.concurrencyLimit,
        default: DEFAULT_CONCURRENT_LIMIT
      })
    }

    this.concurrencyLimit = limit
    this.continueOnError = options?.continueOnError ?? false
    this.onTaskComplete = options?.onTaskComplete
    this.onTaskStart = options?.onTaskStart
  }

  /**
   * Add tasks to the queue
   */
  addTasks(tasks: TransferTask<T>[]): void {
    this.tasks = tasks
    this.results = new Array(tasks.length).fill(null)
  }

  /**
   * Start a single task
   */
  private startTask(taskIndex: number): void {
    if (this.stopped) return

    const task = this.tasks[taskIndex]
    if (!task) return

    if (this.onTaskStart) {
      this.onTaskStart(task.index)
    }

    const promise = task
      .execute()
      .then((result) => {
        this.results[task.index] = result
        this.completedCount++
        this.activeTransfers.delete(task.index)

        if (this.onTaskComplete) {
          this.onTaskComplete(task.index, result, true)
        }

        return result
      })
      .catch((error) => {
        this.completedCount++
        this.activeTransfers.delete(task.index)
        this.errors.push(error instanceof Error ? error : new Error(String(error)))

        if (this.onTaskComplete) {
          this.onTaskComplete(task.index, error, false)
        }

        if (!this.continueOnError) {
          throw error
        }

        return null as unknown as T
      })

    this.activeTransfers.set(task.index, promise)
  }

  /**
   * Execute all tasks in the queue
   */
  async execute(): Promise<(T | null)[]> {
    if (this.tasks.length === 0) {
      return []
    }

    this.stopped = false
    this.nextTaskIndex = 0
    this.completedCount = 0
    this.activeTransfers.clear()
    this.errors = []

    // Start initial batch of transfers
    while (
      this.nextTaskIndex < Math.min(this.concurrencyLimit, this.tasks.length) &&
      !this.stopped
    ) {
      this.startTask(this.nextTaskIndex)
      this.nextTaskIndex++
    }

    // Continuously maintain concurrencyLimit active transfers
    try {
      while (this.activeTransfers.size > 0 && !this.stopped) {
        // Wait for any transfer to complete
        await Promise.race(Array.from(this.activeTransfers.values()))

        // Start next transfer if there are more tasks
        if (this.nextTaskIndex < this.tasks.length && !this.stopped) {
          this.startTask(this.nextTaskIndex)
          this.nextTaskIndex++
        }
      }
    } catch (error) {
      // If continueOnError is false, a failed task will cause Promise.race to reject
      // We need to wait for any remaining transfers to complete before rethrowing
      if (!this.continueOnError && this.activeTransfers.size > 0) {
        const remainingTransfers = Array.from(this.activeTransfers.values())
        await Promise.allSettled(remainingTransfers)
      }
      throw error
    }

    if (this.stopped && this.activeTransfers.size > 0) {
      throw new Error('Transfer queue cancelled')
    }

    return this.results
  }

  /**
   * Stop the queue execution
   */
  stop(): void {
    this.stopped = true
  }

  /**
   * Check if queue is stopped
   */
  isStopped(): boolean {
    return this.stopped
  }

  /**
   * Get number of active transfers
   */
  getActiveCount(): number {
    return this.activeTransfers.size
  }

  /**
   * Get number of completed transfers
   */
  getCompletedCount(): number {
    return this.completedCount
  }

  /**
   * Get total number of tasks
   */
  getTotalCount(): number {
    return this.tasks.length
  }

  /**
   * Get collected errors
   */
  getErrors(): Error[] {
    return [...this.errors]
  }

  /**
   * Reset queue for reuse
   */
  reset(): void {
    this.tasks = []
    this.results = []
    this.activeTransfers.clear()
    this.nextTaskIndex = 0
    this.completedCount = 0
    this.stopped = false
    this.errors = []
  }
}

/**
 * Create a transfer queue with the given options
 */
export function createTransferQueue<T>(options?: TransferQueueOptions): TransferQueue<T> {
  return new TransferQueue<T>(options)
}
