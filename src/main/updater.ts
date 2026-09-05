import { ipcMain, BrowserWindow, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { IpcResponse } from '../shared/types'

export interface UpdateInfoState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseDate?: string
  releaseNotes?: string | string[]
  progress?: {
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
  }
  error?: string
}

let currentUpdateState: UpdateInfoState = {
  status: 'idle'
}

let activeMainWindow: BrowserWindow | null = null

function broadcastUpdateState(): void {
  if (activeMainWindow && !activeMainWindow.isDestroyed()) {
    activeMainWindow.webContents.send('updater:statusChanged', currentUpdateState)
  }
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  activeMainWindow = mainWindow

  // Configure autoUpdater
  autoUpdater.logger = console
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // AutoUpdater Event Listeners
  autoUpdater.on('checking-for-update', () => {
    console.log('[Umbral AutoUpdater] Checking for updates...')
    currentUpdateState = { status: 'checking' }
    broadcastUpdateState()
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Umbral AutoUpdater] Update available:', info.version)
    currentUpdateState = {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: (info as any).releaseNotes
    }
    broadcastUpdateState()
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Umbral AutoUpdater] Update not available (current version is up to date)')
    currentUpdateState = { status: 'not-available' }
    broadcastUpdateState()
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[Umbral AutoUpdater] Download progress: ${Math.round(progressObj.percent)}%`)
    currentUpdateState = {
      ...currentUpdateState,
      status: 'downloading',
      progress: {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: Math.round(progressObj.bytesPerSecond),
        transferred: progressObj.transferred,
        total: progressObj.total
      }
    }
    broadcastUpdateState()
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Umbral AutoUpdater] Update downloaded successfully:', info.version)
    currentUpdateState = {
      status: 'downloaded',
      version: info.version
    }
    broadcastUpdateState()
  })

  autoUpdater.on('error', (err) => {
    console.error('[Umbral AutoUpdater] Error:', err)
    currentUpdateState = {
      ...currentUpdateState,
      status: 'error',
      error: err.message || 'Update check or download failed'
    }
    broadcastUpdateState()
  })

  // IPC Handlers for Renderer
  ipcMain.handle('updater:check', async (): Promise<IpcResponse<UpdateInfoState>> => {
    try {
      if (app.isPackaged) {
        await autoUpdater.checkForUpdates()
      } else {
        try {
          await autoUpdater.checkForUpdates()
        } catch (devErr: any) {
          console.log('[Umbral AutoUpdater] Dev check notice:', devErr.message)
        }
      }
      return { status: 'ok', data: currentUpdateState }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('updater:download', async (): Promise<IpcResponse> => {
    try {
      console.log('[Umbral AutoUpdater] Starting downloadUpdate...')
      currentUpdateState = {
        ...currentUpdateState,
        status: 'downloading',
        progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 }
      }
      broadcastUpdateState()
      await autoUpdater.downloadUpdate()
      return { status: 'ok' }
    } catch (e: any) {
      console.error('[Umbral AutoUpdater] downloadUpdate failed:', e)
      currentUpdateState = { ...currentUpdateState, status: 'error', error: e.message }
      broadcastUpdateState()
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('updater:install', (): IpcResponse => {
    try {
      // isSilent: false, isForceRunAfter: true
      autoUpdater.quitAndInstall(false, true)
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('updater:getState', (): IpcResponse<UpdateInfoState> => {
    return { status: 'ok', data: currentUpdateState }
  })

  // Check for updates shortly after startup (after 4 seconds)
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[Umbral AutoUpdater] Initial startup check error:', err)
      })
    }
  }, 4000)

  // Periodic check every 2 hours
  setInterval(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {})
    }
  }, 2 * 60 * 60 * 1000)
}
