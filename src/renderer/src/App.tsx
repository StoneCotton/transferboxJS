/**
 * Main App Component
 */

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
import { useDriveStore, useUIStore, useTransferStore } from './store'
import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { cn } from './lib/utils'

function App() {
  // Initialize app - loads config, sets up IPC listeners
  useAppInit()

  const { selectedDrive, scannedFiles } = useDriveStore()
  const { selectedDestination } = useUIStore()
  const { isTransferring, progress } = useTransferStore()

  // Calculate step completion
  const step1Complete = !!selectedDrive
  const step2Complete = !!selectedDestination
  const step3Complete = scannedFiles.length > 0

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

          {/* Workflow Steps Indicator */}
          <div className="mb-8 flex items-center justify-center gap-4">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  step1Complete
                    ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                )}
              >
                {step1Complete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <CircleDot className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-semibold md:inline',
                  step1Complete
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-brand-700 dark:text-brand-400'
                )}
              >
                Select Drive
              </span>
            </div>

            {/* Connector */}
            <div
              className={cn(
                'h-0.5 w-12 rounded-full transition-all md:w-20',
                step1Complete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
              )}
            />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  step2Complete
                    ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : step1Complete
                      ? 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
                )}
              >
                {step2Complete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step1Complete ? (
                  <CircleDot className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-semibold md:inline',
                  step2Complete
                    ? 'text-green-700 dark:text-green-400'
                    : step1Complete
                      ? 'text-brand-700 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-600'
                )}
              >
                Set Destination
              </span>
            </div>

            {/* Connector */}
            <div
              className={cn(
                'h-0.5 w-12 rounded-full transition-all md:w-20',
                step2Complete && step3Complete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
              )}
            />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  step3Complete && step1Complete && step2Complete
                    ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : step2Complete
                      ? 'border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
                )}
              >
                {step3Complete && step1Complete && step2Complete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step2Complete ? (
                  <CircleDot className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-semibold md:inline',
                  step3Complete && step1Complete && step2Complete
                    ? 'text-green-700 dark:text-green-400'
                    : step2Complete
                      ? 'text-brand-700 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-600'
                )}
              >
                Start Transfer
              </span>
            </div>
          </div>

          {/* Transfer Progress (shown when transferring) */}
          {(isTransferring || progress) && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <TransferProgress />
            </div>
          )}

          {/* Main Content Grid */}
          <div className="space-y-6">
            {/* Top Section: Drive & Destination */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <DriveSelector />
              </div>
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
                <DestinationSelector />
              </div>
            </div>

            {/* File List */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
              <FileList />
            </div>

            {/* Transfer Actions */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
              <TransferActions />
            </div>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      <SettingsModal />
    </div>
  )
}

export default App
