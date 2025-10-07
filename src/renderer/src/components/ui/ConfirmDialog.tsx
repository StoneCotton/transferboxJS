/**
 * Confirmation Dialog Component
 * A reusable confirmation dialog for destructive actions
 */

import { Button } from './Button'
import { Card } from './Card'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
          card: 'border-red-200'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600',
          card: 'border-yellow-200'
        }
      case 'info':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-blue-500" />,
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
          card: 'border-blue-200'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <Card
        className={`w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-2 ${styles.card}`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {styles.icon}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Message */}
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="px-4 py-2">
              {cancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-4 py-2 ${styles.confirmButton}`}
            >
              {isLoading ? 'Processing...' : confirmText}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
