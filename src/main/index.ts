import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, lockVault, loadSettings } from './ipcHandlers'
import { setSetting } from './db'
import { startProcessMonitor, stopProcessMonitor, toggleOverlay, getCurrentRiotState } from './windowManager'

process.on('uncaughtException', (err) => {
  console.error('[Umbral Main] Uncaught Exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Umbral Main] Unhandled Rejection:', reason)
})

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

/**
 * Loads the crisp app icon (dark black background + full white Riot fist).
 */
function getAppIcon(): NativeImage {
  const primaryPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(primaryPath)
  if (!icon.isEmpty()) return icon
  return nativeImage.createFromPath(join(app.getAppPath(), 'resources/icon.png'))
}

/**
 * Loads the crisp 32x32 icon for the Windows system tray.
 */
function createTrayIcon(): NativeImage {
  const trayPath = join(__dirname, '../../resources/tray.png')
  const icon = nativeImage.createFromPath(trayPath)
  if (!icon.isEmpty()) return icon
  return getAppIcon()
}

function createMainWindow(): BrowserWindow {
  const settings = loadSettings()
  const isHiddenLaunch = process.argv.includes('--hidden') || settings.startMinimized
  const appIcon = getAppIcon()

  const defaultWidth = 1400
  const defaultHeight = 820
  const initialWidth = (settings as any).windowWidth || defaultWidth
  const initialHeight = (settings as any).windowHeight || defaultHeight

  const win = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101012',
    title: 'Umbral',
    icon: appIcon,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#a1a1aa',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setIcon(appIcon)

  win.on('ready-to-show', () => {
    win.webContents.setZoomFactor(settings.zoomFactor ?? 1.15)
    if (!isHiddenLaunch) {
      win.show()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(settings.zoomFactor ?? 1.15)
  })

  // Save resized dimensions to settings
  win.on('resized', () => {
    try {
      const [w, h] = win.getSize()
      const current = loadSettings()
      setSetting('settings', JSON.stringify({ ...current, windowWidth: w, windowHeight: h }))
    } catch {}
  })

  // Intercept close button to hide to system tray instead of quitting
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Lock vault on minimize if configured
  win.on('minimize', () => {
    const s = loadSettings()
    if (s.lockOnMinimize) {
      lockVault()
      win.webContents.send('vault:locked')
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 280,
    height: 350,
    x: 0,
    y: 0,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const baseUrl = process.env['ELECTRON_RENDERER_URL']
    const overlayUrl = baseUrl.endsWith('/') ? `${baseUrl}overlay.html` : `${baseUrl}/overlay.html`
    win.loadURL(overlayUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  // Hide overlay when focus moves to another application (outside Riot Client & overlay)
  win.on('blur', () => {
    setTimeout(() => {
      if (!win.isDestroyed() && win.isVisible()) {
        const state = getCurrentRiotState()
        if (!state.focused) {
          win.hide()
        }
      }
    }, 250)
  })

  return win
}

function createTray(): Tray {
  const icon = createTrayIcon()
  const t = new Tray(icon)
  t.setToolTip('Umbral: Riot Client Password Manager')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Umbral',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Lock Vault',
      click: () => {
        lockVault()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vault:locked')
        }
      }
    },
    {
      label: 'Test Overlay Window',
      click: () => {
        if (overlayWindow) {
          toggleOverlay(overlayWindow)
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Umbral',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  t.setContextMenu(contextMenu)
  t.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return t
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.umbral.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createMainWindow()
  overlayWindow = createOverlayWindow()
  tray = createTray()

  registerIpcHandlers(overlayWindow)

  // Register Global Shortcut: Ctrl+Shift+O to force-toggle overlay on screen
  try {
    const registered = globalShortcut.register('CommandOrControl+Shift+O', () => {
      if (overlayWindow) {
        console.log('[Umbral Shortcut] Ctrl+Shift+O triggered')
        toggleOverlay(overlayWindow)
      }
    })
    if (registered) {
      console.log('[Umbral Shortcut] Registered global shortcut: Ctrl+Shift+O (Overlay test toggle)')
    }
  } catch (e: any) {
    console.error('[Umbral Shortcut] Failed to register global shortcut:', e)
  }

  // Start Riot Client process detection & window coordinate tracker
  startProcessMonitor(overlayWindow, (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('riot:stateChanged', state)
    }
  })

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (isQuitting) {
      stopProcessMonitor()
      app.quit()
    }
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('before-quit', () => {
  isQuitting = true
  stopProcessMonitor()
  tray?.destroy()
})
