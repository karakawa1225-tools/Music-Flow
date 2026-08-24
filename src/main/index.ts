import { app, BrowserWindow, protocol, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase, getSettings, updateSettings } from './database'
import { getAppPaths } from './paths'
import { registerIpcHandlers, registerLocalFileProtocol } from './ipc/handlers'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mf-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function isDev(): boolean {
  return !app.isPackaged
}

function resolveAppIcon(): string {
  if (isDev()) {
    return join(process.cwd(), 'resources', 'icon.ico')
  }
  return join(process.resourcesPath, 'icon.ico')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const settings = getSettings()
  const bounds = settings.windowBounds

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1440,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#0D0D12',
    title: 'MUSIC FLOW',
    icon: resolveAppIcon(),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0D0D12',
      symbolColor: '#F2F2F7',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', () => {
    if (!mainWindow) return
    const [x, y] = mainWindow.getPosition()
    const [width, height] = mainWindow.getSize()
    updateSettings({ windowBounds: { x, y, width, height } })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev() && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (gotTheLock) {
  app.whenReady().then(async () => {
    app.setName('MUSIC FLOW')
    getAppPaths()
    await initDatabase()
    registerLocalFileProtocol()
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      closeDatabase()
      app.quit()
    }
  })

  app.on('before-quit', () => {
    closeDatabase()
  })
}
