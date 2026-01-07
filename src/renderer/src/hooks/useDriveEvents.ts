/**
 * Drive Event Handlers Hook
 * Handles drive detection, removal, and auto-transfer logic
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { useIpc } from './useIpc'
import { playErrorSound } from '../utils/soundManager'
import type { DriveInfo } from '../../../shared/types'

/**
 * Handles auto-scan for drive in auto-transfer or confirm-transfer mode
 */
async function handleAutoScan(
  drive: DriveInfo,
  ipc: ReturnType<typeof useIpc>,
  mode: 'auto-transfer' | 'confirm-transfer'
): Promise<void> {
  const store = useStore.getState()
  const modeLabel = mode === 'auto-transfer' ? 'Mode 1' : 'Mode 2'

  console.log(`[${modeLabel}] Auto-scanning drive...`)
  try {
    store.setScanInProgress(true)
    const result = await ipc.scanDrive(drive.device)
    store.setScannedFiles(result.files)
    store.selectDrive(result.driveInfo || drive)

    if (result.files.length > 0) {
      store.addToast({
        type: 'success',
        message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
        duration: 3000
      })
    } else {
      store.addToast({
        type: 'warning',
        message: 'Scan complete: No valid files found on drive',
        duration: 4000
      })
      console.log(`[${modeLabel}] No valid files found on drive - playing error sound`)
      playErrorSound()
    }
  } catch (error) {
    console.error('Auto-scan failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Auto-scan failed'
    store.setScanError(errorMessage)
    store.addToast({
      type: 'error',
      message: `Scan failed: ${errorMessage}`,
      duration: 5000
    })
    playErrorSound()
  } finally {
    store.setScanInProgress(false)
  }
}

/**
 * Handles fully autonomous transfer mode
 */
async function handleFullyAutonomousTransfer(
  drive: DriveInfo,
  ipc: ReturnType<typeof useIpc>
): Promise<void> {
  const store = useStore.getState()
  const config = store.config

  if (!config.defaultDestination) {
    console.log('[Mode 3] No default destination configured')
    return
  }

  console.log('[Mode 3] Fully autonomous transfer starting...')
  try {
    store.setScanInProgress(true)
    const result = await ipc.scanDrive(drive.device)
    store.setScannedFiles(result.files)

    if (result.files.length > 0) {
      store.addToast({
        type: 'success',
        message: `Scan complete: Found ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
        duration: 3000
      })
    } else {
      store.addToast({
        type: 'warning',
        message: 'Scan complete: No valid files found on drive',
        duration: 4000
      })
      console.log('[Mode 3] No valid files found on drive - playing error sound')
      playErrorSound()
      return
    }

    // Extract file paths and validate
    const filePaths = result.files.map((file) => file.path)
    const emptyPaths = filePaths.filter((path, index) => {
      if (!path || path.trim() === '') {
        console.error(`[Fully-autonomous] Empty file path at index ${index}:`, result.files[index])
        return true
      }
      return false
    })

    if (emptyPaths.length > 0) {
      console.error(`[Fully-autonomous] Found ${emptyPaths.length} empty file paths!`)
    }

    // Run pre-transfer validation
    console.log('[Fully-autonomous] Validating transfer...')
    const validation = await ipc.validateTransfer({
      driveInfo: drive,
      sourceRoot: drive.mountpoints[0] || '',
      destinationRoot: config.defaultDestination,
      files: filePaths
    })

    if (!validation.canProceed) {
      console.error('[Fully-autonomous] Validation failed:', validation.error)
      store.addToast({
        type: 'error',
        message: validation.error || 'Transfer validation failed',
        duration: 5000
      })
      playErrorSound()
      return
    }

    // Handle conflicts based on config
    let finalFilePaths = filePaths
    if (validation.conflicts.length > 0) {
      console.log(`[Fully-autonomous] ${validation.conflicts.length} file conflicts detected`)

      if (config.conflictResolution === 'skip') {
        const conflictPaths = new Set(validation.conflicts.map((c) => c.sourcePath))
        finalFilePaths = filePaths.filter((p) => !conflictPaths.has(p))
        console.log(`[Fully-autonomous] Skipping ${validation.conflicts.length} conflicting files`)
      } else if (config.conflictResolution === 'ask') {
        store.addToast({
          type: 'warning',
          message: `${validation.conflicts.length} file conflicts - skipping in autonomous mode`,
          duration: 4000
        })
        const conflictPaths = new Set(validation.conflicts.map((c) => c.sourcePath))
        finalFilePaths = filePaths.filter((p) => !conflictPaths.has(p))
      }
    }

    if (finalFilePaths.length === 0) {
      store.addToast({
        type: 'warning',
        message: 'No files to transfer after conflict resolution',
        duration: 4000
      })
      return
    }

    const request = {
      driveInfo: drive,
      sourceRoot: drive.mountpoints[0] || '',
      destinationRoot: config.defaultDestination,
      files: finalFilePaths
    }

    console.log('[Fully-autonomous] Starting transfer with request:', {
      ...request,
      fileCount: request.files.length,
      firstFile: request.files[0],
      lastFile: request.files[request.files.length - 1]
    })

    await ipc.startTransfer(request)
    store.addToast({
      type: 'info',
      message: `Transfer started: ${finalFilePaths.length} file${finalFilePaths.length === 1 ? '' : 's'}`,
      duration: 3000
    })
    store.startTransfer({
      id: `transfer-${Date.now()}`,
      driveId: drive.device,
      driveName: drive.displayName,
      sourceRoot: request.sourceRoot,
      destinationRoot: config.defaultDestination,
      startTime: Date.now(),
      endTime: null,
      status: 'transferring',
      fileCount: finalFilePaths.length,
      totalBytes: 0,
      files: []
    })
  } catch (error) {
    console.error('Auto-transfer failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Auto-transfer failed'
    store.setScanError(errorMessage)
    store.addToast({
      type: 'error',
      message: `Scan failed: ${errorMessage}`,
      duration: 5000
    })
    playErrorSound()
  } finally {
    store.setScanInProgress(false)
  }
}

/**
 * Hook to handle drive detection and removal events
 */
export function useDriveEvents(): void {
  const ipc = useIpc()

  useEffect(() => {
    const unsubDriveDetected = ipc.onDriveDetected(async (drive) => {
      console.log('[useDriveEvents] Drive detected:', drive)
      const store = useStore.getState()

      const isExisting = store.isExistingDrive(drive.device)
      store.addDrive(drive)

      store.addToast({
        type: 'info',
        message: `Drive detected: ${drive.displayName}`,
        duration: 3000
      })

      const config = store.config

      // For existing drives in auto modes, don't auto-scan
      if (
        isExisting &&
        (config.transferMode === 'fully-autonomous' || config.transferMode === 'auto-transfer')
      ) {
        console.log(
          `[${config.transferMode}] Existing drive detected - available for manual selection (no auto-scan)`
        )
        return
      }

      // Mode-based auto-transfer logic (only for newly inserted drives)
      if (config.transferMode === 'fully-autonomous' && config.defaultDestination) {
        await handleFullyAutonomousTransfer(drive, ipc)
      } else if (config.transferMode === 'auto-transfer') {
        await handleAutoScan(drive, ipc, 'auto-transfer')
      } else if (config.transferMode === 'confirm-transfer') {
        await handleAutoScan(drive, ipc, 'confirm-transfer')
      }
      // Mode 'manual': Do nothing, user manually selects everything
    })

    const unsubDriveRemoved = ipc.onDriveRemoved((device) => {
      console.log('[useDriveEvents] Drive removed:', device)
      const store = useStore.getState()
      const drive = store.detectedDrives.find((d) => d.device === device)
      store.removeDrive(device)
      store.addToast({
        type: 'info',
        message: drive ? `Drive removed: ${drive.displayName}` : 'Drive removed',
        duration: 3000
      })
    })

    const unsubDriveUnmounted = ipc.onDriveUnmounted((device) => {
      console.log('[useDriveEvents] Drive unmounted event received:', device)
      const store = useStore.getState()
      console.log(
        '[useDriveEvents] Current detectedDrives:',
        store.detectedDrives.map((d) => d.device)
      )
      console.log('[useDriveEvents] Current unmountedDrives before:', store.unmountedDrives)
      store.markDriveAsUnmounted(device)
      console.log('[useDriveEvents] Current unmountedDrives after:', store.unmountedDrives)
    })

    return () => {
      unsubDriveDetected()
      unsubDriveRemoved()
      unsubDriveUnmounted()
    }
  }, [ipc])
}
