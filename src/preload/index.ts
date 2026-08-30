import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Account, Folder, Settings, IpcResponse, RiotWindowInfo, UmbralAPI } from '../shared/types'

// Set default initial webFrame zoom factor to 1.15 (115% comfortable scaling)
try {
  webFrame.setZoomFactor(1.15)
} catch {}

const api: UmbralAPI = {
  // Vault lifecycle
  vault: {
    isInitialized: (): Promise<IpcResponse<boolean>> => ipcRenderer.invoke('vault:isInitialized'),
    initialize: (masterPassword: string, stayLoggedIn?: boolean): Promise<IpcResponse> =>
      ipcRenderer.invoke('vault:initialize', masterPassword, stayLoggedIn),
    unlock: (masterPassword: string, stayLoggedIn?: boolean): Promise<IpcResponse> =>
      ipcRenderer.invoke('vault:unlock', masterPassword, stayLoggedIn),
    autoUnlock: (): Promise<IpcResponse<boolean>> => ipcRenderer.invoke('vault:autoUnlock'),
    setStayLoggedIn: (enabled: boolean): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('vault:setStayLoggedIn', enabled),
    lock: (): Promise<IpcResponse> => ipcRenderer.invoke('vault:lock'),
    isUnlocked: (): Promise<IpcResponse<boolean>> => ipcRenderer.invoke('vault:isUnlocked'),
    changeMasterPassword: (oldPw: string, newPw: string): Promise<IpcResponse> => ipcRenderer.invoke('vault:changeMasterPassword', oldPw, newPw),
    getAccounts: (): Promise<IpcResponse<Account[]>> => ipcRenderer.invoke('vault:getAccounts'),
    saveAccount: (account: Account): Promise<IpcResponse<Account>> => ipcRenderer.invoke('vault:saveAccount', account),
    deleteAccount: (id: string): Promise<IpcResponse> => ipcRenderer.invoke('vault:deleteAccount', id),
    getFolders: (): Promise<IpcResponse<Folder[]>> => ipcRenderer.invoke('vault:getFolders'),
    saveFolder: (folder: Folder): Promise<IpcResponse> => ipcRenderer.invoke('vault:saveFolder', folder),
    deleteFolder: (id: string): Promise<IpcResponse> => ipcRenderer.invoke('vault:deleteFolder', id),
    syncLiveLeagueData: (): Promise<IpcResponse<{ updatedCount: number; totalCount: number }>> =>
      ipcRenderer.invoke('vault:syncLiveLeagueData'),
    onVaultLocked: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('vault:locked', handler)
      return () => {
        ipcRenderer.removeListener('vault:locked', handler)
      }
    }
  },

  // Settings
  settings: {
    get: (): Promise<IpcResponse<Settings>> => ipcRenderer.invoke('settings:get'),
    set: (settings: Partial<Settings>): Promise<IpcResponse> => ipcRenderer.invoke('settings:set', settings),
  },

  // App & System
  app: {
    getLoginItemSettings: (): Promise<IpcResponse<{ openAtLogin: boolean }>> => ipcRenderer.invoke('app:getLoginItemSettings'),
    setLoginItemSettings: (openAtLogin: boolean): Promise<IpcResponse> => ipcRenderer.invoke('app:setLoginItemSettings', openAtLogin),
    setZoomFactor: (factor: number): Promise<IpcResponse> => {
      try {
        webFrame.setZoomFactor(factor)
      } catch {}
      return ipcRenderer.invoke('app:setZoomFactor', factor)
    },
  },

  // Crypto utilities
  crypto: {
    generatePassword: (opts: { length: number; uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean }): Promise<IpcResponse<string>> =>
      ipcRenderer.invoke('crypto:generatePassword', opts),
  },

  // Overlay
  overlay: {
    hide: (): Promise<IpcResponse> => ipcRenderer.invoke('overlay:hide'),
    test: (durationMs?: number): Promise<IpcResponse> => ipcRenderer.invoke('overlay:test', durationMs),
    toggle: (): Promise<IpcResponse<boolean>> => ipcRenderer.invoke('overlay:toggle'),
    autofill: (accountId: string): Promise<IpcResponse> => ipcRenderer.invoke('overlay:autofill', accountId),
    getAccounts: (): Promise<IpcResponse<any[]>> => ipcRenderer.invoke('overlay:getAccounts'),
    setIgnoreMouseEvents: (ignore: boolean, forward?: boolean): Promise<IpcResponse> =>
      ipcRenderer.invoke('overlay:setIgnoreMouseEvents', ignore, forward),
  },

  // Riot state & Summoner Data
  riot: {
    getState: (): Promise<IpcResponse<RiotWindowInfo>> => ipcRenderer.invoke('riot:getState'),
    onStateChanged: (callback: (state: RiotWindowInfo) => void) => {
      const handler = (_: any, state: RiotWindowInfo) => callback(state)
      ipcRenderer.on('riot:stateChanged', handler)
      return () => {
        ipcRenderer.removeListener('riot:stateChanged', handler)
      }
    },
    refreshSummonerData: (accountId: string): Promise<IpcResponse<Account | null>> =>
      ipcRenderer.invoke('riot:refreshSummonerData', accountId),
  },

  // Clipboard
  clipboard: {
    write: (text: string): Promise<IpcResponse> => ipcRenderer.invoke('clipboard:write', text),
  },

  // Shell
  shell: {
    openExternal: (url: string): Promise<IpcResponse> => ipcRenderer.invoke('shell:openExternal', url),
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(globalThis as any).electron = electronAPI
  ;(globalThis as any).api = api
}

export type { UmbralAPI }
