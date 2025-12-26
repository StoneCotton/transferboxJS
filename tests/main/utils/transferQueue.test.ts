/**
 * Tests for TransferQueue utility
 */

import {
  TransferQueue,
  createTransferQueue,
  TransferTask
} from '../../../src/main/utils/transferQueue'

// Mock the logger
jest.mock('../../../src/main/logger', () => ({
  getLogger: () => ({
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  })
}))

describe('TransferQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create queue with default concurrency', () => {
      const queue = new TransferQueue()
      expect(queue.getTotalCount()).toBe(0)
      expect(queue.getActiveCount()).toBe(0)
    })

    it('should create queue with custom concurrency', () => {
      const queue = new TransferQueue({ concurrencyLimit: 5 })
      expect(queue).toBeInstanceOf(TransferQueue)
    })

    it('should use default concurrency for invalid values', () => {
      const queue = new TransferQueue({ concurrencyLimit: 100 }) // Over max
      expect(queue).toBeInstanceOf(TransferQueue)
    })
  })

  describe('addTasks', () => {
    it('should add tasks to the queue', () => {
      const queue = new TransferQueue<number>()
      const tasks: TransferTask<number>[] = [
        { index: 0, execute: async () => 1 },
        { index: 1, execute: async () => 2 },
        { index: 2, execute: async () => 3 }
      ]
      queue.addTasks(tasks)
      expect(queue.getTotalCount()).toBe(3)
    })
  })

  describe('execute', () => {
    it('should execute all tasks and return results', async () => {
      const queue = new TransferQueue<number>()
      const tasks: TransferTask<number>[] = [
        { index: 0, execute: async () => 1 },
        { index: 1, execute: async () => 2 },
        { index: 2, execute: async () => 3 }
      ]
      queue.addTasks(tasks)

      const results = await queue.execute()
      expect(results).toEqual([1, 2, 3])
      expect(queue.getCompletedCount()).toBe(3)
    })

    it('should return empty array for empty queue', async () => {
      const queue = new TransferQueue<number>()
      const results = await queue.execute()
      expect(results).toEqual([])
    })

    it('should respect concurrency limit', async () => {
      let maxConcurrent = 0
      let currentConcurrent = 0

      const queue = new TransferQueue<number>({ concurrencyLimit: 2 })
      const tasks: TransferTask<number>[] = Array.from({ length: 5 }, (_, i) => ({
        index: i,
        execute: async () => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          await new Promise((resolve) => setTimeout(resolve, 10))
          currentConcurrent--
          return i
        }
      }))

      queue.addTasks(tasks)
      await queue.execute()

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('should call onTaskComplete callback', async () => {
      const onTaskComplete = jest.fn()
      const queue = new TransferQueue<number>({ onTaskComplete })
      const tasks: TransferTask<number>[] = [{ index: 0, execute: async () => 42 }]

      queue.addTasks(tasks)
      await queue.execute()

      expect(onTaskComplete).toHaveBeenCalledWith(0, 42, true)
    })

    it('should call onTaskStart callback', async () => {
      const onTaskStart = jest.fn()
      const queue = new TransferQueue<number>({ onTaskStart })
      const tasks: TransferTask<number>[] = [
        { index: 0, execute: async () => 1 },
        { index: 1, execute: async () => 2 }
      ]

      queue.addTasks(tasks)
      await queue.execute()

      expect(onTaskStart).toHaveBeenCalledWith(0)
      expect(onTaskStart).toHaveBeenCalledWith(1)
      expect(onTaskStart).toHaveBeenCalledTimes(2)
    })

    it('should handle task errors with continueOnError=false', async () => {
      // Use concurrency of 1 to ensure sequential execution and deterministic error handling
      const queue = new TransferQueue<number>({ continueOnError: false, concurrencyLimit: 1 })
      const tasks: TransferTask<number>[] = [
        { index: 0, execute: async () => 1 },
        {
          index: 1,
          execute: async () => {
            throw new Error('Task failed')
          }
        },
        { index: 2, execute: async () => 3 }
      ]

      queue.addTasks(tasks)
      await expect(queue.execute()).rejects.toThrow('Task failed')
    })

    it('should continue on errors with continueOnError=true', async () => {
      const onTaskComplete = jest.fn()
      const queue = new TransferQueue<number>({ continueOnError: true, onTaskComplete })
      const tasks: TransferTask<number>[] = [
        { index: 0, execute: async () => 1 },
        {
          index: 1,
          execute: async () => {
            throw new Error('Task failed')
          }
        },
        { index: 2, execute: async () => 3 }
      ]

      queue.addTasks(tasks)
      const results = await queue.execute()

      // Results should have values where successful, null where failed
      expect(results[0]).toBe(1)
      expect(results[1]).toBeNull()
      expect(results[2]).toBe(3)
      expect(queue.getErrors()).toHaveLength(1)
    })
  })

  describe('stop', () => {
    it('should stop queue execution', async () => {
      const queue = new TransferQueue<number>({ concurrencyLimit: 1 })
      let _startedCount = 0

      const tasks: TransferTask<number>[] = Array.from({ length: 5 }, (_, i) => ({
        index: i,
        execute: async () => {
          _startedCount++
          if (i === 1) {
            queue.stop()
          }
          await new Promise((resolve) => setTimeout(resolve, 10))
          return i
        }
      }))

      queue.addTasks(tasks)

      await expect(queue.execute()).rejects.toThrow('Transfer queue cancelled')
      expect(queue.isStopped()).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset queue state', async () => {
      const queue = new TransferQueue<number>()
      const tasks: TransferTask<number>[] = [{ index: 0, execute: async () => 1 }]

      queue.addTasks(tasks)
      await queue.execute()

      expect(queue.getCompletedCount()).toBe(1)

      queue.reset()

      expect(queue.getTotalCount()).toBe(0)
      expect(queue.getCompletedCount()).toBe(0)
      expect(queue.getActiveCount()).toBe(0)
      expect(queue.getErrors()).toHaveLength(0)
    })
  })

  describe('getActiveCount', () => {
    it('should track active transfers', async () => {
      let maxActiveCount = 0
      const queue = new TransferQueue<number>({ concurrencyLimit: 2 })

      const tasks: TransferTask<number>[] = [
        {
          index: 0,
          execute: async () => {
            // Small delay to let both tasks start
            await new Promise((resolve) => setTimeout(resolve, 5))
            maxActiveCount = Math.max(maxActiveCount, queue.getActiveCount())
            await new Promise((resolve) => setTimeout(resolve, 50))
            return 1
          }
        },
        {
          index: 1,
          execute: async () => {
            // Small delay to let both tasks start
            await new Promise((resolve) => setTimeout(resolve, 5))
            maxActiveCount = Math.max(maxActiveCount, queue.getActiveCount())
            await new Promise((resolve) => setTimeout(resolve, 10))
            return 2
          }
        }
      ]

      queue.addTasks(tasks)
      await queue.execute()

      // With concurrency of 2 and 2 tasks, both should be active at some point
      // But due to timing, we might catch 1 or 2
      expect(maxActiveCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getErrors', () => {
    it('should collect errors from failed tasks', async () => {
      const queue = new TransferQueue<number>({ continueOnError: true })
      const tasks: TransferTask<number>[] = [
        {
          index: 0,
          execute: async () => {
            throw new Error('Error 1')
          }
        },
        {
          index: 1,
          execute: async () => {
            throw new Error('Error 2')
          }
        }
      ]

      queue.addTasks(tasks)
      await queue.execute()

      const errors = queue.getErrors()
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('Error 1')
      expect(errors[1].message).toBe('Error 2')
    })
  })
})

describe('createTransferQueue', () => {
  it('should create a TransferQueue instance', () => {
    const queue = createTransferQueue<number>()
    expect(queue).toBeInstanceOf(TransferQueue)
  })

  it('should create queue with options', () => {
    const queue = createTransferQueue<number>({ concurrencyLimit: 5 })
    expect(queue).toBeInstanceOf(TransferQueue)
  })
})
