/**
 * SpeedGraph Component
 * Canvas-based speed graph for benchmark visualization
 * With CPU/Memory overlay support and hover tooltips
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
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

// Distinct colors for each metric
const COMPARISON_COLORS = ['#22c55e', '#06b6d4', '#ec4899'] // green, cyan, pink
const PRIMARY_COLOR = '#f97316' // brand orange - Transfer Speed
const VERIFY_COLOR = 'rgba(59, 130, 246, 0.2)' // blue with transparency
const CPU_COLOR = '#06b6d4' // cyan - clearly distinct from orange
const MEMORY_COLOR = '#a855f7' // purple - clearly distinct from both
const FILE_BOUNDARY_COLOR = '#fbbf24' // amber/yellow - visible marker

interface TooltipData {
  x: number
  y: number
  sample: SpeedSample
  timestamp: string
}

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
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [graphMetrics, setGraphMetrics] = useState<{
    padding: { top: number; right: number; bottom: number; left: number }
    xMax: number
    yMax: number
    memoryMax: number
    graphWidth: number
    graphHeight: number
  } | null>(null)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()

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
    max = max * 1.2
    return Math.ceil(max / 100) * 100 || 1000
  }, [samples])

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!graphMetrics || samples.length === 0) {
        setTooltip(null)
        return
      }

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const { padding, xMax, graphWidth } = graphMetrics

      // Check if mouse is in graph area
      if (
        x < padding.left ||
        x > padding.left + graphWidth ||
        y < padding.top ||
        y > padding.top + graphMetrics.graphHeight
      ) {
        setTooltip(null)
        return
      }

      // Find nearest sample by x position
      const mouseTimeMs = ((x - padding.left) / graphWidth) * xMax
      let nearestSample = samples[0]
      let nearestDist = Math.abs(samples[0].timestampMs - mouseTimeMs)

      for (const sample of samples) {
        const dist = Math.abs(sample.timestampMs - mouseTimeMs)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestSample = sample
        }
      }

      // Only show tooltip if close enough (within 5% of graph width)
      const threshold = xMax * 0.05
      if (nearestDist > threshold) {
        setTooltip(null)
        return
      }

      setTooltip({
        x: e.clientX,
        y: e.clientY,
        sample: nearestSample,
        timestamp: formatTime(nearestSample.timestampMs)
      })
    },
    [graphMetrics, samples]
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  // Format milliseconds to time string
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Theme-aware colors
    const textColor = isDarkMode ? 'rgb(209, 213, 219)' : 'rgb(55, 65, 81)' // gray-300 / gray-700
    const gridColor = isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(156, 163, 175, 0.3)'
    const axisColor = isDarkMode ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)'

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const width = rect.width

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    // Increased padding for labels - more space on right for secondary axis, bottom for Time label
    const hasSecondaryAxis = (showCpu && hasCpuData) || (showMemory && hasMemoryData)
    const padding = { top: 25, right: hasSecondaryAxis ? 60 : 25, bottom: 45, left: 55 }
    const graphWidth = width - padding.left - padding.right
    const graphHeight = height - padding.top - padding.bottom

    const yMax = calculateMaxY()
    const memoryMax = calculateMaxMemory()
    const xMax = Math.max(
      samples.length > 0 ? samples[samples.length - 1].timestampMs : 1000,
      ...comparisonRuns.map((r) =>
        r.samples.length > 0 ? r.samples[r.samples.length - 1].timestampMs : 0
      )
    )

    // Store metrics for mouse interaction
    setGraphMetrics({ padding, xMax, yMax, memoryMax, graphWidth, graphHeight })

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

    const yTicks = 5
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (i / yTicks) * graphHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    const xTicks = 5
    for (let i = 0; i <= xTicks; i++) {
      const x = padding.left + (i / xTicks) * graphWidth
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.stroke()
    }

    // Draw Y-axis labels (left - speed) with distinct color
    ctx.fillStyle = PRIMARY_COLOR
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= yTicks; i++) {
      const value = Math.round((yMax * (yTicks - i)) / yTicks)
      const y = padding.top + (i / yTicks) * graphHeight
      ctx.fillText(`${value}`, padding.left - 8, y)
    }

    // Draw Y-axis title (left)
    ctx.save()
    ctx.translate(14, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = PRIMARY_COLOR
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillText('MB/s', 0, 0)
    ctx.restore()

    // Draw secondary Y-axis labels (right - CPU %)
    if (hasSecondaryAxis && showCpu && hasCpuData) {
      ctx.textAlign = 'left'
      ctx.fillStyle = CPU_COLOR
      ctx.font = 'bold 11px system-ui, sans-serif'
      for (let i = 0; i <= yTicks; i++) {
        const value = Math.round((100 * (yTicks - i)) / yTicks)
        const y = padding.top + (i / yTicks) * graphHeight
        ctx.fillText(`${value}%`, width - padding.right + 8, y)
      }

      // Draw Y-axis title (right)
      ctx.save()
      ctx.translate(width - 14, height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillStyle = CPU_COLOR
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.fillText('CPU %', 0, 0)
      ctx.restore()
    }

    // Draw X-axis labels
    ctx.fillStyle = textColor
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= xTicks; i++) {
      const ms = (xMax * i) / xTicks
      const x = padding.left + (i / xTicks) * graphWidth
      const seconds = Math.round(ms / 1000)
      ctx.fillText(`${seconds}s`, x, height - padding.bottom + 10)
    }

    // Draw X-axis title - positioned above the very bottom to prevent clipping
    ctx.fillStyle = textColor
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Time', padding.left + graphWidth / 2, height - padding.bottom + 25)

    // Draw verify regions
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

      if (inVerify && samples.length > 0) {
        ctx.fillRect(
          verifyStart,
          padding.top,
          xScale(samples[samples.length - 1].timestampMs) - verifyStart,
          graphHeight
        )
      }
    }

    // Draw file boundary markers (more visible)
    if (showFileMarkers) {
      const fileChanges = samples.filter(
        (s, i) => i > 0 && s.currentFile !== samples[i - 1].currentFile
      )

      fileChanges.forEach((sample) => {
        const x = xScale(sample.timestampMs)

        // Draw a more visible marker - solid line with glow effect
        ctx.strokeStyle = FILE_BOUNDARY_COLOR
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x, padding.top)
        ctx.lineTo(x, height - padding.bottom)
        ctx.stroke()

        // Add a small triangle marker at top
        ctx.fillStyle = FILE_BOUNDARY_COLOR
        ctx.beginPath()
        ctx.moveTo(x - 5, padding.top)
        ctx.lineTo(x + 5, padding.top)
        ctx.lineTo(x, padding.top + 8)
        ctx.closePath()
        ctx.fill()
      })
    }

    // Draw comparison runs
    comparisonRuns.forEach((run, runIndex) => {
      if (run.samples.length < 2) return

      ctx.strokeStyle = COMPARISON_COLORS[runIndex] || COMPARISON_COLORS[0]
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
      ctx.setLineDash([])
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

    // Draw memory line (dashed, behind speed line)
    if (showMemory && hasMemoryData && samples.length >= 2) {
      ctx.strokeStyle = MEMORY_COLOR
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.7
      ctx.setLineDash([6, 3])
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

    // Draw CPU line (solid, behind speed line)
    if (showCpu && hasCpuData && samples.length >= 2) {
      ctx.strokeStyle = CPU_COLOR
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.8
      ctx.setLineDash([])
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

    // Draw primary speed line (on top)
    if (samples.length >= 2) {
      ctx.strokeStyle = PRIMARY_COLOR
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash([])
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
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = PRIMARY_COLOR
        ctx.fill()

        // Pulsing ring
        ctx.beginPath()
        ctx.arc(x, y, 10, 0, Math.PI * 2)
        ctx.strokeStyle = PRIMARY_COLOR
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.5
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }

    // Draw axis lines
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(padding.left, height - padding.bottom)
    ctx.lineTo(width - padding.right, height - padding.bottom)
    if (hasSecondaryAxis) {
      ctx.moveTo(width - padding.right, padding.top)
      ctx.lineTo(width - padding.right, height - padding.bottom)
    }
    ctx.stroke()
  }, [
    samples,
    comparisonRuns,
    height,
    calculateMaxY,
    calculateMaxMemory,
    isLive,
    showFileMarkers,
    showCpu,
    showMemory,
    hasCpuData,
    hasMemoryData,
    isDarkMode
  ])

  // Animation loop
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

  // Render tooltip via portal
  const tooltipElement = tooltip && (
    <div
      className="pointer-events-none fixed z-[99999] rounded-lg bg-gray-900 px-3 py-2 text-sm shadow-xl dark:bg-gray-800"
      style={{
        left: tooltip.x + 12,
        top: tooltip.y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="space-y-1 text-white">
        <div className="font-semibold text-gray-300">{tooltip.timestamp}</div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY_COLOR }} />
          <span>Speed: <strong>{tooltip.sample.speedMbps.toFixed(1)} MB/s</strong></span>
        </div>
        {tooltip.sample.cpuPercent !== undefined && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CPU_COLOR }} />
            <span>CPU: <strong>{tooltip.sample.cpuPercent.toFixed(1)}%</strong></span>
          </div>
        )}
        {tooltip.sample.memoryUsedMB !== undefined && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: MEMORY_COLOR }} />
            <span>Memory: <strong>{tooltip.sample.memoryUsedMB.toFixed(0)} MB</strong></span>
          </div>
        )}
        {tooltip.sample.currentFile && (
          <div className="mt-1 border-t border-gray-700 pt-1 text-xs text-gray-400">
            {tooltip.sample.currentFile}
          </div>
        )}
        <div className="text-xs text-gray-500">
          Phase: {tooltip.sample.phase === 'verify' ? 'Verifying' : 'Transferring'}
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair rounded-lg bg-white dark:bg-gray-900"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {tooltip && createPortal(tooltipElement, document.body)}

      {showLegend && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-1 w-5 rounded-full" style={{ backgroundColor: PRIMARY_COLOR }} />
            <span className="font-medium" style={{ color: PRIMARY_COLOR }}>Transfer Speed (MB/s)</span>
          </div>
          {showCpu && hasCpuData && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-5 rounded-full" style={{ backgroundColor: CPU_COLOR }} />
              <span className="font-medium" style={{ color: CPU_COLOR }}>CPU % (App)</span>
            </div>
          )}
          {showMemory && hasMemoryData && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-5 rounded-full border-t-2 border-dashed" style={{ borderColor: MEMORY_COLOR }} />
              <span className="font-medium" style={{ color: MEMORY_COLOR }}>Memory (App)</span>
            </div>
          )}
          {samples.some((s) => s.phase === 'verify') && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-5 rounded" style={{ backgroundColor: VERIFY_COLOR }} />
              <span className="text-gray-600 dark:text-gray-400">Verify Phase</span>
            </div>
          )}
          {showFileMarkers && (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-transparent"
                  style={{ borderTopColor: FILE_BOUNDARY_COLOR }}
                />
                <div className="h-3 w-0.5" style={{ backgroundColor: FILE_BOUNDARY_COLOR }} />
              </div>
              <span className="text-gray-600 dark:text-gray-400">File Boundary</span>
            </div>
          )}
          {comparisonRuns.map((run, i) => (
            <div key={run.id} className="flex items-center gap-2">
              <div
                className="h-1 w-5 rounded-full opacity-60"
                style={{ backgroundColor: COMPARISON_COLORS[i] }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {new Date(run.timestamp).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
