import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import type { VaultMeta, Folder } from '../shared/types'
import type { EncryptedBlob } from './crypto'

const DATA_DIR = join(app.getPath('userData'), 'umbral')
const DB_FILE = join(DATA_DIR, 'vault.json')

interface VaultDatabaseSchema {
  meta: Record<string, string>
  folders: Folder[]
  accounts: Array<{
    id: string
    encryptedBlob: string
    folderId: string | null
    sortOrder: number
    createdAt: string
    updatedAt: string
  }>
  settings: Record<string, string>
}

const DEFAULT_DB: VaultDatabaseSchema = {
  meta: {},
  folders: [],
  accounts: [],
  settings: {}
}

let dbMemory: VaultDatabaseSchema | null = null

function ensureDb(): VaultDatabaseSchema {
  if (dbMemory) return dbMemory

  try {
    mkdirSync(DATA_DIR, { recursive: true })
    if (existsSync(DB_FILE)) {
      const raw = readFileSync(DB_FILE, 'utf8')
      dbMemory = { ...DEFAULT_DB, ...JSON.parse(raw) }
    }
  } catch {
    dbMemory = { ...DEFAULT_DB }
  }

  if (!dbMemory) {
    dbMemory = { ...DEFAULT_DB }
  }

  return dbMemory
}

function persist(): void {
  if (!dbMemory) return
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(DB_FILE, JSON.stringify(dbMemory, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist vault db:', err)
  }
}

// ─── Meta / Vault Setup ──────────────────────────────────────────────────────

export function getVaultMeta(): VaultMeta | null {
  const db = ensureDb()
  const salt = db.meta['salt']
  const hash = db.meta['passwordHash']
  const version = db.meta['version']
  if (!salt || !hash) return null
  return {
    salt,
    passwordHash: hash,
    version: version ? parseInt(version) : 1
  }
}

export function setVaultMeta(meta: VaultMeta): void {
  const db = ensureDb()
  db.meta['salt'] = meta.salt
  db.meta['passwordHash'] = meta.passwordHash
  db.meta['version'] = String(meta.version)
  persist()
}

export function isVaultInitialized(): boolean {
  return getVaultMeta() !== null
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export function getAllEncryptedAccounts(): Array<{
  id: string
  encryptedBlob: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}> {
  const db = ensureDb()
  return [...db.accounts]
    .sort((a, b) => (a.sortOrder - b.sortOrder) || b.createdAt.localeCompare(a.createdAt))
    .map(a => ({
      id: a.id,
      encryptedBlob: a.encryptedBlob,
      folderId: a.folderId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    }))
}

export function saveAccount(id: string, blob: EncryptedBlob, folderId: string | null, now: string): void {
  const db = ensureDb()
  const existingIdx = db.accounts.findIndex(a => a.id === id)
  const entry = {
    id,
    encryptedBlob: JSON.stringify(blob),
    folderId,
    sortOrder: 0,
    createdAt: existingIdx >= 0 ? db.accounts[existingIdx].createdAt : now,
    updatedAt: now
  }

  if (existingIdx >= 0) {
    db.accounts[existingIdx] = entry
  } else {
    db.accounts.push(entry)
  }
  persist()
}

export function deleteAccount(id: string): void {
  const db = ensureDb()
  db.accounts = db.accounts.filter(a => a.id !== id)
  persist()
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export function getAllFolders(): Folder[] {
  const db = ensureDb()
  return [...db.folders]
}

export function saveFolder(folder: Folder): void {
  const db = ensureDb()
  const existingIdx = db.folders.findIndex(f => f.id === folder.id)
  if (existingIdx >= 0) {
    db.folders[existingIdx] = { ...folder }
  } else {
    db.folders.push({ ...folder })
  }
  persist()
}

export function deleteFolder(id: string): void {
  const db = ensureDb()
  db.folders = db.folders.filter(f => f.id !== id)
  // Unassign accounts in deleted folder
  for (const acc of db.accounts) {
    if (acc.folderId === id) {
      acc.folderId = null
    }
  }
  persist()
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = ensureDb()
  return db.settings[key] || null
}

export function setSetting(key: string, value: string): void {
  const db = ensureDb()
  db.settings[key] = value
  persist()
}
