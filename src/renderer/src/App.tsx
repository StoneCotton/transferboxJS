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

function App() {
  // Initialize app - loads config, sets up IPC listeners
  useAppInit()

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Top Section: Drive & Destination */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DriveSelector />
            <DestinationSelector />
          </div>

          {/* Transfer Progress (shown when transferring) */}
          <TransferProgress />

          {/* File List */}
          <FileList />

          {/* Transfer Actions */}
          <TransferActions />
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}

export default App
