/**
 * Transfer Actions Component
 */

import { Play, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useDriveStore, useTransferStore, useUIStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'

export function TransferActions() {
  const { selectedDrive, scannedFiles } = useDriveStore()
  const { isTransferring, startTransfer } = useTransferStore()
  const { selectedDestination } = useUIStore()
  const ipc = useIpc()
  const [isStarting, setIsStarting] = useState(false)

  const canTransfer =
    selectedDrive && scannedFiles.length > 0 && selectedDestination && !isTransferring

  const handleStartTransfer = async () => {
    if (!canTransfer || !selectedDrive || !selectedDestination) return

    try {
      setIsStarting(true)

      // Create transfer request
      const request = {
        driveInfo: selectedDrive,
        sourceRoot: selectedDrive.mountpoints[0] || '',
        destinationRoot: selectedDestination,
        files: scannedFiles
      }

      // Start the transfer via IPC
      await ipc.startTransfer(request)

      // Update store
      startTransfer({
        id: `transfer-${Date.now()}`,
        driveId: selectedDrive.device,
        driveName: selectedDrive.displayName,
        sourceRoot: request.sourceRoot,
        destinationRoot: selectedDestination,
        startTime: Date.now(),
        endTime: null,
        status: 'transferring',
        fileCount: scannedFiles.length,
        totalBytes: 0,
        files: []
      })
    } catch (error) {
      console.error('Failed to start transfer:', error)
      alert(`Failed to start transfer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <Button
          onClick={handleStartTransfer}
          disabled={!canTransfer || isStarting}
          className="w-full"
          size="lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Starting Transfer...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Start Transfer
            </>
          )}
        </Button>

        {!canTransfer && !isTransferring && (
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            {!selectedDrive
              ? 'Select a drive first'
              : !selectedDestination
                ? 'Select a destination folder'
                : scannedFiles.length === 0
                  ? 'No media files to transfer'
                  : 'Ready to transfer'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
