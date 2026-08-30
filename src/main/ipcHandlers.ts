import { app, ipcMain, BrowserWindow, clipboard, shell, safeStorage } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  generateSalt,
  deriveKey,
  hashKey,
  encrypt,
  decrypt,
  wipeBuffer,
  generatePassword
} from './crypto'
import {
  getVaultMeta,
  setVaultMeta,
  isVaultInitialized,
  getAllEncryptedAccounts,
  saveAccount,
  deleteAccount,
  getAllFolders,
  saveFolder,
  deleteFolder,
  getSetting,
  setSetting
} from './db'
import { autofill } from './inputSimulator'
import { getLastRiotHwnd, getCurrentRiotState, testOverlay, toggleOverlay } from './windowManager'
import { fetchSummonerFromOpgg, clearOpggCache } from './opggClient'
import type { Account, Folder, IpcResponse, Settings } from '../shared/types'

// In-memory vault key — zeroed on lock
let vaultKey: Buffer | null = null

export function isUnlocked(): boolean {
  return vaultKey !== null
}

export function lockVault(): void {
  if (vaultKey) {
    wipeBuffer(vaultKey)
    vaultKey = null
  }
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('vault:locked')
    }
  })
}

function saveEncryptedMasterPassword(password: string): void {
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password)
      setSetting('saved_master_pw', encrypted.toString('base64'))
    }
  } catch (e) {
    console.error('Failed to save master password via safeStorage:', e)
  }
}

function clearEncryptedMasterPassword(): void {
  try {
    setSetting('saved_master_pw', '')
  } catch {}
}

function getEncryptedMasterPassword(): string | null {
  try {
    const b64 = getSetting('saved_master_pw')
    if (!b64) return null
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(b64, 'base64')
      return safeStorage.decryptString(buffer)
    }
  } catch (e) {
    console.error('Failed to decrypt saved master password:', e)
  }
  return null
}

const DEFAULT_SETTINGS: Settings = {
  autofillOffsetX: 0.5,
  autofillOffsetY: 0.40,
  autofillOverlayWidth: 360,
  keystrokeDelayMs: 28,
  lockOnMinimize: false,
  lockOnInactiveMinutes: 0,
  startMinimized: false,
  startWithWindows: false,
  stayLoggedIn: false,
  overlayEnabled: true,
  zoomFactor: 1.15
}

export function loadSettings(): Settings {
  const stored = getSetting('settings')
  if (!stored) return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function registerIpcHandlers(overlayWindow: BrowserWindow): void {
  // ── Vault Init / Unlock / Auto-Unlock / Lock / Change Password ───────────────

  ipcMain.handle('vault:isInitialized', (): IpcResponse<boolean> => ({
    status: 'ok',
    data: isVaultInitialized()
  }))

  ipcMain.handle('vault:initialize', async (_, masterPassword: string, stayLoggedIn = false): Promise<IpcResponse> => {
    try {
      if (isVaultInitialized()) return { status: 'error', error: 'Vault is already initialized' }
      if (!masterPassword || masterPassword.length < 8) {
        return { status: 'error', error: 'Master password must be at least 8 characters' }
      }
      const salt = generateSalt()
      vaultKey = deriveKey(masterPassword, salt)
      const passwordHash = hashKey(vaultKey)
      setVaultMeta({ salt, passwordHash, version: 1 })

      // Seed default folders if empty
      if (getAllFolders().length === 0) {
        const defaultFolders = ['EUW Accounts', 'NA Accounts', 'Smurfs & Alts']
        const now = new Date().toISOString()
        for (const name of defaultFolders) {
          saveFolder({ id: uuidv4(), name, color: '#38bdf8', createdAt: now })
        }
      }

      if (stayLoggedIn) {
        saveEncryptedMasterPassword(masterPassword)
        const current = loadSettings()
        setSetting('settings', JSON.stringify({ ...current, stayLoggedIn: true }))
      } else {
        clearEncryptedMasterPassword()
      }

      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:unlock', async (_, masterPassword: string, stayLoggedIn = false): Promise<IpcResponse> => {
    try {
      const meta = getVaultMeta()
      if (!meta) return { status: 'error', error: 'Vault not initialized' }
      const key = deriveKey(masterPassword, meta.salt)
      const hash = hashKey(key)
      if (hash !== meta.passwordHash) {
        wipeBuffer(key)
        return { status: 'error', error: 'Incorrect master password' }
      }
      if (vaultKey) wipeBuffer(vaultKey)
      vaultKey = key

      if (stayLoggedIn) {
        saveEncryptedMasterPassword(masterPassword)
        const current = loadSettings()
        setSetting('settings', JSON.stringify({ ...current, stayLoggedIn: true }))
      } else {
        clearEncryptedMasterPassword()
        const current = loadSettings()
        setSetting('settings', JSON.stringify({ ...current, stayLoggedIn: false }))
      }

      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:autoUnlock', async (): Promise<IpcResponse<boolean>> => {
    try {
      const settings = loadSettings()
      if (!settings.stayLoggedIn) return { status: 'ok', data: false }
      const savedPw = getEncryptedMasterPassword()
      if (!savedPw) return { status: 'ok', data: false }

      const meta = getVaultMeta()
      if (!meta) return { status: 'ok', data: false }

      const key = deriveKey(savedPw, meta.salt)
      const hash = hashKey(key)
      if (hash !== meta.passwordHash) {
        wipeBuffer(key)
        clearEncryptedMasterPassword()
        return { status: 'ok', data: false }
      }

      if (vaultKey) wipeBuffer(vaultKey)
      vaultKey = key
      return { status: 'ok', data: true }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:setStayLoggedIn', async (_, enabled: boolean): Promise<IpcResponse<boolean>> => {
    try {
      const current = loadSettings()
      setSetting('settings', JSON.stringify({ ...current, stayLoggedIn: enabled }))
      if (!enabled) {
        clearEncryptedMasterPassword()
      }
      return { status: 'ok', data: enabled }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:lock', (): IpcResponse => {
    lockVault()
    return { status: 'ok' }
  })

  ipcMain.handle('vault:isUnlocked', (): IpcResponse<boolean> => ({
    status: 'ok',
    data: isUnlocked()
  }))

  ipcMain.handle('vault:changeMasterPassword', async (_, oldPassword: string, newPassword: string): Promise<IpcResponse> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    if (!newPassword || newPassword.length < 8) {
      return { status: 'error', error: 'New password must be at least 8 characters' }
    }
    try {
      const meta = getVaultMeta()
      if (!meta) return { status: 'error', error: 'Vault metadata not found' }
      const verifyKey = deriveKey(oldPassword, meta.salt)
      if (hashKey(verifyKey) !== meta.passwordHash) {
        wipeBuffer(verifyKey)
        return { status: 'error', error: 'Current master password is incorrect' }
      }
      wipeBuffer(verifyKey)

      // Decrypt all accounts with existing key
      const rows = getAllEncryptedAccounts()
      const decryptedAccounts: Array<{ id: string; plaintext: string; folderId: string | null; now: string }> = []
      for (const row of rows) {
        const blob = JSON.parse(row.encryptedBlob)
        const plaintext = decrypt(blob, vaultKey)
        decryptedAccounts.push({
          id: row.id,
          plaintext,
          folderId: row.folderId,
          now: row.updatedAt
        })
      }

      // Generate new salt and derive new key
      const newSalt = generateSalt()
      const newKey = deriveKey(newPassword, newSalt)
      const newHash = hashKey(newKey)

      // Re-encrypt and save accounts with new key
      for (const acc of decryptedAccounts) {
        const newBlob = encrypt(acc.plaintext, newKey)
        saveAccount(acc.id, newBlob, acc.folderId, acc.now)
      }

      // Update meta
      setVaultMeta({ salt: newSalt, passwordHash: newHash, version: 1 })

      // Update memory key
      wipeBuffer(vaultKey)
      vaultKey = newKey

      // If stayLoggedIn is enabled, update the DPAPI stored master password
      const settings = loadSettings()
      if (settings.stayLoggedIn) {
        saveEncryptedMasterPassword(newPassword)
      }

      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Accounts ──────────────────────────────────────────────────────────────

  function extractRiotId(acc: Account): { name: string; tag: string } {
    let name = (acc.summonerName || '').replace(/\[.*\]/g, '').trim()
    let tag = (acc.summonerTag || '').replace(/^#/, '').replace(/\[.*\]/g, '').trim()

    if (name.includes('#')) {
      const parts = name.split('#')
      name = parts[0].trim()
      if (!tag) tag = parts[1].trim()
    }

    if (!name && acc.title) {
      let raw = acc.title.replace(/\[.*\]/g, '').trim()
      if (raw.includes('#')) {
        const parts = raw.split('#')
        name = parts[0].trim()
        if (!tag) tag = parts[1].trim()
      } else {
        name = raw
      }
    }

    return { name, tag: tag || acc.region || 'euw' }
  }

  async function refreshAccountOpggData(acc: Account): Promise<boolean> {
    if (!vaultKey) return false
    const { name, tag } = extractRiotId(acc)
    if (!name) return false

    try {
      const res = await fetchSummonerFromOpgg(name, tag, acc.region || 'euw')
      if (res.success) {
        let changed = false
        if (res.iconId && acc.iconId !== res.iconId) {
          acc.iconId = res.iconId
          acc.iconUrl = res.iconUrl
          changed = true
        }
        if (res.rankLp && acc.rankLp !== res.rankLp) {
          acc.rankLp = res.rankLp
          acc.rank = res.rankLp
          changed = true
        }
        if (changed) {
          acc.updatedAt = new Date().toISOString()
          const newBlob = encrypt(JSON.stringify(acc), vaultKey)
          saveAccount(acc.id, newBlob, acc.folderId, acc.updatedAt)
          return true
        }
      }
    } catch (e) {
      console.error(`[Umbral OP.GG] Failed to refresh ${name}#${tag}:`, e)
    }
    return false
  }

  function sanitizeRank(r?: string): string {
    if (!r) return ''
    return r
      .replace(/\b([I|V|X]+)\s+I\s+LP\b/gi, '$1 1 LP')
      .replace(/\b([I|V|X]+)\s+II\s+LP\b/gi, '$1 2 LP')
      .replace(/\b([I|V|X]+)\s+III\s+LP\b/gi, '$1 3 LP')
      .replace(/\b([I|V|X]+)\s+IV\s+LP\b/gi, '$1 4 LP')
  }

  ipcMain.handle('vault:getAccounts', (): IpcResponse<Account[]> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      const rows = getAllEncryptedAccounts()
      const accounts = rows.map(row => {
        const blob = JSON.parse(row.encryptedBlob)
        const plaintext = decrypt(blob, vaultKey!)
        const account: Account = JSON.parse(plaintext)
        account.id = row.id
        account.createdAt = row.createdAt
        account.updatedAt = row.updatedAt
        if (account.rankLp) account.rankLp = sanitizeRank(account.rankLp)
        if (account.rank) account.rank = sanitizeRank(account.rank)
        return account
      })

      // Background parallel live-refresh from OP.GG
      setTimeout(async () => {
        if (!vaultKey) return
        const targets = accounts.filter(
          acc => Boolean(acc.summonerName) || (Boolean(acc.title) && acc.title.includes('#'))
        )
        if (targets.length === 0) return

        let anyChanged = false
        const results = await Promise.allSettled(
          targets.map(acc => refreshAccountOpggData(acc))
        )
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value) {
            anyChanged = true
          }
        }

        if (anyChanged) {
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('vault:accountsUpdated')
            }
          })
        }
      }, 50)

      return { status: 'ok', data: accounts }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:syncLiveLeagueData', async (): Promise<IpcResponse<{ updatedCount: number; totalCount: number }>> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      clearOpggCache()
      const rows = getAllEncryptedAccounts()
      const accounts: Account[] = rows.map(row => {
        const blob = JSON.parse(row.encryptedBlob)
        const plaintext = decrypt(blob, vaultKey!)
        const acc: Account = JSON.parse(plaintext)
        acc.id = row.id
        acc.createdAt = row.createdAt
        acc.updatedAt = row.updatedAt
        return acc
      })

      const targets = accounts.filter(
        acc => Boolean(acc.summonerName) || (Boolean(acc.title) && acc.title.includes('#'))
      )

      let updatedCount = 0
      const results = await Promise.allSettled(
        targets.map(async acc => {
          const { name, tag } = extractRiotId(acc)
          if (!name) return false

          const res = await fetchSummonerFromOpgg(name, tag, acc.region || 'euw', true)
          if (res.success) {
            let changed = false
            if (res.iconId && acc.iconId !== res.iconId) {
              acc.iconId = res.iconId
              acc.iconUrl = res.iconUrl
              changed = true
            }
            if (res.rankLp && (acc.rankLp !== res.rankLp || acc.rank !== res.rankLp)) {
              acc.rankLp = res.rankLp
              acc.rank = res.rankLp
              changed = true
            }
            if (changed) {
              acc.updatedAt = new Date().toISOString()
              const newBlob = encrypt(JSON.stringify(acc), vaultKey!)
              saveAccount(acc.id, newBlob, acc.folderId, acc.updatedAt)
              return true
            }
          }
          return false
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          updatedCount++
        }
      }

      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('vault:accountsUpdated')
        }
      })

      return { status: 'ok', data: { updatedCount, totalCount: targets.length } }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:saveAccount', (_, account: Account): IpcResponse<Account> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      const id = account.id || uuidv4()
      const now = new Date().toISOString()

      // Automatically format title as Summoner#Tag [RANK] if not custom
      let formattedTitle = account.title?.trim()
      if (!formattedTitle && account.summonerName) {
        formattedTitle = `${account.summonerName}${account.summonerTag ? `#${account.summonerTag}` : ''}${account.rank ? ` [${account.rank}]` : ''}`
      }
      if (!formattedTitle) {
        formattedTitle = account.username || 'Riot Account'
      }

      let passwordHistory = account.passwordHistory || []
      if (account.id) {
        const rows = getAllEncryptedAccounts()
        const existingRow = rows.find(r => r.id === account.id)
        if (existingRow) {
          try {
            const blob = JSON.parse(existingRow.encryptedBlob)
            const prevAccount: Account = JSON.parse(decrypt(blob, vaultKey))
            if (prevAccount.password && prevAccount.password !== account.password) {
              passwordHistory = [
                { password: prevAccount.password, changedAt: now },
                ...(prevAccount.passwordHistory || [])
              ]
            } else if (prevAccount.passwordHistory) {
              passwordHistory = prevAccount.passwordHistory
            }
          } catch {}
        }
      }

      const fullAccount: Account = {
        ...account,
        id,
        title: formattedTitle,
        passwordHistory,
        updatedAt: now,
        createdAt: account.createdAt || now
      }

      const payload = JSON.stringify(fullAccount)
      const blob = encrypt(payload, vaultKey)
      saveAccount(id, blob, account.folderId, now)

      // Trigger immediate background OP.GG refresh for the saved account
      setTimeout(async () => {
        const updated = await refreshAccountOpggData(fullAccount)
        if (updated) {
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('vault:accountsUpdated')
            }
          })
        }
      }, 50)

      return { status: 'ok', data: fullAccount }
    } catch (e: any) {
      console.error('saveAccount error:', e)
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:deleteAccount', (_, id: string): IpcResponse => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      deleteAccount(id)
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Folders ───────────────────────────────────────────────────────────────

  ipcMain.handle('vault:getFolders', (): IpcResponse<Folder[]> => {
    try {
      return { status: 'ok', data: getAllFolders() }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:saveFolder', (_, folder: Folder): IpcResponse => {
    try {
      if (!folder.id) folder.id = uuidv4()
      if (!folder.createdAt) folder.createdAt = new Date().toISOString()
      saveFolder(folder)
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('vault:deleteFolder', (_, id: string): IpcResponse => {
    try {
      deleteFolder(id)
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', (): IpcResponse<Settings> => ({
    status: 'ok',
    data: loadSettings()
  }))

  ipcMain.handle('settings:set', (_, newSettings: Partial<Settings>): IpcResponse => {
    try {
      const current = loadSettings()
      const updated = { ...current, ...newSettings }
      setSetting('settings', JSON.stringify(updated))

      if (typeof newSettings.startWithWindows === 'boolean') {
        try {
          app.setLoginItemSettings({
            openAtLogin: newSettings.startWithWindows,
            path: process.execPath,
            args: ['--hidden']
          })
        } catch {}
      }

      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Windows Startup Auto-Launch ───────────────────────────────────────────

  ipcMain.handle('app:getLoginItemSettings', (): IpcResponse<{ openAtLogin: boolean }> => {
    try {
      const itemSettings = app.getLoginItemSettings({
        path: process.execPath,
        args: ['--hidden']
      })
      return { status: 'ok', data: { openAtLogin: itemSettings.openAtLogin } }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('app:setLoginItemSettings', (_, openAtLogin: boolean): IpcResponse => {
    try {
      app.setLoginItemSettings({
        openAtLogin,
        path: process.execPath,
        args: ['--hidden']
      })
      const current = loadSettings()
      setSetting('settings', JSON.stringify({ ...current, startWithWindows: openAtLogin }))
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('app:setZoomFactor', (_, factor: number): IpcResponse => {
    try {
      const current = loadSettings()
      setSetting('settings', JSON.stringify({ ...current, zoomFactor: factor }))
      const allWins = BrowserWindow.getAllWindows()
      for (const win of allWins) {
        if (!win.isDestroyed()) {
          win.webContents.setZoomFactor(factor)
        }
      }
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Crypto Utilities ──────────────────────────────────────────────────────

  ipcMain.handle('crypto:generatePassword', (_, opts: Parameters<typeof generatePassword>[0]) => ({
    status: 'ok',
    data: generatePassword(opts)
  }))

  // ── Overlay Testing & Operations ──────────────────────────────────────────

  ipcMain.handle('overlay:hide', (): IpcResponse => {
    if (!overlayWindow.isDestroyed()) overlayWindow.hide()
    return { status: 'ok' }
  })

  ipcMain.handle('overlay:test', (_, durationMs = 10000): IpcResponse => {
    try {
      testOverlay(overlayWindow, durationMs)
      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('overlay:toggle', (): IpcResponse<boolean> => {
    try {
      const isVisible = toggleOverlay(overlayWindow)
      return { status: 'ok', data: isVisible }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('overlay:autofill', async (_, accountId: string): Promise<IpcResponse> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      const rows = getAllEncryptedAccounts()
      const row = rows.find(r => r.id === accountId)
      if (!row) return { status: 'error', error: 'Account not found' }

      const blob = JSON.parse(row.encryptedBlob)
      const plaintext = decrypt(blob, vaultKey)
      const account: Account = JSON.parse(plaintext)

      const hwnd = getLastRiotHwnd()
      if (!hwnd) return { status: 'error', error: 'Riot Client window not found' }

      await new Promise(r => setTimeout(r, 50))

      console.log(`[Umbral Autofill] Injecting credentials for ${account.username} to HWND ${hwnd}...`)
      await autofill(account.username, account.password, hwnd)

      // Update lastUsedAt timestamp on account
      account.lastUsedAt = new Date().toISOString()
      const updatedBlob = encrypt(JSON.stringify(account), vaultKey)
      saveAccount(account.id, updatedBlob, account.folderId, account.updatedAt)

      // Wipe sensitive memory
      ;(account as any).password = '0'.repeat(account.password.length)
      ;(account as any).username = ''

      return { status: 'ok' }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // Returns only non-sensitive account metadata for the overlay popup
  ipcMain.handle('overlay:getAccounts', (): IpcResponse<Array<Pick<Account, 'id' | 'title' | 'summonerName' | 'summonerTag' | 'username' | 'rank' | 'iconId' | 'iconUrl' | 'rankLp' | 'region' | 'role'>>> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      const rows = getAllEncryptedAccounts()
      const accounts = rows.map(row => {
        const blob = JSON.parse(row.encryptedBlob)
        const plaintext = decrypt(blob, vaultKey!)
        const a: Account = JSON.parse(plaintext)
        return {
          id: a.id || row.id,
          title: a.title,
          summonerName: a.summonerName,
          summonerTag: a.summonerTag,
          username: a.username,
          rank: a.rank,
          iconId: a.iconId,
          iconUrl: a.iconUrl,
          rankLp: a.rankLp,
          region: a.region,
          role: a.role
        }
      })
      return { status: 'ok', data: accounts }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  ipcMain.handle('overlay:setIgnoreMouseEvents', (_, ignore: boolean, forward?: boolean): IpcResponse => {
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(ignore, { forward: !!forward })
    }
    return { status: 'ok' }
  })

  // ── Summoner Auto-Refresh via OP.GG ──────────────────────────────────────
  ipcMain.handle('riot:refreshSummonerData', async (_, accountId: string): Promise<IpcResponse<Account | null>> => {
    if (!vaultKey) return { status: 'error', error: 'Vault is locked' }
    try {
      const rows = getAllEncryptedAccounts()
      const row = rows.find(r => r.id === accountId)
      if (!row) return { status: 'error', error: 'Account not found' }

      const blob = JSON.parse(row.encryptedBlob)
      const acc: Account = JSON.parse(decrypt(blob, vaultKey))
      await refreshAccountOpggData(acc)

      return { status: 'ok', data: acc }
    } catch (e: any) {
      return { status: 'error', error: e.message }
    }
  })

  // ── Riot State ────────────────────────────────────────────────────────────

  ipcMain.handle('riot:getState', (): IpcResponse<any> => ({
    status: 'ok',
    data: getCurrentRiotState()
  }))

  // ── Clipboard & Shell ─────────────────────────────────────────────────────

  ipcMain.handle('clipboard:write', (_, text: string): IpcResponse => {
    clipboard.writeText(text)
    return { status: 'ok' }
  })

  ipcMain.handle('shell:openExternal', (_, url: string): IpcResponse => {
    shell.openExternal(url)
    return { status: 'ok' }
  })
}
