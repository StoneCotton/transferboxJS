/**
 * Application Menu Configuration
 * Creates platform-specific native menus with keyboard shortcuts
 */

import { app, Menu, shell, BrowserWindow, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types'
import type { MenuItemConstructorOptions } from 'electron'
import { cancelCurrentTransfer } from './ipc'

/**
 * Creates and sets the application menu
 * @param mainWindow - The main browser window for IPC communication
 */
export function createApplicationMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  // Get app info from package.json
  const appName = app.getName()

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: appName,
            submenu: [
              {
                label: `About ${appName}`,
                click: () => showAboutDialog(mainWindow)
              },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'Cmd+,',
                click: () => {
                  mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_SETTINGS)
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Transfer',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            mainWindow.webContents.send(IPC_CHANNELS.MENU_NEW_TRANSFER)
          }
        },
        {
          label: 'Set Destination Folder...',
          accelerator: isMac ? 'Cmd+D' : 'Ctrl+D',
          click: () => {
            // Send event to renderer to trigger folder selection (same as clicking the button)
            mainWindow.webContents.send(IPC_CHANNELS.MENU_SELECT_DESTINATION)
          }
        },
        { type: 'separator' as const },
        ...(isMac
          ? []
          : [
              {
                label: 'Settings...',
                accelerator: 'Ctrl+,',
                click: () => {
                  mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_SETTINGS)
                }
              },
              { type: 'separator' as const }
            ]),
        ...(isMac
          ? []
          : [
              {
                label: 'Quit',
                accelerator: 'Ctrl+Q',
                click: () => {
                  app.quit()
                }
              }
            ])
      ]
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'Ctrl+,',
                click: () => {
                  mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_SETTINGS)
                }
              }
            ])
      ]
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
          click: () => {
            mainWindow.reload()
          }
        },
        ...(is.dev
          ? [
              {
                label: 'Toggle Developer Tools',
                accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                click: () => {
                  mainWindow.webContents.toggleDevTools()
                }
              }
            ]
          : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },

    // Transfer Menu
    {
      label: 'Transfer',
      submenu: [
        {
          label: 'Cancel Transfer',
          accelerator: isMac ? 'Cmd+.' : 'Ctrl+.',
          enabled: false, // Initially disabled, enabled when transfer starts
          click: async () => {
            try {
              await cancelCurrentTransfer()
            } catch (error) {
              const { getLogger } = await import('./logger')
              getLogger().error('Failed to cancel transfer', {
                error: error instanceof Error ? error.message : String(error)
              })
              dialog.showErrorBox('Error', 'Failed to cancel transfer')
            }
          }
        },
        { type: 'separator' as const },
        {
          label: 'View Transfer History',
          accelerator: isMac ? 'Cmd+H' : 'Ctrl+H',
          click: () => {
            mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_HISTORY)
          }
        }
      ]
    },

    // Window Menu (macOS only)
    ...(isMac
      ? [
          {
            label: 'Window',
            submenu: [
              { role: 'minimize' as const },
              { role: 'zoom' as const },
              { type: 'separator' as const },
              { role: 'front' as const }
            ]
          }
        ]
      : []),

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Coming Soon',
              message: 'Documentation integration is coming soon!',
              detail: 'This feature is not available yet.',
              buttons: ['OK']
            })
          }
          // label: 'Documentation',
          // click: async () => {
          //   await shell.openExternal('https://tylersaari.net')
          // }
        },
        {
          label: 'Check for Updates',
          click: async () => {
            try {
              const currentVersion = app.getVersion()
              const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Check for Updates',
                message: 'Check for Updates',
                detail: `Current version: ${currentVersion}\n\nVisit the releases page to check for updates?`,
                buttons: ['Visit Releases', 'Cancel'],
                defaultId: 0,
                cancelId: 1
              })

              if (result.response === 0) {
                await shell.openExternal('https://github.com/StoneCotton/transferboxJS/releases')
              }
            } catch (error) {
              const { getLogger } = await import('./logger')
              getLogger().error('Failed to check for updates', {
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }
        },
        {
          // label: 'Report Issue',
          // click: async () => {
          //   await shell.openExternal('https://github.com/StoneCotton/transferboxJS/issues')
          // }
          label: 'Report Issue',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Report Issue',
              message: 'Report Issue',
              detail:
                'This feature is not available yet. You will be able to report issues directly inside the app in a future update.',
              buttons: ['OK']
            })
          }
        },
        {
          // The "View Changelog" functionality will be re-enabled once implemented:
          // label: 'View Changelog',
          // click: async () => {
          //   await shell.openExternal(
          //     'https://github.com/StoneCotton/transferboxJS/blob/main/CHANGELOG.md'
          //   )
          // },

          label: 'View Changelog',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Coming Soon',
              message: 'Changelog integration is coming soon!',
              detail:
                'This feature is not available yet. You will be able to view the changelog directly inside the app in a future update.',
              buttons: ['OK']
            })
          }
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              {
                label: `About ${appName}`,
                click: () => showAboutDialog(mainWindow)
              }
            ])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * Shows the About dialog with app information
 * @param mainWindow - The main browser window
 */
function showAboutDialog(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const appName = app.getName()
  const appVersion = app.getVersion()

  if (isMac) {
    // Use native macOS About panel
    app.setAboutPanelOptions({
      applicationName: appName,
      applicationVersion: appVersion,
      version: appVersion,
      copyright: `© ${new Date().getFullYear()} Created by Tyler Saari`,
      credits: 'TransferBox is a media ingest utility for professional workflows.',
      website: 'https://tylersaari.net'
    })
    app.showAboutPanel()
  } else {
    // Custom dialog for Windows/Linux
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: `About ${appName}`,
      message: appName,
      detail: `Version: ${appVersion}\n\nTransferBox is a media ingest utility for professional workflows.\n\n© ${new Date().getFullYear()} Created by Tyler Saari\n\nhttps://tylersaari.net`,
      buttons: ['OK']
    })
  }
}

/**
 * Updates menu items based on transfer state
 * @param isTransferring - Whether a transfer is currently in progress
 */
export function updateMenuForTransferState(isTransferring: boolean): void {
  const menu = Menu.getApplicationMenu()
  if (!menu) return

  // Find the Transfer menu
  const transferMenu = menu.items.find((item) => item.label === 'Transfer')
  if (!transferMenu || !transferMenu.submenu) return

  // Update Cancel Transfer item
  const cancelItem = transferMenu.submenu.items.find((item) => item.label === 'Cancel Transfer')
  if (cancelItem) {
    cancelItem.enabled = isTransferring
  }
}
