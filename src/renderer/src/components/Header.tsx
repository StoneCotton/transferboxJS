/**
 * Header Component
 */

import { useState, useEffect } from 'react'
import { Settings, History, FileText } from 'lucide-react'
import { Button } from './ui/Button'
import { useUIStore } from '../store'
import logoImage from '../assets/logo.png'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function Header() {
  const { toggleSettings, toggleHistory, toggleLogs } = useUIStore()
  const [appVersion, setAppVersion] = useState<string>('1.0.0')

  useEffect(() => {
    // Get app version from main process
    window.api
      .getAppVersion()
      .then((version: string) => {
        setAppVersion(version)
      })
      .catch(() => {
        // Fallback to package.json version if IPC fails
        setAppVersion('1.0.0')
      })
  }, [])

  return (
    <header className="relative border-b border-white/20 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-gray-800/50 dark:bg-gray-900/80">
      {/* Gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300" />

      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            {/* Animated gradient background */}
            <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 opacity-20 blur-sm" />
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xl shadow-brand-500/30 ring-2 ring-brand-400">
              <img src={logoImage} alt="TransferBox" className="h-10 w-10 object-contain" />
            </div>
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-2xl font-black tracking-tight text-transparent dark:from-brand-400 dark:via-brand-300 dark:to-brand-200">
              TransferBox
            </h1>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Professional Media Transfer Tool | v{appVersion}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHistory}
            title="Transfer History"
            className="hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-400"
          >
            <History className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">History</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLogs}
            title="View Logs"
            className="hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">Logs</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSettings}
            title="Settings"
            className="hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Settings className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
