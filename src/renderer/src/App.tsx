/**
 * Main App Component
 */

import React from 'react'
import { useAppInit } from './hooks/useAppInit'
import { Header } from './components/Header'
import { DriveSelector } from './components/DriveSelector'
import { DestinationSelector } from './components/DestinationSelector'
import { FileList } from './components/FileList'
import { TransferProgress } from './components/TransferProgress'
import { TransferActions } from './components/TransferActions'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { ModeIndicator } from './components/ModeIndicator'
import { LogViewer } from './components/LogViewer'
import { HistoryViewer } from './components/HistoryViewer'
import { useDriveStore, useUIStore, useTransferStore, useConfigStore } from './store'
import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { cn } from './lib/utils'
import type { TransferMode } from '../../shared/types'

function App() {
  // Initialize app - loads config, sets up IPC listeners
  useAppInit()

  const { selectedDrive, scannedFiles } = useDriveStore()
  const { selectedDestination, showLogs, showHistory, closeAllModals } = useUIStore()
  const { isTransferring, progress } = useTransferStore()
  const { config } = useConfigStore()

  // Calculate step completion based on transfer mode
  const step1Complete = !!selectedDrive
  const step2Complete = !!selectedDestination
  const step3Complete = scannedFiles.length > 0

  // Determine which components to show based on transfer mode
  const shouldShowDestinationSelector = (mode: TransferMode): boolean => {
    return mode !== 'fully-autonomous' // Hide in fully autonomous mode
  }

  const shouldShowTransferActions = (mode: TransferMode): boolean => {
    return mode === 'manual' || mode === 'confirm-transfer' // Show in manual and confirm modes
  }

  const shouldShowFileList = (mode: TransferMode): boolean => {
    return true // Always show file list
  }

  // Get workflow steps based on transfer mode
  const getWorkflowSteps = (mode: TransferMode) => {
    switch (mode) {
      case 'fully-autonomous':
        return [
          { id: 1, label: 'Select Drive', complete: step1Complete },
          { id: 2, label: 'Auto Transfer', complete: step1Complete && step3Complete }
        ]
      case 'auto-transfer':
        return [
          { id: 1, label: 'Select Drive', complete: step1Complete },
          { id: 2, label: 'Set Destination', complete: step2Complete },
          {
            id: 3,
            label: 'Auto Transfer',
            complete: step1Complete && step2Complete && step3Complete
          }
        ]
      case 'confirm-transfer':
        return [
          { id: 1, label: 'Select Drive', complete: step1Complete },
          { id: 2, label: 'Set Destination', complete: step2Complete },
          {
            id: 3,
            label: 'Confirm Transfer',
            complete: step1Complete && step2Complete && step3Complete
          }
        ]
      case 'manual':
      default:
        return [
          { id: 1, label: 'Select Drive', complete: step1Complete },
          { id: 2, label: 'Set Destination', complete: step2Complete },
          {
            id: 3,
            label: 'Start Transfer',
            complete: step1Complete && step2Complete && step3Complete
          }
        ]
    }
  }

  const workflowSteps = getWorkflowSteps(config.transferMode)

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-brand-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Mode Indicator */}
          <div className="mb-6 flex justify-center">
            <ModeIndicator />
          </div>

          {/* Dynamic Workflow Steps Indicator */}
          <div className="mb-8 flex items-center justify-center gap-4">
            {workflowSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                {/* Step Circle */}
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    step.complete
                      ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : index === 0 || (index > 0 && workflowSteps[index - 1]?.complete)
                        ? 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                        : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
                  )}
                >
                  {step.complete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : index === 0 || (index > 0 && workflowSteps[index - 1]?.complete) ? (
                    <CircleDot className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    'hidden text-sm font-semibold md:inline',
                    step.complete
                      ? 'text-green-700 dark:text-green-400'
                      : index === 0 || (index > 0 && workflowSteps[index - 1]?.complete)
                        ? 'text-brand-700 dark:text-brand-400'
                        : 'text-gray-400 dark:text-gray-600'
                  )}
                >
                  {step.label}
                </span>

                {/* Connector (not shown after last step) */}
                {index < workflowSteps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-12 rounded-full transition-all md:w-20',
                      step.complete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Transfer Progress (shown when transferring) */}
          {(isTransferring || progress) && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <TransferProgress />
            </div>
          )}

          {/* Dynamic Main Content Grid */}
          <div className="space-y-6">
            {/* Top Section: Drive & Destination */}
            <div
              className={cn(
                'grid gap-6',
                shouldShowDestinationSelector(config.transferMode)
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : 'grid-cols-1'
              )}
            >
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <DriveSelector />
              </div>
              {shouldShowDestinationSelector(config.transferMode) && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
                  <DestinationSelector />
                </div>
              )}
            </div>

            {/* Transfer Actions - Show above FileList for both manual and confirm-transfer modes */}
            {shouldShowTransferActions(config.transferMode) && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <TransferActions />
              </div>
            )}

            {/* File List */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
              <FileList />
            </div>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      <SettingsModal />

      {/* Logs and History Viewers */}
      {showLogs && <LogViewer onClose={() => closeAllModals()} />}
      {showHistory && <HistoryViewer onClose={() => closeAllModals()} />}
    </div>
  )
}

export default App
