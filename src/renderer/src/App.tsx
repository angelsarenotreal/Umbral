import React, { useEffect, useState, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Settings as SettingsIcon, Lock, ExternalLink } from 'lucide-react'
import { api } from './lib/ipc'
import UnlockScreen from './components/UnlockScreen'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import Vault from './pages/Vault'
import PasswordGenerator from './pages/PasswordGenerator'
import Settings from './pages/Settings'
import Trash from './pages/Trash'
import type { Account, Folder } from '../../shared/types'

type AppState = 'loading' | 'setup' | 'locked' | 'unlocked'

interface MainLayoutProps {
  onLock: () => void
}

function MainLayout({ onLock }: MainLayoutProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('umbral_sidebar_width')
      const val = saved ? parseInt(saved, 10) : 280
      return val >= 260 ? val : 280
    } catch {
      return 280
    }
  })

  const handleSidebarWidthChange = (w: number) => {
    const clamped = Math.max(260, Math.min(480, w))
    setSidebarWidth(clamped)
    try {
      localStorage.setItem('umbral_sidebar_width', String(clamped))
    } catch {}
  }

  const loadData = useCallback(async () => {
    try {
      const [accRes, foldRes] = await Promise.all([
        api.vault.getAccounts(),
        api.vault.getFolders()
      ])
      if (accRes.status === 'ok') setAccounts(accRes.data || [])
      if (foldRes.status === 'ok') {
        setFolders(foldRes.data || [])
      }
    } catch (e) {
      console.error('Failed to load vault data:', e)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateFolder = async (name: string) => {
    const newFolder: Folder = {
      id: '',
      name,
      color: '#38bdf8',
      createdAt: new Date().toISOString()
    }
    const res = await api.vault.saveFolder(newFolder)
    if (res.status === 'ok') {
      loadData()
    }
  }

  const handleRenameFolder = async (folder: Folder, newName: string) => {
    if (!newName.trim() || newName === folder.name) return
    const updated: Folder = { ...folder, name: newName.trim() }
    const res = await api.vault.saveFolder(updated)
    if (res.status === 'ok') {
      loadData()
    }
  }

  const handleDeleteFolder = async (id: string, _name: string) => {
    await api.vault.deleteFolder(id)
    if (selectedFolderId === id) setSelectedFolderId(null)
    loadData()
  }

  const handleLock = async () => {
    await api.vault.lock()
    onLock()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        handleLock()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0e0e10] text-[#fafafa] font-sans antialiased select-none overflow-hidden">
      {/* Top Navigation Bar with solid pure black background */}
      <header
        style={{ borderBottomWidth: '1.5px' }}
        className="h-[54px] shrink-0 border-b border-[#2d2d35] bg-black flex items-center justify-between px-4 drag-region z-40"
      >
        {/* Top Left: Settings Gear (Cleanly inset with 24px left padding) */}
        <div
          className="relative shrink-0 flex items-center no-drag"
          style={{ width: `${Math.max(260, sidebarWidth)}px`, minWidth: '260px', paddingLeft: '24px' }}
        >
          {/* Settings Gear */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              location.pathname === '/settings'
                ? 'bg-[#222227] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-[#18181c]'
            }`}
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>

        {/* Center: Search Bar with Ctrl + F badge */}
        <div className="flex-1 flex justify-center max-w-md px-4 no-drag">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search all items"
          />
        </div>

        {/* Top Right: Status & Vault Lock */}
        <div className="w-[260px] shrink-0 flex items-center justify-end gap-2 pr-32 no-drag">
          <button
            type="button"
            onClick={() => api.shell.openExternal('https://account.riotgames.com/')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b] transition-colors cursor-pointer"
            title="Riot Account Portal"
          >
            <ExternalLink size={16} />
          </button>

          <button
            type="button"
            onClick={handleLock}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#18181b] transition-colors cursor-pointer"
            title="Lock Vault (Ctrl + L)"
          >
            <Lock size={16} />
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="flex flex-1 h-[calc(100vh-54px)] overflow-hidden">
        <Sidebar
          folders={folders}
          accounts={accounts}
          selectedFolder={selectedFolderId}
          width={sidebarWidth}
          onWidthChange={handleSidebarWidthChange}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onLock={handleLock}
        />

        <main className="flex-1 h-full overflow-hidden bg-[#090909]">
          <Routes>
            <Route path="/" element={<Navigate to="/vault" replace />} />
            <Route
              path="/vault"
              element={
                <Vault
                  searchQuery={searchQuery}
                  selectedFolderId={selectedFolderId}
                  folders={folders}
                  accounts={accounts}
                  onReload={loadData}
                  onSelectFolder={setSelectedFolderId}
                />
              }
            />
            <Route path="/generator" element={<PasswordGenerator />} />
            <Route
              path="/trash"
              element={
                <Trash
                  accounts={accounts}
                  folders={folders}
                  onReload={loadData}
                />
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  const [state, setState] = useState<AppState>('loading')

  useEffect(() => {
    async function checkVault() {
      try {
        const settingsRes = await api.settings.get()
        if (settingsRes.status === 'ok' && settingsRes.data?.zoomFactor) {
          api.app.setZoomFactor(settingsRes.data.zoomFactor)
        }
      } catch {}

      const initRes = await api.vault.isInitialized()
      if (!initRes.data) {
        setState('setup')
        return
      }

      let isUnl = false
      const unlCheck = await api.vault.isUnlocked()
      if (unlCheck.data) {
        isUnl = true
      } else {
        const autoRes = await api.vault.autoUnlock()
        if (autoRes.status === 'ok' && autoRes.data) {
          isUnl = true
        }
      }
      setState(isUnl ? 'unlocked' : 'locked')
    }
    checkVault()

    const unbind = api.vault.onVaultLocked(() => {
      setState('locked')
    })
    return () => unbind()
  }, [])

  const handleUnlocked = () => setState('unlocked')
  const handleLockState = () => setState('locked')

  if (state === 'loading') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0e0e10]">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state === 'setup' || state === 'locked') {
    return <UnlockScreen mode={state === 'setup' ? 'setup' : 'unlock'} onUnlocked={handleUnlocked} />
  }

  return (
    <HashRouter>
      <MainLayout onLock={handleLockState} />
    </HashRouter>
  )
}
