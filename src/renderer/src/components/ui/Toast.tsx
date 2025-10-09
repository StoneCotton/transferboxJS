/**
 * Toast Notification Component
 * Displays temporary notification messages
 */

import { useEffect } from 'react'
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

function Toast({ id, type, message, duration }: ToastProps) {
  const removeToast = useStore((state) => state.removeToast)

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        removeToast(id)
      }, duration)

      return () => clearTimeout(timer)
    }
    return undefined
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

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-right',
        colorClasses[type]
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconClasses[type])} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
