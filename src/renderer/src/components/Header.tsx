/**
 * Header Component
 */

import { Settings, History, FileText } from 'lucide-react'
import { Button } from './ui/Button'
import { useUIStore } from '../store'

export function Header() {
  const { toggleSettings, toggleHistory, toggleLogs } = useUIStore()

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">TransferBox</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Professional Media Transfer Utility
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleHistory} title="Transfer History">
          <History className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">History</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleLogs} title="View Logs">
          <FileText className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Logs</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleSettings} title="Settings">
          <Settings className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Settings</span>
        </Button>
      </div>
    </header>
  )
}
