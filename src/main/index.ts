import { app, shell, BrowserWindow, powerMonitor, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/TransferBox_Icon.png?asset'
import { setupIpcHandlers, startDriveMonitoring, cleanupIpc, isTransferInProgress } from './ipc'
import { getLogger } from './logger'
import { cleanupOrphanedPartFiles } from './fileTransfer'
import { getConfig, getLastMigration, clearLastMigration } from './configManager'
import { IPC_CHANNELS } from '../shared/types'
import { createApplicationMenu } from './menu'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
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

  // Handle window close event with transfer check
  mainWindow.on('close', async (event) => {
    if (isTransferInProgress()) {
      event.preventDefault()

      const result = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'Transfer in Progress',
        message: 'A file transfer is currently in progress.',
        detail: 'Closing the application will cancel the transfer. Are you sure you want to quit?',
        buttons: ['Cancel Transfer & Quit', 'Keep Transfer Running'],
        defaultId: 1, // Default to "Keep Transfer Running"
        cancelId: 1 // ESC key will select "Keep Transfer Running"
      })

      if (result.response === 0) {
        // User chose to cancel transfer and quit
        getLogger().info('User chose to cancel transfer and quit application')
        await cleanupIpc()
        mainWindow = null
        app.quit()
      }
      // If user chose to keep transfer running, do nothing (event.preventDefault() already called)
    } else {
      // No transfer in progress, allow normal close
      getLogger().info('Application closing normally')
      await cleanupIpc()
      mainWindow = null
      app.quit()
    }
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

      // Check for config migration and notify renderer
      const migration = getLastMigration()
      if (migration) {
        getLogger().info('Config migration detected', migration)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.CONFIG_MIGRATED, migration)
          clearLastMigration()
        }
      }
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

  // Create application menu (must be done before window creation for proper initialization)
  createWindow()
  if (mainWindow) {
    createApplicationMenu(mainWindow)
  }

  // Clean up orphaned .TBPART files from previous incomplete transfers
  try {
    const config = getConfig()
    // Ensure logger level is applied from config
    if (config.logLevel) {
      const logger = getLogger()
      const previous = logger.getLevel()
      logger.setLevel(config.logLevel)
      if (previous !== config.logLevel) {
        logger.info('Log level set', { from: previous, to: config.logLevel })
      }
    }
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

  // Schedule daily log retention cleanup if enabled
  try {
    const config = getConfig()
    if (config.autoCleanupLogs && typeof config.logRetentionDays === 'number') {
      const logger = getLogger()
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      setInterval(() => {
        try {
          const deleted = logger.deleteOldLogs(config.logRetentionDays)
          if (deleted > 0) {
            logger.info('Log retention cleanup completed', {
              deleted,
              daysToKeep: config.logRetentionDays
            })
          }
        } catch (cleanupError) {
          logger.warn('Log retention cleanup failed', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          })
        }
      }, ONE_DAY_MS)
      logger.info('Scheduled daily log retention cleanup', {
        daysToKeep: config.logRetentionDays
      })
    }
  } catch {
    // ignore scheduling errors
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

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      if (mainWindow) {
        createApplicationMenu(mainWindow)
      }
    }
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

// App is quitting - cleanup and transfer check
app.on('before-quit', async (event) => {
  if (isTransferInProgress()) {
    event.preventDefault()

    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Transfer in Progress',
      message: 'A file transfer is currently in progress.',
      detail: 'Quitting the application will cancel the transfer. Are you sure you want to quit?',
      buttons: ['Cancel Transfer & Quit', 'Keep Transfer Running'],
      defaultId: 1, // Default to "Keep Transfer Running"
      cancelId: 1 // ESC key will select "Keep Transfer Running"
    })

    if (result.response === 0) {
      // User chose to cancel transfer and quit
      getLogger().info('User chose to cancel transfer and quit application')
      await cleanupIpc()
      app.quit()
    }
    // If user chose to keep transfer running, do nothing (event.preventDefault() already called)
  } else {
    // No transfer in progress, allow normal quit
    getLogger().info('TransferBox shutting down')
    await cleanupIpc()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
