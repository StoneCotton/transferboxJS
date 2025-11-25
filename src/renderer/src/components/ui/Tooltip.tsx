/**
 * Tooltip Component
 * A reusable tooltip that appears on hover using fixed positioning
 * to avoid z-index and overflow issues
 */

import { useState, useRef, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'
import { useConfigStore } from '../../store'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  /** The content to display in the tooltip */
  content: ReactNode
  /** The element that triggers the tooltip */
  children: ReactNode
  /** Position of the tooltip relative to the trigger element */
  position?: TooltipPosition
  /** Delay in ms before showing the tooltip */
  delay?: number
  /** Additional className for the tooltip container */
  className?: string
  /** Whether the tooltip is disabled (overrides global setting) */
  disabled?: boolean
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 700,
  className,
  disabled = false
}: TooltipProps): React.ReactElement {
  const { config } = useConfigStore()
  const tooltipsEnabled = config.showTooltips ?? true
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check both the per-tooltip disabled prop and the global setting
  const isDisabled = disabled || !tooltipsEnabled

  const showTooltip = (): void => {
    if (isDisabled) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = (): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  // Calculate position using fixed coordinates relative to viewport
  const calculatePosition = useCallback((): void => {
    if (!triggerRef.current || !tooltipRef.current) return

    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const gap = 8 // Gap between trigger and tooltip
    const viewportPadding = 12 // Minimum distance from viewport edge

    let top = 0
    let left = 0
    let finalPosition = position

    // Calculate initial position
    switch (position) {
      case 'top':
        top = trigger.top - tooltip.height - gap
        left = trigger.left + (trigger.width - tooltip.width) / 2
        break
      case 'bottom':
        top = trigger.bottom + gap
        left = trigger.left + (trigger.width - tooltip.width) / 2
        break
      case 'left':
        top = trigger.top + (trigger.height - tooltip.height) / 2
        left = trigger.left - tooltip.width - gap
        break
      case 'right':
        top = trigger.top + (trigger.height - tooltip.height) / 2
        left = trigger.right + gap
        break
    }

    // Flip position if tooltip would overflow viewport
    if (position === 'top' && top < viewportPadding) {
      top = trigger.bottom + gap
      finalPosition = 'bottom'
    } else if (
      position === 'bottom' &&
      top + tooltip.height > window.innerHeight - viewportPadding
    ) {
      top = trigger.top - tooltip.height - gap
      finalPosition = 'top'
    } else if (position === 'left' && left < viewportPadding) {
      left = trigger.right + gap
      finalPosition = 'right'
    } else if (position === 'right' && left + tooltip.width > window.innerWidth - viewportPadding) {
      left = trigger.left - tooltip.width - gap
      finalPosition = 'left'
    }

    // Keep tooltip within horizontal viewport bounds
    if (left < viewportPadding) {
      left = viewportPadding
    } else if (left + tooltip.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - tooltip.width - viewportPadding
    }

    // Keep tooltip within vertical viewport bounds
    if (top < viewportPadding) {
      top = viewportPadding
    } else if (top + tooltip.height > window.innerHeight - viewportPadding) {
      top = window.innerHeight - tooltip.height - viewportPadding
    }

    setActualPosition(finalPosition)
    setTooltipStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`
    })
  }, [position])

  // Position the tooltip when it becomes visible
  useEffect(() => {
    if (!isVisible) return

    // Use requestAnimationFrame to ensure tooltip is rendered before calculating position
    const rafId = requestAnimationFrame(() => {
      calculatePosition()
    })

    return () => cancelAnimationFrame(rafId)
  }, [isVisible, calculatePosition])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (isDisabled) {
    return <>{children}</>
  }

  // Render tooltip in a portal to avoid z-index and overflow issues
  const tooltipElement =
    isVisible && content ? (
      <div
        ref={tooltipRef}
        role="tooltip"
        style={tooltipStyle}
        className={cn(
          'z-[99999] min-w-[120px] max-w-sm animate-in fade-in-0 zoom-in-95 duration-100',
          'rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-xl',
          'dark:bg-gray-800 dark:text-gray-100',
          'pointer-events-none',
          className
        )}
      >
        {content}
        {/* Arrow */}
        <div
          className={cn(
            'absolute h-2.5 w-2.5 rotate-45 bg-gray-900 dark:bg-gray-800',
            actualPosition === 'top' && 'bottom-[-5px] left-1/2 -translate-x-1/2',
            actualPosition === 'bottom' && 'top-[-5px] left-1/2 -translate-x-1/2',
            actualPosition === 'left' && 'right-[-5px] top-1/2 -translate-y-1/2',
            actualPosition === 'right' && 'left-[-5px] top-1/2 -translate-y-1/2'
          )}
        />
      </div>
    ) : null

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </div>
  )
}
