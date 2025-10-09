import { app, shell, BrowserWindow, powerMonitor } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/TransferBox_Icon.png?asset'
import { setupIpcHandlers, startDriveMonitoring, cleanupIpc } from './ipc'
import { getLogger } from './logger'
import { cleanupOrphanedPartFiles } from './fileTransfer'
import { getConfig } from './configManager'
import { IPC_CHANNELS } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    title: 'TransferBox',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Start drive monitoring after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      // Explicitly set the window title to ensure it's displayed correctly
      mainWindow.setTitle('TransferBox')
      startDriveMonitoring(mainWindow)
      getLogger().info('TransferBox started')
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.transferbox')

  // Setup IPC handlers
  setupIpcHandlers()

  // Clean up orphaned .TBPART files from previous incomplete transfers
  try {
    const config = getConfig()
    if (config.defaultDestination) {
      const cleaned = await cleanupOrphanedPartFiles(config.defaultDestination)
      if (cleaned > 0) {
        getLogger().info('Startup cleanup completed', {
          orphanedFiles: cleaned,
          directory: config.defaultDestination
        })
      }
    }
  } catch (error) {
    getLogger().warn('Startup cleanup failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Setup power monitoring for system sleep/hibernate detection
  powerMonitor.on('suspend', () => {
    getLogger().warn('System suspending - transfers may be interrupted')
    // Send event to renderer to update UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SYSTEM_SUSPEND)
    }
  })

  powerMonitor.on('resume', () => {
    getLogger().info('System resumed from sleep')
    // Send event to renderer to update UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SYSTEM_RESUME)
    }
  })

  powerMonitor.on('lock-screen', () => {
    getLogger().info('Screen locked')
  })

  powerMonitor.on('unlock-screen', () => {
    getLogger().info('Screen unlocked')
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// App is quitting - cleanup
app.on('before-quit', () => {
  getLogger().info('TransferBox shutting down')
  cleanupIpc()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
