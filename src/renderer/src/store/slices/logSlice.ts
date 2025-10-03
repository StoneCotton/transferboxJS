/**
 * Log Store Slice
 * Manages application logs
 */

import type { StateCreator } from 'zustand'
import type { LogState } from '../types'
import type { LogEntry } from '../../../../shared/types'

export interface LogSlice extends LogState {
  // Actions
  setLogs: (logs: LogEntry[]) => void
  addLog: (log: LogEntry) => void
  setFilter: (filter: string) => void
  setLevel: (level: LogState['level']) => void
  clearLogs: () => void
  getFilteredLogs: () => LogEntry[]
}

export const createLogSlice: StateCreator<LogSlice> = (set, get) => ({
  // Initial state
  logs: [],
  filter: '',
  level: 'all',

  // Actions
  setLogs: (logs) => set({ logs }),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs]
    })),

  setFilter: (filter) => set({ filter }),

  setLevel: (level) => set({ level }),

  clearLogs: () => set({ logs: [] }),

  getFilteredLogs: () => {
    const state = get()
    let filtered = state.logs

    // Filter by level
    if (state.level !== 'all') {
      filtered = filtered.filter((log) => log.level === state.level)
    }

    // Filter by search term
    if (state.filter) {
      const searchTerm = state.filter.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchTerm) ||
          JSON.stringify(log.context).toLowerCase().includes(searchTerm)
      )
    }

    return filtered
  }
})
