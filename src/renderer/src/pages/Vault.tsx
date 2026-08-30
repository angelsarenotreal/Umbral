import React, { useState, useEffect, useRef } from 'react'
import {
  Folder as FolderIcon,
  Plus,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  ArrowUpDown,
  CheckCircle2,
  Check,
  Minus,
  Trash2,
  FolderInput,
  FolderMinus,
  RotateCcw,
  RotateCw,
  X
} from 'lucide-react'
import type { Account, Folder } from '../../../shared/types'
import { api } from '../lib/ipc'
import AccountCard from '../components/AccountCard'
import AccountDetailDrawer from '../components/AccountDetailDrawer'
import AccountEditView from '../components/AccountEditView'
import MoveAccountModal from '../components/MoveAccountModal'

interface Props {
  searchQuery: string
  selectedFolderId: string | null
  folders: Folder[]
  accounts: Account[]
  onReload: () => void
  onSelectFolder?: (folderId: string | null) => void
}

type Toast = { id: number; message: string }

export default function Vault({
  searchQuery,
  selectedFolderId,
  folders,
  accounts,
  onReload,
  onSelectFolder
}: Props): JSX.Element {
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [checkedAccountIds, setCheckedAccountIds] = useState<Set<string>>(new Set())
  const [showBatchMoveModal, setShowBatchMoveModal] = useState(false)

  // 3-dots Folder menu state
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const folderOptionsRef = useRef<HTMLDivElement>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [moveItemsToTrashOnDelete, setMoveItemsToTrashOnDelete] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width)
        }
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const [sortField, setSortField] = useState<'title' | 'lastUsed' | 'folder'>(() => {
    try {
      const saved = localStorage.getItem('umbral_vault_sort_field')
      if (saved === 'title' || saved === 'lastUsed' || saved === 'folder') return saved
    } catch {}
    return 'lastUsed'
  })

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = localStorage.getItem('umbral_vault_sort_dir')
      if (saved === 'asc' || saved === 'desc') return saved
    } catch {}
    return 'desc'
  })

  const showFolderCol = selectedFolderId === null && containerWidth >= 580
  const showLastUsedCol = true

  const handleSort = (field: 'title' | 'lastUsed' | 'folder') => {
    let nextDir: 'asc' | 'desc' = 'desc'
    if (sortField === field) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(nextDir)
    } else {
      setSortField(field)
      nextDir = field === 'title' ? 'asc' : 'desc'
      setSortDirection(nextDir)
    }
    try {
      localStorage.setItem('umbral_vault_sort_field', field)
      localStorage.setItem('umbral_vault_sort_dir', nextDir)
    } catch {}
  }

  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('umbral_drawer_width')
      return saved ? parseInt(saved, 10) : 380
    } catch {
      return 380
    }
  })

  const handleDrawerWidthChange = (w: number) => {
    setDrawerWidth(w)
    try {
      localStorage.setItem('umbral_drawer_width', String(w))
    } catch {}
  }

  const toast = (message: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500)
  }

  const currentFolder = folders.find(f => f.id === selectedFolderId)
  const currentFolderName = currentFolder ? currentFolder.name : 'Vault'

  // Reset selected account drawer and checked items when switching folders
  useEffect(() => {
    setSelectedAccountId(null)
    setCheckedAccountIds(new Set())
    setShowBatchMoveModal(false)
    setShowFolderMenu(false)
  }, [selectedFolderId])

  // Click outside to close menus
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (folderOptionsRef.current && !folderOptionsRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleToggleAccount = async (acc: Account) => {
    if (selectedAccountId === acc.id) {
      setSelectedAccountId(null)
    } else {
      setSelectedAccountId(acc.id)
      const now = new Date().toISOString()
      const updated = { ...acc, lastUsedAt: now }
      await api.vault.saveAccount(updated)
      onReload()
    }
  }

  const handleToggleCheck = (id: string) => {
    setCheckedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async (account: Account) => {
    const res = await api.vault.saveAccount(account)
    if (res.status === 'error') {
      const errMsg = res.error || 'Save failed'
      toast(errMsg)
      throw new Error(errMsg)
    }
    const savedId = (res as any).data?.id || account.id
    toast(account.id ? 'Account updated' : 'Account created')
    setEditingAccount(null)
    if (savedId) setSelectedAccountId(savedId)
    onReload()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return
    await api.vault.deleteAccount(id)
    if (selectedAccountId === id) {
      setSelectedAccountId(null)
    }
    setCheckedAccountIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    toast('Account deleted')
    onReload()
  }

  const handleCopy = async (text: string, label: string) => {
    await api.clipboard.write(text)
    toast(`${label} copied`)
    setTimeout(() => api.clipboard.write(''), 30000)
    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId)
      if (acc) {
        const now = new Date().toISOString()
        const updated = { ...acc, lastUsedAt: now }
        await api.vault.saveAccount(updated)
        onReload()
      }
    }
  }

  const handleMoveAccount = async (account: Account, targetFolderId: string | null) => {
    const updated: Account = {
      ...account,
      folderId: targetFolderId
    }
    const res = await api.vault.saveAccount(updated)
    if (res.status === 'ok') {
      const targetFolder = folders.find(f => f.id === targetFolderId)
      const targetName = targetFolder ? targetFolder.name : 'Vault'
      toast(`Item moved to ${targetName}`)
      onReload()
    } else {
      toast('Failed to move item')
    }
  }

  const handleCreateAndMoveAccount = async (account: Account, folderName: string) => {
    const newF: Folder = {
      id: '',
      name: folderName.trim(),
      color: '#00c0f0',
      createdAt: new Date().toISOString()
    }
    const res = await api.vault.saveFolder(newF)
    if (res.status === 'ok') {
      const updatedFolders = await api.vault.getFolders()
      const created = updatedFolders.data?.find(f => f.name === folderName.trim())
      if (created) {
        await handleMoveAccount(account, created.id)
      } else {
        onReload()
      }
    }
  }

  const handleRemoveFromFolder = async (account: Account) => {
    const oldFolder = folders.find(f => f.id === account.folderId)
    const oldName = oldFolder ? oldFolder.name : 'folder'
    const updated: Account = {
      ...account,
      folderId: null
    }
    const res = await api.vault.saveAccount(updated)
    if (res.status === 'ok') {
      toast(`Item removed from ${oldName}`)
      onReload()
    } else {
      toast('Failed to remove item from folder')
    }
  }

  const handleMoveToTrash = async (account: Account) => {
    const updated: Account = {
      ...account,
      deletedAt: new Date().toISOString(),
      folderId: null
    }
    const res = await api.vault.saveAccount(updated)
    if (res.status === 'ok') {
      toast('Item moved to Trash')
      setSelectedAccountId(null)
      onReload()
    } else {
      toast('Failed to move item to Trash')
    }
  }

  const filtered = accounts.filter(a => {
    if (a.deletedAt) return false
    const q = searchQuery.toLowerCase().trim()
    const matchSearch = !q ||
      a.summonerName?.toLowerCase().includes(q) ||
      a.username?.toLowerCase().includes(q) ||
      a.region?.toLowerCase().includes(q) ||
      a.rank?.toLowerCase().includes(q) ||
      a.role?.toLowerCase().includes(q) ||
      a.summonerTag?.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q)
    const matchFolder = selectedFolderId === null || a.folderId === selectedFolderId
    return matchSearch && matchFolder
  })

  const sortedAccounts = [...filtered].sort((a, b) => {
    if (sortField === 'title') {
      const titleA = (a.title || a.summonerName || a.username || '').toLowerCase()
      const titleB = (b.title || b.summonerName || b.username || '').toLowerCase()
      return sortDirection === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA)
    }
    if (sortField === 'lastUsed') {
      const timeA = new Date(a.lastUsedAt || a.updatedAt || a.createdAt).getTime()
      const timeB = new Date(b.lastUsedAt || b.updatedAt || b.createdAt).getTime()
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA
    }
    if (sortField === 'folder') {
      const folderA = (folders.find(f => f.id === a.folderId)?.name || '').toLowerCase()
      const folderB = (folders.find(f => f.id === b.folderId)?.name || '').toLowerCase()
      return sortDirection === 'asc' ? folderA.localeCompare(folderB) : folderB.localeCompare(folderA)
    }
    return 0
  })

  // Select all logic for table header
  const isAllChecked = filtered.length > 0 && filtered.every(a => checkedAccountIds.has(a.id))
  const isSomeChecked = filtered.some(a => checkedAccountIds.has(a.id)) && !isAllChecked

  const handleToggleSelectAll = () => {
    if (isAllChecked) {
      setCheckedAccountIds(new Set())
    } else {
      setCheckedAccountIds(new Set(filtered.map(a => a.id)))
    }
  }

  // Batch actions
  const handleBatchMoveToFolder = async (folderId: string | null) => {
    const targetFolder = folders.find(f => f.id === folderId)
    const fName = targetFolder ? targetFolder.name : 'Vault'
    const count = checkedAccountIds.size
    for (const id of checkedAccountIds) {
      const acc = accounts.find(a => a.id === id)
      if (acc) {
        await api.vault.saveAccount({ ...acc, folderId })
      }
    }
    toast(`${count} ${count === 1 ? 'item' : 'items'} moved to ${fName}`)
    setCheckedAccountIds(new Set())
    setShowBatchMoveModal(false)
    onReload()
  }

  const handleBatchCreateAndMove = async (folderName: string) => {
    const newF: Folder = {
      id: '',
      name: folderName.trim(),
      color: '#00c0f0',
      createdAt: new Date().toISOString()
    }
    const res = await api.vault.saveFolder(newF)
    if (res.status === 'ok') {
      const updatedFolders = await api.vault.getFolders()
      const created = updatedFolders.data?.find(f => f.name === folderName.trim())
      if (created) {
        await handleBatchMoveToFolder(created.id)
      } else {
        setShowBatchMoveModal(false)
        setCheckedAccountIds(new Set())
        onReload()
      }
    }
  }

  const handleBatchRemoveFromFolder = async () => {
    const count = checkedAccountIds.size
    for (const id of checkedAccountIds) {
      const acc = accounts.find(a => a.id === id)
      if (acc) {
        await api.vault.saveAccount({ ...acc, folderId: null })
      }
    }
    toast(`Removed ${count} ${count === 1 ? 'item' : 'items'} from ${currentFolderName}`)
    setCheckedAccountIds(new Set())
    onReload()
  }

  const handleBatchMoveToTrash = async () => {
    const count = checkedAccountIds.size
    for (const id of checkedAccountIds) {
      const acc = accounts.find(a => a.id === id)
      if (acc) {
        await api.vault.saveAccount({
          ...acc,
          deletedAt: new Date().toISOString(),
          folderId: null
        })
      }
    }
    toast(`${count} ${count === 1 ? 'item' : 'items'} moved to Trash`)
    if (selectedAccountId && checkedAccountIds.has(selectedAccountId)) {
      setSelectedAccountId(null)
    }
    setCheckedAccountIds(new Set())
    onReload()
  }

  const handleConfirmDeleteFolder = async () => {
    if (!currentFolder) return
    if (moveItemsToTrashOnDelete) {
      const accountsInFolder = accounts.filter(a => a.folderId === currentFolder.id)
      for (const acc of accountsInFolder) {
        await api.vault.deleteAccount(acc.id)
      }
    }
    await api.vault.deleteFolder(currentFolder.id)
    toast(`Folder "${currentFolder.name}" deleted`)
    setShowDeleteModal(false)
    if (onSelectFolder) onSelectFolder(null)
    onReload()
  }

  const handleConfirmRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentFolder || !renameFolderName.trim()) return
    await api.vault.saveFolder({
      ...currentFolder,
      name: renameFolderName.trim()
    })
    toast(`Folder renamed to "${renameFolderName.trim()}"`)
    setShowRenameModal(false)
    onReload()
  }

  useEffect(() => {
    const handler = () => onReload()
    try {
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.on('vault:accountsUpdated', handler)
        return () => {
          (window as any).electron.ipcRenderer.removeListener('vault:accountsUpdated', handler)
        }
      }
    } catch {}
    return undefined
  }, [onReload])

  const handleSyncLive = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const res = await api.vault.syncLiveLeagueData()
      if (res.status === 'ok') {
        const count = res.data?.updatedCount ?? 0
        toast(count > 0 ? `Synced live data for ${count} ${count === 1 ? 'account' : 'accounts'}` : 'All accounts are up to date')
      } else {
        toast('Sync failed')
      }
      onReload()
    } catch {
      toast('Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null

  if (editingAccount !== null) {
    return (
      <AccountEditView
        account={editingAccount}
        folders={folders}
        onSave={handleSave}
        onCancel={() => setEditingAccount(null)}
      />
    )
  }

  const isFolder = selectedFolderId !== null

  return (
    <div className="flex h-full w-full bg-[#090909] overflow-hidden select-none relative">
      {/* Middle Vault Accounts Column */}
      <div ref={containerRef} className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#090909]">
        {/* Top Header Row with refined scale */}
        <div
          className="shrink-0"
          style={{
            paddingLeft: isFolder ? '36px' : '32px',
            paddingRight: isFolder ? '36px' : '32px',
            paddingTop: isFolder ? '24px' : '20px',
            paddingBottom: isFolder ? '16px' : '14px'
          }}
        >
          <div className="flex items-center justify-between gap-5">
            {/* Header Title: Folder icon + title */}
            <div className={`flex items-center ${isFolder ? 'gap-3' : 'gap-2.5'} min-w-0`}>
              {isFolder && (
                <FolderIcon size={23} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
              )}
              <h1 className={`${isFolder ? 'text-[21px]' : 'text-lg'} font-bold text-white tracking-tight truncate`}>
                {currentFolderName}
              </h1>
            </div>

            {/* Right Action Buttons: Sync, + Create Item & 3-Dots Folder Menu */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Sync Live League Data Button */}
              <button
                type="button"
                onClick={handleSyncLive}
                disabled={isSyncing}
                style={{ paddingLeft: isFolder ? '14px' : '12px', paddingRight: isFolder ? '14px' : '12px' }}
                className={`inline-flex items-center gap-1.5 ${
                  isFolder ? 'h-9 text-[12.5px]' : 'h-8.5 text-xs'
                } rounded-lg font-bold bg-[#181818] text-zinc-300 hover:text-white hover:bg-[#222222] border border-[#2a2a2a] transition-all cursor-pointer shadow-sm disabled:opacity-50`}
                title="Sync avatar icons & ranks from OP.GG"
              >
                <RotateCw size={isFolder ? 14 : 13} className={isSyncing ? 'animate-spin text-white' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingAccount({ folderId: selectedFolderId })}
                style={{ paddingLeft: isFolder ? '16px' : '14px', paddingRight: isFolder ? '16px' : '14px' }}
                className={`inline-flex items-center gap-1.5 ${
                  isFolder ? 'h-9 text-[12.5px]' : 'h-8.5 text-xs'
                } rounded-lg font-bold bg-[#181818] text-white hover:bg-[#222222] border border-[#2a2a2a] transition-all cursor-pointer shadow-sm`}
              >
                <Plus size={isFolder ? 15 : 14} strokeWidth={2.5} />
                <span>Create Item</span>
              </button>

              {isFolder && currentFolder && (
                <div className="relative" ref={folderOptionsRef}>
                  <button
                    type="button"
                    onClick={() => setShowFolderMenu(prev => !prev)}
                    className={`${
                      isFolder ? 'w-9 h-9' : 'w-8.5 h-8.5'
                    } rounded-lg bg-[#181818] text-zinc-400 hover:text-white hover:bg-[#222222] border border-[#2a2a2a] flex items-center justify-center transition-colors cursor-pointer`}
                    title="Folder Options"
                  >
                    <MoreHorizontal size={isFolder ? 17 : 16} />
                  </button>

                  {/* 3-Dots Dropdown Menu (Matches Screenshot 2: Rename, Delete) */}
                  {showFolderMenu && (
                    <div
                      style={{ padding: '8px' }}
                      className="absolute right-0 top-full mt-2 min-w-[160px] bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setRenameFolderName(currentFolder.name)
                          setShowRenameModal(true)
                          setShowFolderMenu(false)
                        }}
                        style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px' }}
                        className="w-full flex items-center text-xs font-bold text-white hover:bg-[#202020] rounded-xl transition-colors cursor-pointer text-left"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoveItemsToTrashOnDelete(false)
                          setShowDeleteModal(true)
                          setShowFolderMenu(false)
                        }}
                        style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px' }}
                        className="w-full flex items-center text-xs font-bold text-white hover:bg-[#202020] rounded-xl transition-colors cursor-pointer text-left"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Column Headers (Title, Last Used, Folder) - Dynamically collapses columns gracefully on narrow widths */}
        <div
          className={`shrink-0 flex items-center justify-between border-b border-[#1e1e1e] ${
            isFolder ? 'text-xs' : 'text-[11px]'
          } font-bold text-zinc-400 select-none`}
          style={{
            paddingLeft: isFolder ? '50px' : '46px',
            paddingRight: isFolder ? '52px' : '48px',
            paddingTop: isFolder ? '12px' : '10px',
            paddingBottom: isFolder ? '12px' : '10px',
            borderBottomWidth: '1.5px'
          }}
        >
          {/* Left Column: Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
            {/* Select All Checkbox Button */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`w-4 h-4 rounded-md flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                isAllChecked || isSomeChecked
                  ? 'bg-white text-zinc-950 border border-white shadow-sm'
                  : 'border border-[#383842] hover:border-zinc-300 bg-transparent'
              }`}
            >
              {isAllChecked && <Check size={10} strokeWidth={3.5} />}
              {isSomeChecked && <Minus size={10} strokeWidth={3.5} />}
            </button>
            <button
              type="button"
              onClick={() => handleSort('title')}
              className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
            >
              <span className={sortField === 'title' ? 'text-white' : ''}>Title</span>
              <ArrowUpDown size={11} className={sortField === 'title' ? 'text-white' : 'text-zinc-500'} />
            </button>
          </div>

          {/* Middle Column: Last Used (Always shown) */}
          <div className={`${showFolderCol ? 'w-36' : 'w-32 text-right justify-end pr-2'} shrink-0 flex items-center`}>
            <button
              type="button"
              onClick={() => handleSort('lastUsed')}
              className="inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
            >
              <span className={sortField === 'lastUsed' ? 'text-white' : ''}>Last used</span>
              <ArrowUpDown size={11} className={sortField === 'lastUsed' ? 'text-white' : 'text-zinc-500'} />
            </button>
          </div>

          {/* Right Column: Folder (Only shown in root Vault if workspace width >= 580px) */}
          {showFolderCol && (
            <div className="w-32 shrink-0 flex items-center pr-2">
              <button
                type="button"
                onClick={() => handleSort('folder')}
                className="inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
              >
                <span className={sortField === 'folder' ? 'text-white' : ''}>Folder</span>
                <ArrowUpDown size={11} className={sortField === 'folder' ? 'text-white' : 'text-zinc-500'} />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Accounts List Area with refined compact spacing */}
        <div
          className={`flex-1 overflow-y-auto ${isFolder ? 'space-y-2' : 'space-y-1.5'}`}
          style={{
            paddingLeft: isFolder ? '36px' : '32px',
            paddingRight: isFolder ? '36px' : '32px',
            paddingTop: isFolder ? '12px' : '10px',
            paddingBottom: isFolder ? '36px' : '32px'
          }}
        >
          {sortedAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              {accounts.length === 0 ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#151518] border border-[#222226] flex items-center justify-center text-zinc-500 mb-1">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Your vault is empty</h3>
                    <p className="text-xs text-zinc-400 mt-1">Save your first League of Legends or Valorant credentials</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAccount({ folderId: selectedFolderId })}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#222227] text-white hover:bg-[#2c2c34] border border-[#2e2e36] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Create Item</span>
                  </button>
                </>
              ) : (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  No items match your search "{searchQuery}"
                </div>
              )}
            </div>
          ) : (
            sortedAccounts.map(a => {
              const fName = folders.find(f => f.id === a.folderId)?.name || '-'
              return (
                <AccountCard
                  key={a.id}
                  account={a}
                  folderName={fName}
                  showFolderColumn={showFolderCol}
                  showLastUsedColumn={showLastUsedCol}
                  isFolderView={isFolder}
                  isSelected={selectedAccountId === a.id}
                  isChecked={checkedAccountIds.has(a.id)}
                  anyChecked={checkedAccountIds.size > 0}
                  onSelect={handleToggleAccount}
                  onToggleCheck={handleToggleCheck}
                  onCopy={handleCopy}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Floating Bottom Action Bar for Multi-Select (Matches Reference Screenshots) */}
      {checkedAccountIds.size > 0 && (
        <div
          style={{ paddingLeft: '24px', paddingRight: '14px', paddingTop: '10px', paddingBottom: '10px' }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#121212] border border-[#222222] rounded-2xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-150"
        >
          {/* Selected Count */}
          <span className="text-xs font-bold text-white select-none whitespace-nowrap">
            {checkedAccountIds.size} {checkedAccountIds.size === 1 ? 'item' : 'items'} selected
          </span>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Move to Folder Button (Opens Full Move Item Modal Window) */}
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowBatchMoveModal(true)}
                style={{ width: '34px', height: '34px' }}
                className={`rounded-xl text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer ${
                  showBatchMoveModal ? 'bg-[#222222] text-white' : 'hover:bg-[#1c1c1c]'
                }`}
              >
                <FolderInput size={18} />
              </button>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black text-white text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-black">
                Move to Folder
              </div>
            </div>

            {/* Remove from Folder Button (Shown when inside a specific folder) */}
            {selectedFolderId !== null && (
              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleBatchRemoveFromFolder}
                  style={{ width: '34px', height: '34px' }}
                  className="rounded-xl text-zinc-300 hover:text-white flex items-center justify-center hover:bg-[#1c1c1c] transition-all cursor-pointer"
                >
                  <FolderMinus size={18} />
                </button>
                <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black text-white text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-black">
                  Remove from Folder
                </div>
              </div>
            )}

            {/* Move to Trash Button (Instant move + toast) */}
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={handleBatchMoveToTrash}
                style={{ width: '34px', height: '34px' }}
                className="rounded-xl text-zinc-300 hover:text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-all cursor-pointer"
              >
                <Trash2 size={18} />
              </button>
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black text-white text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-black">
                Move to Trash
              </div>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-5 bg-[#222222] mx-1.5" />

            {/* X Close Button */}
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setCheckedAccountIds(new Set())
                  setShowBatchMoveModal(false)
                }}
                style={{ width: '34px', height: '34px' }}
                className="rounded-xl text-zinc-300 hover:text-white flex items-center justify-center hover:bg-[#1c1c1c] transition-all cursor-pointer"
              >
                <X size={17} />
              </button>
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black text-white text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-black">
                Clear Selection
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Details Drawer */}
      {selectedAccount && (
        <AccountDetailDrawer
          account={selectedAccount}
          folders={folders}
          width={drawerWidth}
          onWidthChange={handleDrawerWidthChange}
          onClose={() => setSelectedAccountId(null)}
          onEdit={acc => setEditingAccount(acc)}
          onDelete={handleDelete}
          onMoveToTrash={handleMoveToTrash}
          onMoveAccount={handleMoveAccount}
          onCreateAndMoveAccount={handleCreateAndMoveAccount}
          onRemoveFromFolder={handleRemoveFromFolder}
          onCopy={handleCopy}
          onSelectFolder={onSelectFolder}
        />
      )}

      {/* Delete Folder Modal (Matches Reference Screenshot: media_1788033566022.png) */}
      {showDeleteModal && currentFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80"
          onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}
        >
          <div
            style={{ padding: '36px 28px 32px 28px' }}
            className="w-full max-w-[430px] bg-[#121215] border border-[#26262d] rounded-2xl shadow-2xl space-y-6 animate-in fade-in zoom-in-95"
          >
            {/* Header: Title + X */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Delete folder?</h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <p
              style={{ marginTop: '18px' }}
              className="text-[11px] font-bold text-white leading-relaxed"
            >
              Any items in this folder will stay in your vault unless you select the checkbox
            </p>

            {/* Footer Row: Checkbox right next to Delete Button with extra whitespace */}
            <div
              style={{ paddingTop: '28px' }}
              className="flex items-center justify-end gap-5"
            >
              <label
                onClick={() => setMoveItemsToTrashOnDelete(!moveItemsToTrashOnDelete)}
                className="flex items-center gap-3 cursor-pointer select-none"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                    moveItemsToTrashOnDelete
                      ? 'bg-white text-zinc-950 border border-white shadow-sm'
                      : 'border border-[#3d3d47] bg-[#1a1a1f] hover:border-zinc-300'
                  }`}
                >
                  {moveItemsToTrashOnDelete && <Check size={13} strokeWidth={3.5} />}
                </div>
                <span className="text-xs font-semibold text-white">Move folder's items to Trash</span>
              </label>

              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '10px', paddingBottom: '10px' }}
                className="rounded-xl text-xs font-bold bg-[#b52a2a] text-white hover:bg-[#c23636] transition-colors cursor-pointer shadow-md shrink-0"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameModal && currentFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80"
          onClick={e => e.target === e.currentTarget && setShowRenameModal(false)}
        >
          <div
            style={{ padding: '30px 32px' }}
            className="w-full max-w-md bg-[#121212] border border-[#222222] rounded-2xl shadow-2xl space-y-6 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Rename folder</h3>
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmRenameFolder} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Folder name</label>
                <div
                  style={{ paddingLeft: '18px', paddingRight: '18px', height: '52px' }}
                  className="w-full bg-[#181818] border border-[#262626] focus-within:border-white rounded-xl flex items-center gap-3.5 transition-colors"
                >
                  <FolderIcon size={19} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={renameFolderName}
                    onChange={e => setRenameFolderName(e.target.value)}
                    placeholder="Folder name..."
                    className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div
                style={{ paddingTop: '12px' }}
                className="flex items-center justify-end gap-3"
              >
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  style={{ paddingLeft: '18px', paddingRight: '18px', paddingTop: '10px', paddingBottom: '10px' }}
                  className="rounded-xl text-xs font-semibold bg-[#1c1c1c] text-white hover:bg-[#262626] border border-[#2a2a2a] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameFolderName.trim()}
                  style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '10px', paddingBottom: '10px' }}
                  className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Move to Folder Modal Window (Matches Detail Drawer 3-dots Move modal) */}
      {showBatchMoveModal && (
        <MoveAccountModal
          account={checkedAccountIds.size === 1 ? accounts.find(a => checkedAccountIds.has(a.id)) : null}
          accountsCount={checkedAccountIds.size}
          folders={folders}
          onClose={() => setShowBatchMoveModal(false)}
          onMove={handleBatchMoveToFolder}
          onCreateAndMove={handleBatchCreateAndMove}
        />
      )}

      {/* Floating Toast Notifications (Spacious, Padded & Centered) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2.5 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            style={{ paddingLeft: '18px', paddingRight: '22px', paddingTop: '12px', paddingBottom: '12px' }}
            className="flex items-center gap-3 rounded-2xl text-xs font-bold bg-[#121212] text-white border border-[#262626] shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <CheckCircle2 size={16} className="text-white shrink-0" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
