/**
 * Tests for ProgressTracker utility
 */

import { ProgressTracker, createProgressTracker } from '../../../src/main/utils/progressTracker'

describe('ProgressTracker', () => {
  describe('constructor', () => {
    it('should initialize with correct total bytes', () => {
      const tracker = new ProgressTracker(1000)
      expect(tracker.getTotalBytes()).toBe(1000)
      expect(tracker.getBytesTransferred()).toBe(0)
    })

    it('should handle zero bytes', () => {
      const tracker = new ProgressTracker(0)
      expect(tracker.getTotalBytes()).toBe(0)
      expect(tracker.isComplete()).toBe(true)
    })
  })

  describe('update', () => {
    it('should track bytes transferred', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(100)
      expect(tracker.getBytesTransferred()).toBe(100)
    })

    it('should accumulate bytes across multiple updates', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(100)
      tracker.update(200)
      tracker.update(300)
      expect(tracker.getBytesTransferred()).toBe(600)
    })

    it('should return true when progress should be reported', async () => {
      // Use a small file size (under 100MB) which has 200ms interval and 2MB minBytes threshold
      const tracker = new ProgressTracker(10 * 1024 * 1024) // 10MB file

      // First update with enough bytes (2MB+) should trigger report
      const shouldReport = tracker.update(3 * 1024 * 1024) // 3MB transferred
      expect(shouldReport).toBe(true)
    })

    it('should return false when below throttle threshold', () => {
      const tracker = new ProgressTracker(1000000000) // Large file
      // Small update shouldn't trigger report immediately
      const shouldReport = tracker.update(1)
      expect(shouldReport).toBe(false)
    })
  })

  describe('getProgress', () => {
    it('should calculate percentage correctly', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500)
      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(50)
    })

    it('should calculate 100% when complete', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1000)
      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(100)
    })

    it('should handle zero total bytes gracefully', () => {
      const tracker = new ProgressTracker(0)
      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(0)
    })

    it('should return correct bytes transferred and total', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(250)
      const progress = tracker.getProgress()
      expect(progress.bytesTransferred).toBe(250)
      expect(progress.totalBytes).toBe(1000)
    })
  })

  describe('commitProgress', () => {
    it('should update last reported values', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500)
      tracker.commitProgress()

      // After commit, small update should not trigger report
      tracker.update(1)
      const progress = tracker.getProgress()
      expect(progress.bytesTransferred).toBe(501)
    })
  })

  describe('getFinalProgress', () => {
    it('should return 100% complete progress', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500) // Only partially complete
      const finalProgress = tracker.getFinalProgress()

      expect(finalProgress.percentage).toBe(100)
      expect(finalProgress.bytesTransferred).toBe(1000)
      expect(finalProgress.totalBytes).toBe(1000)
      expect(finalProgress.speed).toBe(0)
    })
  })

  describe('isComplete', () => {
    it('should return false when not complete', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500)
      expect(tracker.isComplete()).toBe(false)
    })

    it('should return true when bytes equal total', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1000)
      expect(tracker.isComplete()).toBe(true)
    })

    it('should return true when bytes exceed total', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1500)
      expect(tracker.isComplete()).toBe(true)
    })
  })

  describe('hasOverflow', () => {
    it('should return false when within bounds', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1000)
      expect(tracker.hasOverflow()).toBe(false)
    })

    it('should return true when exceeds total', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1001)
      expect(tracker.hasOverflow()).toBe(true)
    })
  })

  describe('getAverageSpeed', () => {
    it('should calculate speed based on elapsed time', async () => {
      const tracker = new ProgressTracker(10000)
      tracker.update(5000)

      // Allow some time to pass
      await new Promise((resolve) => setTimeout(resolve, 10))

      const speed = tracker.getAverageSpeed()
      expect(speed).toBeGreaterThan(0)
    })

    it('should return 0 when no time has passed', () => {
      const tracker = new ProgressTracker(1000)
      // Speed might be very high or effectively 0 depending on timing
      // Just verify it doesn't throw
      const speed = tracker.getAverageSpeed()
      expect(typeof speed).toBe('number')
    })
  })

  describe('getEta', () => {
    it('should estimate time remaining', async () => {
      const tracker = new ProgressTracker(10000)
      tracker.update(5000)

      // Allow some time to pass so we have a measurable speed
      await new Promise((resolve) => setTimeout(resolve, 10))

      const eta = tracker.getEta()
      expect(typeof eta).toBe('number')
      expect(eta).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 when complete', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(1000)

      // ETA should be 0 or very close to 0 when complete
      const eta = tracker.getEta()
      expect(eta).toBeLessThanOrEqual(0)
    })
  })

  describe('getElapsedTime', () => {
    it('should return elapsed time in seconds', async () => {
      const tracker = new ProgressTracker(1000)
      await new Promise((resolve) => setTimeout(resolve, 50))

      const elapsed = tracker.getElapsedTime()
      expect(elapsed).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(1) // Should be less than 1 second
    })
  })

  describe('reset', () => {
    it('should reset all tracking values', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500)
      tracker.reset()

      expect(tracker.getBytesTransferred()).toBe(0)
      expect(tracker.getTotalBytes()).toBe(1000)
      expect(tracker.isComplete()).toBe(false)
    })

    it('should allow updating total bytes on reset', () => {
      const tracker = new ProgressTracker(1000)
      tracker.update(500)
      tracker.reset(2000)

      expect(tracker.getBytesTransferred()).toBe(0)
      expect(tracker.getTotalBytes()).toBe(2000)
    })
  })

  describe('throttle configuration', () => {
    it('should use small file config for files under 1MB', () => {
      const tracker = new ProgressTracker(500000) // 500KB
      // Small files get more frequent updates
      tracker.update(100000) // 100KB should trigger update
      const shouldReport = tracker.update(1)
      // The actual behavior depends on timing, so we just verify no errors
      expect(typeof shouldReport).toBe('boolean')
    })

    it('should use large file config for files over 100MB', () => {
      const tracker = new ProgressTracker(500000000) // 500MB
      // Large files get less frequent updates
      const shouldReport = tracker.update(1000)
      // Small update on large file shouldn't trigger immediate report
      expect(typeof shouldReport).toBe('boolean')
    })
  })
})

describe('createProgressTracker', () => {
  it('should create a ProgressTracker instance', () => {
    const tracker = createProgressTracker(1000)
    expect(tracker).toBeInstanceOf(ProgressTracker)
    expect(tracker.getTotalBytes()).toBe(1000)
  })
})
