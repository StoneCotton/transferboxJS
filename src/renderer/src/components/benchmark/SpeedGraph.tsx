/**
 * SpeedGraph Component
 * Canvas-based speed graph for benchmark visualization
 * With CPU/Memory overlay support
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import type { SpeedSample, BenchmarkResult } from '../../../../shared/types'
import { cn } from '../../lib/utils'

interface SpeedGraphProps {
  /** Speed samples to display */
  samples: SpeedSample[]
  /** Maximum Y-axis value (auto-scales if not provided) */
  maxY?: number
  /** Graph height in pixels */
  height?: number
  /** Whether to show legend */
  showLegend?: boolean
  /** Whether to show file boundary markers */
  showFileMarkers?: boolean
  /** Comparison runs for overlay */
  comparisonRuns?: BenchmarkResult[]
  /** Whether the graph is live (animating) */
  isLive?: boolean
  /** Whether to show CPU overlay */
  showCpu?: boolean
  /** Whether to show Memory overlay */
  showMemory?: boolean
  /** Additional CSS classes */
  className?: string
}

// Colors for comparison runs
const COMPARISON_COLORS = ['#22c55e', '#a855f7', '#3b82f6'] // green, purple, blue
const PRIMARY_COLOR = '#f97316' // brand orange
const VERIFY_COLOR = 'rgba(59, 130, 246, 0.3)' // blue with transparency
const CPU_COLOR = '#ef4444' // red
const MEMORY_COLOR = '#8b5cf6' // purple

export function SpeedGraph({
  samples,
  maxY,
  height = 200,
  showLegend = true,
  showFileMarkers = false,
  comparisonRuns = [],
  isLive = false,
  showCpu = true,
  showMemory = true,
  className
}: SpeedGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()

    // Watch for class changes on document
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  // Check if we have CPU/Memory data
  const hasCpuData = samples.some((s) => s.cpuPercent !== undefined)
  const hasMemoryData = samples.some((s) => s.memoryUsedMB !== undefined)

  // Calculate auto-max Y value with padding
  const calculateMaxY = useCallback(() => {
    if (maxY) return maxY

    let max = 0
    samples.forEach((s) => {
      if (s.speedMbps > max) max = s.speedMbps
    })
    comparisonRuns.forEach((run) => {
      run.samples.forEach((s) => {
        if (s.speedMbps > max) max = s.speedMbps
      })
    })

    // Add 20% padding and round to nice number
    max = max * 1.2
    if (max < 100) return Math.ceil(max / 10) * 10
    if (max < 500) return Math.ceil(max / 50) * 50
    return Math.ceil(max / 100) * 100
  }, [samples, comparisonRuns, maxY])

  // Calculate max memory for scaling
  const calculateMaxMemory = useCallback(() => {
    let max = 0
    samples.forEach((s) => {
      if (s.memoryUsedMB && s.memoryUsedMB > max) max = s.memoryUsedMB
    })
    // Round to nice number with padding
    max = max * 1.2
    return Math.ceil(max / 100) * 100 || 1000
  }, [samples])

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Theme-aware colors
    const textColor = isDarkMode ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)' // gray-400 / gray-500
    const gridColor = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(156, 163, 175, 0.2)' // gray-600 / gray-400
    const axisColor = isDarkMode ? 'rgb(107, 114, 128)' : 'rgb(156, 163, 175)' // gray-500 / gray-400

    // Get device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const width = rect.width

    // Set canvas size accounting for DPR
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Padding for labels (add right padding for secondary axis if showing CPU/Memory)
    const hasSecondaryAxis = (showCpu && hasCpuData) || (showMemory && hasMemoryData)
    const padding = { top: 20, right: hasSecondaryAxis ? 50 : 20, bottom: 30, left: 50 }
    const graphWidth = width - padding.left - padding.right
    const graphHeight = height - padding.top - padding.bottom

    // Calculate scales
    const yMax = calculateMaxY()
    const memoryMax = calculateMaxMemory()
    const xMax = Math.max(
      samples.length > 0 ? samples[samples.length - 1].timestampMs : 1000,
      ...comparisonRuns.map((r) =>
        r.samples.length > 0 ? r.samples[r.samples.length - 1].timestampMs : 0
      )
    )

    const xScale = (ms: number) => padding.left + (ms / xMax) * graphWidth
    const yScale = (speed: number) => padding.top + graphHeight - (speed / yMax) * graphHeight
    const cpuScale = (percent: number) => padding.top + graphHeight - (percent / 100) * graphHeight
    const memoryScale = (mb: number) => padding.top + graphHeight - (mb / memoryMax) * graphHeight

    // Draw background
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1

    // Horizontal grid lines
    const yTicks = 5
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (i / yTicks) * graphHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    // Vertical grid lines
    const xTicks = 5
    for (let i = 0; i <= xTicks; i++) {
      const x = padding.left + (i / xTicks) * graphWidth
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.stroke()
    }

    // Draw Y-axis labels (left - speed)
    ctx.fillStyle = textColor
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= yTicks; i++) {
      const value = Math.round((yMax * (yTicks - i)) / yTicks)
      const y = padding.top + (i / yTicks) * graphHeight
      ctx.fillText(`${value}`, padding.left - 8, y)
    }

    // Draw secondary Y-axis labels (right - CPU %)
    if (hasSecondaryAxis && showCpu && hasCpuData) {
      ctx.textAlign = 'left'
      ctx.fillStyle = CPU_COLOR
      for (let i = 0; i <= yTicks; i++) {
        const value = Math.round((100 * (yTicks - i)) / yTicks)
        const y = padding.top + (i / yTicks) * graphHeight
        ctx.fillText(`${value}%`, width - padding.right + 8, y)
      }
    }

    // Draw X-axis labels
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= xTicks; i++) {
      const ms = (xMax * i) / xTicks
      const x = padding.left + (i / xTicks) * graphWidth
      const seconds = Math.round(ms / 1000)
      ctx.fillText(`${seconds}s`, x, height - padding.bottom + 8)
    }

    // Draw verify regions (shaded background for verify phase)
    if (samples.some((s) => s.phase === 'verify')) {
      ctx.fillStyle = VERIFY_COLOR
      let inVerify = false
      let verifyStart = 0

      samples.forEach((sample, i) => {
        if (sample.phase === 'verify' && !inVerify) {
          inVerify = true
          verifyStart = xScale(sample.timestampMs)
        } else if (sample.phase !== 'verify' && inVerify) {
          inVerify = false
          ctx.fillRect(
            verifyStart,
            padding.top,
            xScale(samples[i - 1].timestampMs) - verifyStart,
            graphHeight
          )
        }
      })

      // Handle case where verify extends to end
      if (inVerify && samples.length > 0) {
        ctx.fillRect(
          verifyStart,
          padding.top,
          xScale(samples[samples.length - 1].timestampMs) - verifyStart,
          graphHeight
        )
      }
    }

    // Draw comparison runs first (behind primary)
    comparisonRuns.forEach((run, runIndex) => {
      if (run.samples.length < 2) return

      ctx.strokeStyle = COMPARISON_COLORS[runIndex] || COMPARISON_COLORS[0]
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      run.samples.forEach((sample, i) => {
        const x = xScale(sample.timestampMs)
        const y = yScale(sample.speedMbps)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // Draw memory line (behind speed line)
    if (showMemory && hasMemoryData && samples.length >= 2) {
      ctx.strokeStyle = MEMORY_COLOR
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      let started = false
      samples.forEach((sample) => {
        if (sample.memoryUsedMB !== undefined) {
          const x = xScale(sample.timestampMs)
          const y = memoryScale(sample.memoryUsedMB)
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
      })
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // Draw CPU line (behind speed line)
    if (showCpu && hasCpuData && samples.length >= 2) {
      ctx.strokeStyle = CPU_COLOR
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      let started = false
      samples.forEach((sample) => {
        if (sample.cpuPercent !== undefined) {
          const x = xScale(sample.timestampMs)
          const y = cpuScale(sample.cpuPercent)
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
      })
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Draw primary speed line
    if (samples.length >= 2) {
      ctx.strokeStyle = PRIMARY_COLOR
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      samples.forEach((sample, i) => {
        const x = xScale(sample.timestampMs)
        const y = yScale(sample.speedMbps)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Draw current point indicator if live
      if (isLive && samples.length > 0) {
        const lastSample = samples[samples.length - 1]
        const x = xScale(lastSample.timestampMs)
        const y = yScale(lastSample.speedMbps)

        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = PRIMARY_COLOR
        ctx.fill()

        // Pulsing animation ring
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.strokeStyle = PRIMARY_COLOR
        ctx.globalAlpha = 0.5
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }

    // Draw file boundary markers
    if (showFileMarkers) {
      const fileChanges = samples.filter(
        (s, i) => i > 0 && s.currentFile !== samples[i - 1].currentFile
      )

      ctx.setLineDash([4, 4])
      ctx.strokeStyle = isDarkMode ? 'rgba(107, 114, 128, 0.5)' : 'rgba(156, 163, 175, 0.5)'
      ctx.lineWidth = 1

      fileChanges.forEach((sample) => {
        const x = xScale(sample.timestampMs)
        ctx.beginPath()
        ctx.moveTo(x, padding.top)
        ctx.lineTo(x, height - padding.bottom)
        ctx.stroke()
      })
      ctx.setLineDash([])
    }

    // Draw axis lines
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(padding.left, height - padding.bottom)
    ctx.lineTo(width - padding.right, height - padding.bottom)
    if (hasSecondaryAxis) {
      ctx.moveTo(width - padding.right, padding.top)
      ctx.lineTo(width - padding.right, height - padding.bottom)
    }
    ctx.stroke()

    // Y-axis label (left - speed)
    ctx.save()
    ctx.translate(12, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = textColor
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText('MB/s', 0, 0)
    ctx.restore()

    // Y-axis label (right - CPU/Memory)
    if (hasSecondaryAxis && showCpu && hasCpuData) {
      ctx.save()
      ctx.translate(width - 12, height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillStyle = CPU_COLOR
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText('CPU %', 0, 0)
      ctx.restore()
    }
  }, [samples, comparisonRuns, height, calculateMaxY, calculateMaxMemory, isLive, showFileMarkers, showCpu, showMemory, hasCpuData, hasMemoryData, isDarkMode])

  // Set up animation loop for live mode
  useEffect(() => {
    if (isLive) {
      const animate = () => {
        draw()
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    } else {
      draw()
      return undefined
    }
  }, [draw, isLive])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  return (
    <div className={cn('relative', className)}>
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="rounded-lg bg-white dark:bg-gray-900"
        />
      </div>

      {showLegend && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded" style={{ backgroundColor: PRIMARY_COLOR }} />
            <span>Transfer Speed</span>
          </div>
          {showCpu && hasCpuData && (
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded" style={{ backgroundColor: CPU_COLOR }} />
              <span>CPU %</span>
            </div>
          )}
          {showMemory && hasMemoryData && (
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded border-t border-dashed" style={{ borderColor: MEMORY_COLOR }} />
              <span>Memory</span>
            </div>
          )}
          {samples.some((s) => s.phase === 'verify') && (
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-4 rounded"
                style={{ backgroundColor: VERIFY_COLOR }}
              />
              <span>Verify</span>
            </div>
          )}
          {showFileMarkers && (
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-0 border-l border-dashed border-gray-400" />
              <span>File boundaries</span>
            </div>
          )}
          {comparisonRuns.map((run, i) => (
            <div key={run.id} className="flex items-center gap-1.5">
              <div
                className="h-0.5 w-4 rounded opacity-60"
                style={{ backgroundColor: COMPARISON_COLORS[i] }}
              />
              <span>{new Date(run.timestamp).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
