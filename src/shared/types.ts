export interface PasswordHistoryItem {
  password: string
  changedAt: string
}

export interface Account {
  id: string
  title: string
  summonerName: string
  summonerTag: string
  username: string
  password: string
  passwordHistory?: PasswordHistoryItem[]
  deletedAt?: string | null
  region: string
  rank: string
  iconId?: number
  iconUrl?: string
  rankLp?: string
  rankTier?: string
  rankDivision?: string
  lp?: number
  role: string
  folderId: string | null
  notes: string
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Settings {
  autofillOffsetX: number       // fractional X center of username field (default: 0.5)
  autofillOffsetY: number       // fractional Y position from top (default: 0.40)
  autofillOverlayWidth: number  // overlay width in px (default: 340)
  keystrokeDelayMs: number      // delay between keystrokes in ms (default: 28)
  lockOnMinimize: boolean
  lockOnInactiveMinutes: number
  startMinimized: boolean
  startWithWindows: boolean
  stayLoggedIn: boolean         // auto-unlock on startup via Windows DPAPI safeStorage
  overlayEnabled: boolean
  zoomFactor: number            // UI display scale (default: 1.15 for 115%)
}

export interface VaultMeta {
  salt: string             // hex encoded
  passwordHash: string     // hex encoded SHA-256 of derived key
  version: number
}

export type IpcStatus = 'ok' | 'error'

export interface IpcResponse<T = void> {
  status: IpcStatus
  data?: T
  error?: string
}

export interface RiotWindowInfo {
  x: number
  y: number
  width: number
  height: number
  isVisible: boolean
  isFocused: boolean
  title?: string
  processName?: string
}

export interface UmbralAPI {
  vault: {
    isInitialized: () => Promise<IpcResponse<boolean>>
    initialize: (masterPassword: string, stayLoggedIn?: boolean) => Promise<IpcResponse>
    unlock: (masterPassword: string, stayLoggedIn?: boolean) => Promise<IpcResponse>
    autoUnlock: () => Promise<IpcResponse<boolean>>
    setStayLoggedIn: (enabled: boolean) => Promise<IpcResponse<boolean>>
    lock: () => Promise<IpcResponse>
    isUnlocked: () => Promise<IpcResponse<boolean>>
    changeMasterPassword: (oldPw: string, newPw: string) => Promise<IpcResponse>
    getAccounts: () => Promise<IpcResponse<Account[]>>
    saveAccount: (account: Account) => Promise<IpcResponse<Account>>
    deleteAccount: (id: string) => Promise<IpcResponse>
    getFolders: () => Promise<IpcResponse<Folder[]>>
    saveFolder: (folder: Folder) => Promise<IpcResponse>
    deleteFolder: (id: string) => Promise<IpcResponse>
    syncLiveLeagueData: () => Promise<IpcResponse<{ updatedCount: number; totalCount: number }>>
    onVaultLocked: (callback: () => void) => () => void
  }
  settings: {
    get: () => Promise<IpcResponse<Settings>>
    set: (settings: Partial<Settings>) => Promise<IpcResponse>
  }
  app: {
    getLoginItemSettings: () => Promise<IpcResponse<{ openAtLogin: boolean }>>
    setLoginItemSettings: (openAtLogin: boolean) => Promise<IpcResponse>
    setZoomFactor: (factor: number) => Promise<IpcResponse>
  }
  crypto: {
    generatePassword: (opts: {
      length: number
      uppercase: boolean
      lowercase: boolean
      numbers: boolean
      symbols: boolean
    }) => Promise<IpcResponse<string>>
  }
  overlay: {
    hide: () => Promise<IpcResponse>
    test: (durationMs?: number) => Promise<IpcResponse>
    toggle: () => Promise<IpcResponse<boolean>>
    autofill: (accountId: string) => Promise<IpcResponse>
    getAccounts: () => Promise<IpcResponse<any[]>>
    setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => Promise<IpcResponse>
  }
  riot: {
    getState: () => Promise<IpcResponse<RiotWindowInfo>>
    onStateChanged: (callback: (state: RiotWindowInfo) => void) => () => void
    refreshSummonerData: (accountId: string) => Promise<IpcResponse<Account | null>>
  }
  clipboard: {
    write: (text: string) => Promise<IpcResponse>
  }
  shell: {
    openExternal: (url: string) => Promise<IpcResponse>
  }
  updater: {
    check: () => Promise<IpcResponse<UpdateInfoState>>
    download: () => Promise<IpcResponse>
    install: () => Promise<IpcResponse>
    getState: () => Promise<IpcResponse<UpdateInfoState>>
    onStatusChanged: (callback: (state: UpdateInfoState) => void) => () => void
  }
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateInfoState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseDate?: string
  releaseNotes?: string | string[]
  progress?: UpdateProgress
  error?: string
}

