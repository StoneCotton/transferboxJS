/**
 * Main App Component
 */

import { useAppInit } from './hooks/useAppInit'
import { useUiDensity } from './hooks/useUiDensity'
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
import { NewerConfigDialog } from './components/NewerConfigDialog'
import { ToastContainer } from './components/ui/Toast'
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
  const { isCondensed } = useUiDensity()

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
    <div
      className={cn(
        'flex h-screen flex-col bg-gradient-to-br from-slate-50 via-brand-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900',
        isCondensed && 'ui-condensed'
      )}
    >
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className={cn('flex-1 overflow-auto', isCondensed ? 'p-2 md:p-4' : 'p-4 md:p-8')}>
        <div className="mx-auto max-w-7xl">
          {/* Mode Indicator */}
          <div className={cn('flex justify-center', isCondensed ? 'mb-3' : 'mb-6')}>
            <ModeIndicator />
          </div>

          {/* Dynamic Workflow Steps Indicator */}
          <div
            className={cn(
              'flex items-center justify-center',
              isCondensed ? 'mb-4 gap-2' : 'mb-8 gap-4'
            )}
          >
            {workflowSteps.map((step, index) => (
              <div
                key={step.id}
                className={cn('flex items-center', isCondensed ? 'gap-1' : 'gap-2')}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-all',
                    isCondensed ? 'h-7 w-7' : 'h-10 w-10',
                    step.complete
                      ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : index === 0 || (index > 0 && workflowSteps[index - 1]?.complete)
                        ? 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                        : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
                  )}
                >
                  {step.complete ? (
                    <CheckCircle2 className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  ) : index === 0 || (index > 0 && workflowSteps[index - 1]?.complete) ? (
                    <CircleDot className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  ) : (
                    <Circle className={isCondensed ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    'hidden font-semibold md:inline',
                    isCondensed ? 'text-xs' : 'text-sm',
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
                      'h-0.5 rounded-full transition-all',
                      isCondensed ? 'w-6 md:w-10' : 'w-12 md:w-20',
                      step.complete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Transfer Progress (shown when transferring) */}
          {(isTransferring || progress) && (
            <div
              className={cn(
                'animate-in fade-in slide-in-from-top-4 duration-500',
                isCondensed ? 'mb-3' : 'mb-6'
              )}
            >
              <TransferProgress />
            </div>
          )}

          {/* Dynamic Main Content Grid */}
          <div className={isCondensed ? 'space-y-3' : 'space-y-6'}>
            {/* Top Section: Drive & Destination */}
            <div
              className={cn(
                'grid',
                isCondensed ? 'gap-3' : 'gap-6',
                shouldShowDestinationSelector(config.transferMode)
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : 'grid-cols-1'
              )}
            >
              <div className="animate-in fade-in slide-in-from-left-4 duration-500 h-full">
                <DriveSelector />
              </div>
              {shouldShowDestinationSelector(config.transferMode) && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100 h-full">
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
      <NewerConfigDialog />

      {/* Logs and History Viewers */}
      {showLogs && <LogViewer onClose={() => closeAllModals()} />}
      {showHistory && <HistoryViewer onClose={() => closeAllModals()} />}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

export default App
