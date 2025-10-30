/**
 * Toast Notification Component
 * Displays temporary notification messages with progress bar countdown and fade-out animation
 */

import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useStore } from '../../store'

export function ToastContainer() {
  const toasts = useStore((state) => state.toasts || [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}

interface ToastProps {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  duration?: number
}

function Toast({ id, type, message, duration = 5000 }: ToastProps) {
  const removeToast = useStore((state) => state.removeToast)
  const [progress, setProgress] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const animationFrameRef = useRef<number>()
  const fadeOutTimerRef = useRef<NodeJS.Timeout>()
  const removeTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!duration) {
      return undefined
    }

    // Reset progress and start time when effect runs
    setProgress(0)
    startTimeRef.current = Date.now()
    setIsExiting(false)

    // Start fade-out animation slightly before removal
    const fadeOutTime = duration - 200 // Start fade 200ms before removal
    fadeOutTimerRef.current = setTimeout(() => {
      setIsExiting(true)
    }, fadeOutTime)

    // Update progress bar - show elapsed time (0% to 100%)
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current
      const newProgress = Math.min(100, (elapsed / duration) * 100)

      setProgress(newProgress)

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updateProgress)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateProgress)

    // Remove toast after duration
    removeTimerRef.current = setTimeout(() => {
      removeToast(id)
    }, duration)

    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current)
      }
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [id, duration, removeToast])

  const Icon =
    type === 'success'
      ? CheckCircle2
      : type === 'warning'
        ? AlertCircle
        : type === 'error'
          ? XCircle
          : Info

  const colorClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
    success:
      'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
    warning:
      'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
    error:
      'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100'
  }

  const iconClasses = {
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400'
  }

  const progressBarClasses = {
    info: 'bg-blue-500 dark:bg-blue-600',
    success: 'bg-green-500 dark:bg-green-600',
    warning: 'bg-amber-500 dark:bg-amber-600',
    error: 'bg-red-500 dark:bg-red-600'
  }

  const handleClose = () => {
    // Cancel existing timers
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current)
    }
    if (removeTimerRef.current) {
      clearTimeout(removeTimerRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    setIsExiting(true)
    // Wait for fade-out animation before removing
    setTimeout(() => {
      removeToast(id)
    }, 200)
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col rounded-lg border-2 shadow-lg backdrop-blur-sm transition-all duration-200',
        isExiting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100 translate-x-0',
        'animate-in slide-in-from-right',
        colorClasses[type]
      )}
    >
      {/* Content */}
      <div className="flex items-start gap-3 p-4">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconClasses[type])} />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={handleClose}
          className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {duration && (
        <div className="h-1 bg-black/5 dark:bg-white/5">
          <div
            className={cn('h-full transition-all duration-75 ease-linear', progressBarClasses[type])}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
