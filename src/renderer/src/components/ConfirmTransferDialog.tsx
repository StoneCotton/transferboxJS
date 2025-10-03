/**
 * Confirm Transfer Dialog
 * Used in confirm-transfer mode to require explicit confirmation
 */

import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { formatBytes } from '../lib/utils'

interface ConfirmTransferDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  fileCount: number
  driveName: string
  destination: string | null
  totalSize?: number
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ConfirmTransferDialog({
  isOpen,
  onConfirm,
  onCancel,
  fileCount,
  driveName,
  destination,
  totalSize
}: ConfirmTransferDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Confirm Transfer" size="md">
      <div className="space-y-6">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
            <AlertTriangle className="h-8 w-8 text-brand-600 dark:text-brand-400" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            Ready to start transfer?
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please confirm the transfer details before proceeding
          </p>
        </div>

        {/* Transfer Details */}
        <div className="space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Source</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{driveName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Files</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {fileCount} file{fileCount !== 1 ? 's' : ''}
            </span>
          </div>
          {totalSize !== undefined && totalSize > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Size</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatBytes(totalSize)}
              </span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Destination
            </span>
            <span className="max-w-[200px] truncate text-right text-sm font-bold text-gray-900 dark:text-white">
              {destination || 'Not set'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="flex-1 hover:bg-red-50 hover:text-red-600"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!destination}
            className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 text-white"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Start Transfer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
