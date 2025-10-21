/**
 * Mock for Electron module
 * Used in Jest tests to mock Electron APIs
 */

export const app = {
  getVersion: jest.fn(() => '2.0.1-beta.0'),
  getPath: jest.fn((name: string) => {
    const paths = {
      userData: '/tmp/test-userdata',
      home: '/tmp/test-home',
      temp: '/tmp/test-temp',
      exe: '/tmp/test-exe',
      appData: '/tmp/test-appdata'
    }
    return paths[name as keyof typeof paths] || '/tmp/test-default'
  }),
  getName: jest.fn(() => 'TransferBox'),
  on: jest.fn(),
  once: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve())
}

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
}

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
}

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(() => Promise.resolve()),
  loadFile: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  once: jest.fn(),
  webContents: {
    on: jest.fn(),
    send: jest.fn(),
    openDevTools: jest.fn()
  }
}))

export const dialog = {
  showOpenDialog: jest.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
  showSaveDialog: jest.fn(() => Promise.resolve({ canceled: true, filePath: '' })),
  showMessageBox: jest.fn(() => Promise.resolve({ response: 0 }))
}

export const shell = {
  showItemInFolder: jest.fn(),
  openPath: jest.fn(() => Promise.resolve(''))
}
