/**
 * Header Component
 */

import { useState, useEffect } from 'react'
import { useIpc } from '../hooks/useIpc'
import { Settings, History, FileText } from 'lucide-react'
import { Button } from './ui/Button'
import { useUIStore } from '../store'
import logoImage from '../assets/logo.png'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function Header() {
  const { toggleSettings, toggleHistory, toggleLogs } = useUIStore()
  const [appVersion, setAppVersion] = useState<string>('2.0.0')
  const [sloganIndex, setSloganIndex] = useState<number>(0)
  const ipc = useIpc()

  const slogans = [
    'Offload your footage—no takes needed!',
    "Transfer so fast, you'll think it's rendered in RAM.",
    'Checksum jokes always land—no bit flips.',
    'Lights, Camera, Action... File Copy!',
    'No more dropped frames—just dropped files (where you want them!)',
    "Ingest speed that's Oscar-worthy.",
    'For those who like all their data in the final cut.',
    "Making sure your media doesn't ghost on you.",
    'Playback error? Not on my watch.',
    'I like my bits unflipped and my jokes unmuted.',
    'The only latency here is your laughter.',
    'Frame-accurate, joke-approximate.',
    'Media so secure, not even spoilers can leak.',
    'Encoding at the speed of laughter.',
    'You bring the footage, I’ll bring the puns.',
    'Making your workflow less like work, more like play.',
    'More reliable than a director’s schedule.',
    'My logs never forget—unlike some editors.',
    'Cut, copy, and crack a smile.',
    'Rolling out features like rolling takes.',
    'The only phantom power here is in my punchlines.',
    'I trim errors better than you trim B-roll.',
    'Your backups, as tight as your editing.',
    '3200 ISO? Never that noisy.',
    'Filmmakers approve my export times. And my puns.',
    'Less downtime than a gaffer with coffee.',
    'Slates clap for me (not just the crew).',
    'Dailies? How about hourlies.',
    'Even your metadata laughs at these jokes.',
    'Finishing your day before the render bar does.',
    'Grip-tested for maximum stability.',
    'No drama, just data.',
    'Checksum errors are just deleted scenes here.',
    'Ingest your media, digest these puns.',
    'Less drag than a green screen.',
    'Not a single dropped pixel.',
    'No bogus proxies—just real jokes.',
    'More flexible than a jib arm.',
    'My transfer speeds break the fourth wall.',
    'I don’t render, I transcend.',
    'Final Cut? I’m just getting started.',
    'C-stands envy my uptime.',
    'The only wrap I want is a pun wrap-up.',
    'Slate, camera, copy, laugh.',
    'Double-checking? I call it a punchline.',
    'No director’s cut could improve this transfer.',
    'Cue the confetti—files moved in record time.',
    'Your media’s new best friend on set.',
    'Take five—your files are already here.',
    'Like a steady dolly shot—smooth all the way.',
    'Even your assistant editor will crack up.',
    'The only crash is a joke landing.',
    'Copy that? Copy this: TransferBox rules.',
    'Keeping your rough cuts rough—not your transfers.',
    'Script supervisors approve this message.',
    'No wrap party is complete without me.',
    'Color grading jokes dark, but transfers bright.',
    'Never take a rain check on these checksums.',
    'Drop your files—not your standards.',
    'My punchlines have more effects than After Effects.',
    'Fast, funny, and always in focus.',
    'Born to run—files, not marathons.',
    'Transfer envy is real.',
    'Lights out? Transfers done.',
    'Who needs Adobe Media Encoder amirite',
    'Shut up, Meg',
    'Click around and find out!',
    'I like my bits unflipped and my jokes unmuted.',
    'The only latency here is your laughter.',
    'Frame-accurate, joke-approximate.',
    'Media so secure, not even spoilers can leak.',
    'Encoding at the speed of laughter.',
    'You bring the footage, I’ll bring the puns.',
    'Making your workflow less like work, more like play.',
    'More reliable than a director’s schedule.'
  ]

  useEffect(() => {
    // Get app version from main process
    ipc
      .getAppVersion()
      .then((version: string) => {
        setAppVersion(version)
      })
      .catch(() => {
        // Fallback to package.json version if IPC fails
        setAppVersion('2.0.0')
      })
  }, [ipc])

  useEffect(() => {
    // Choose and persist a random slogan per app launch
    const storedIndex = sessionStorage.getItem('tb:sloganIndex')
    if (storedIndex !== null) {
      const index = parseInt(storedIndex, 10)
      if (Number.isInteger(index) && index >= 0 && index < slogans.length) {
        setSloganIndex(index)
        return
      }
    }

    // Generate new random index and store it
    const randomIndex = Math.floor(Math.random() * slogans.length)
    setSloganIndex(randomIndex)
    sessionStorage.setItem('tb:sloganIndex', String(randomIndex))
  }, [slogans.length])

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
              {slogans[sloganIndex]} · v{appVersion}
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
