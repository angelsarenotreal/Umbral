import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Trash2,
  Folder as FolderIcon,
  FolderPlus,
  ChevronDown,
  MoreHorizontal,
  KeyRound,
  Lock,
  GripVertical,
  Check,
  X
} from 'lucide-react'
import type { Folder, Account } from '../../../shared/types'
import { api } from '../lib/ipc'

const FOLDER_ORDER_KEY = 'umbral_folder_order'

function loadFolderOrder(): string[] {
  try {
    const raw = localStorage.getItem(FOLDER_ORDER_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFolderOrder(ids: string[]): void {
  try {
    localStorage.setItem(FOLDER_ORDER_KEY, JSON.stringify(ids))
  } catch {}
}

interface Props {
  folders: Folder[]
  accounts: Account[]
  selectedFolder: string | null
  width: number
  onWidthChange: (w: number) => void
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (name: string) => void
  onRenameFolder?: (folder: Folder, newName: string) => void
  onDeleteFolder: (id: string, name: string) => void
  onLock: () => void
}

// Custom Vault / Safe Icon matching exact reference screenshot (solid rounded safe with hinges, feet, and center dial)
function VaultIcon({ size = 19, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Upper Hinge */}
      <rect x="3" y="6" width="3" height="3.5" rx="1.2" />
      {/* Lower Hinge */}
      <rect x="3" y="13" width="3" height="3.5" rx="1.2" />
      {/* Left Foot */}
      <rect x="7" y="18" width="2.5" height="2.5" rx="1" />
      {/* Right Foot */}
      <rect x="14.5" y="18" width="2.5" height="2.5" rx="1" />
      {/* Safe Body with Center Dial Cutout and Solid Center Pin */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 5 7.5 C 5 5.57 6.57 4 8.5 4 L 16.5 4 C 18.43 4 20 5.57 20 7.5 L 20 15.5 C 20 17.43 18.43 19 16.5 19 L 8.5 19 C 6.57 19 5 17.43 5 15.5 Z M 12.5 8 C 10.57 8 9 9.57 9 11.5 C 9 13.43 10.57 15 12.5 15 C 14.43 15 16 13.43 16 11.5 C 16 9.57 14.43 8 12.5 8 Z M 12.5 10 C 13.33 10 14 10.67 14 11.5 C 14 12.33 13.33 13 12.5 13 C 11.67 13 11 12.33 11 11.5 C 11 10.67 11.67 10 12.5 10 Z"
      />
    </svg>
  )
}

export default function Sidebar({
  folders,
  accounts,
  selectedFolder,
  width,
  onWidthChange,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onLock
}: Props): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const folderMenuRef = useRef<HTMLDivElement>(null)
  const createFolderRef = useRef<HTMLFormElement>(null)
  const createBtnRef = useRef<HTMLButtonElement>(null)

  // ── Delete confirmation modal state ─────────────────────────────────────────
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)
  const [moveItemsToTrash, setMoveItemsToTrash] = useState(false)

  // ── Drag-and-drop reordering state ──────────────────────────────────────────
  const [folderOrder, setFolderOrder] = useState<string[]>(loadFolderOrder)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below'>('below')
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  // Derive sorted folder list from persisted order
  const sortedFolders = useCallback(() => {
    const ordered: Folder[] = []
    const remaining = [...folders]
    for (const id of folderOrder) {
      const idx = remaining.findIndex(f => f.id === id)
      if (idx >= 0) {
        ordered.push(remaining.splice(idx, 1)[0])
      }
    }
    return [...ordered, ...remaining]
  }, [folders, folderOrder])()

  // Sync order when new folders are added / deleted
  useEffect(() => {
    const existingIds = folders.map(f => f.id)
    setFolderOrder(prev => {
      const filtered = prev.filter(id => existingIds.includes(id))
      const newIds = existingIds.filter(id => !filtered.includes(id))
      const next = [...filtered, ...newIds]
      saveFolderOrder(next)
      return next
    })
  }, [folders])

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    // Create invisible ghost so we control the visual entirely
    const ghost = document.createElement('div')
    ghost.style.position = 'fixed'
    ghost.style.top = '-9999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === dragId) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverId(id)
    setDragOverPosition(e.clientY < midY ? 'above' : 'below')
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    const currentOrder = sortedFolders.map(f => f.id)
    const fromIdx = currentOrder.indexOf(dragId)
    const toIdx = currentOrder.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return

    const next = [...currentOrder]
    next.splice(fromIdx, 1)
    const insertAt = dragOverPosition === 'above' ? toIdx : toIdx + (fromIdx < toIdx ? 0 : 1)
    next.splice(Math.max(0, Math.min(next.length, insertAt)), 0, dragId)

    setFolderOrder(next)
    saveFolderOrder(next)
    setDragId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDragOverId(null)
  }

  const isVaultPage = location.pathname === '/vault' || location.pathname === '/'
  const isTrashPage = location.pathname === '/trash'
  const trashCount = accounts.filter(a => !!a.deletedAt).length
  const effectiveWidth = Math.max(260, width)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setActiveMenuFolderId(null)
      }
      if (
        createFolderRef.current &&
        !createFolderRef.current.contains(e.target as Node) &&
        createBtnRef.current &&
        !createBtnRef.current.contains(e.target as Node)
      ) {
        setCreating(false)
        setFolderName('')
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) return
    onCreateFolder(folderName.trim())
    setFolderName('')
    setCreating(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = effectiveWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(480, Math.max(260, startWidth + (moveEvent.clientX - startX)))
      onWidthChange(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <>
    <aside
      className="relative shrink-0 bg-[#121212] border-r border-[#222222] flex flex-col h-full select-none justify-between overflow-hidden"
      style={{ width: `${effectiveWidth}px`, minWidth: '260px', borderRightWidth: '1.5px' }}
    >
      {/* Resizing Handle on the right edge (Razor-thin white highlight) */}
      <div
        onMouseDown={handleMouseDown}
        className="group absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-40 flex items-center justify-end select-none"
        title="Drag to resize"
      >
        <div
          className={`w-[1px] h-full transition-colors duration-150 ${
            isResizing ? 'bg-white' : 'bg-transparent group-hover:bg-white/40'
          }`}
        />
      </div>

      {/* Scrollable Main Sidebar Section with generous top whitespace */}
      <div
        className="flex-1 overflow-y-auto bg-[#121212]"
        style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '28px', paddingBottom: '24px' }}
      >
        {/* Top Navigation Items (Vault, Trash) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onSelectFolder(null)
              if (!isVaultPage) navigate('/vault')
            }}
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
            className={`w-full h-11 flex items-center gap-3.5 rounded-xl text-[13px] transition-all cursor-pointer ${
              isVaultPage && selectedFolder === null
                ? 'bg-[#000000] text-white font-bold shadow-sm'
                : 'text-white font-semibold hover:bg-[#1c1c1c]'
            }`}
          >
            <VaultIcon size={19} className="shrink-0 text-white" />
            <span className="truncate">Vault</span>
          </button>

          {/* Trash Button */}
          {(() => {
            const isTrashDisabled = trashCount === 0
            return (
              <button
                type="button"
                disabled={isTrashDisabled}
                onClick={() => {
                  if (isTrashDisabled) return
                  onSelectFolder(null)
                  navigate('/trash')
                }}
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
                className={`w-full h-11 flex items-center justify-between rounded-xl text-[13px] transition-all select-none ${
                  isTrashDisabled
                    ? 'text-zinc-600 cursor-not-allowed opacity-40 hover:bg-transparent'
                    : isTrashPage
                    ? 'bg-[#000000] text-white font-bold shadow-sm cursor-pointer'
                    : 'text-white font-semibold hover:bg-[#1c1c1c] cursor-pointer'
                }`}
                title={isTrashDisabled ? 'Trash is empty' : 'Trash'}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Trash2 size={19} className={`shrink-0 ${isTrashDisabled ? 'text-zinc-600' : 'text-white'}`} />
                  <span className="truncate">Trash</span>
                </div>
                {trashCount > 0 && (
                  <span
                    style={{
                      minWidth: '22px',
                      height: '22px',
                      paddingLeft: '7px',
                      paddingRight: '7px',
                      lineHeight: 1
                    }}
                    className="text-[11px] font-bold rounded-full bg-[#222222] text-zinc-300 border border-[#2e2e2e] inline-flex items-center justify-center shrink-0 select-none shadow-sm"
                  >
                    {trashCount}
                  </span>
                )}
              </button>
            )
          })()}
        </div>

        {/* Separator Line: Pure dead neutral dark gray */}
        <div style={{ marginTop: '24px', marginBottom: '24px', height: '1.5px', backgroundColor: '#222222', marginLeft: '4px', marginRight: '4px' }} />

        {/* Folders Section */}
        <div>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: '16px', paddingLeft: '16px', paddingRight: '14px' }}
          >
            <div className="flex items-center gap-2.5 text-xs font-bold text-white tracking-wide">
              <ChevronDown size={14} className="text-[#a1a1a1]" />
              <span>Folders</span>
            </div>
            <button
              ref={createBtnRef}
              type="button"
              onClick={() => {
                setCreating(!creating)
                if (creating) setFolderName('')
              }}
              className="p-1.5 rounded-lg text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
              title="Add New Folder"
            >
              <FolderPlus size={16} />
            </button>
          </div>

          {creating && (
            <form ref={createFolderRef} onSubmit={handleCreateSubmit} className="mb-3">
              <div
                style={{ paddingLeft: '16px', paddingRight: '14px' }}
                className="h-11 flex items-center gap-3.5 bg-[#0e0e0e] border border-[#00c0f0] rounded-xl shadow-md w-full"
              >
                <FolderIcon size={19} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setCreating(false)
                      setFolderName('')
                    }
                  }}
                  placeholder="Folder name..."
                  className="w-full bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-[#666666]"
                />
              </div>
            </form>
          )}

          {/* Folder Items List: Draggable with grip handles */}
          <div className="space-y-0.5">
            {sortedFolders.map(f => {
              const isSelected = isVaultPage && selectedFolder === f.id
              const isMenuOpen = activeMenuFolderId === f.id
              const isRenaming = renamingFolderId === f.id
              const isDragging = dragId === f.id
              const isDropTarget = dragOverId === f.id

              const handleRenameSubmit = (e?: React.FormEvent) => {
                if (e) e.preventDefault()
                if (editFolderName.trim() && onRenameFolder) {
                  onRenameFolder(f, editFolderName.trim())
                }
                setRenamingFolderId(null)
              }

              if (isRenaming) {
                return (
                  <form
                    key={f.id}
                    onSubmit={handleRenameSubmit}
                    className="h-11 flex items-center w-full"
                  >
                    <div
                      style={{ paddingLeft: '16px', paddingRight: '14px' }}
                      className="h-11 flex items-center gap-3.5 bg-[#0e0e0e] border border-[#00c0f0] rounded-xl shadow-md w-full"
                    >
                      <FolderIcon size={19} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={editFolderName}
                        onChange={e => setEditFolderName(e.target.value)}
                        onBlur={() => handleRenameSubmit()}
                        onKeyDown={e => {
                          if (e.key === 'Escape') setRenamingFolderId(null)
                        }}
                        className="w-full bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-[#666666]"
                      />
                    </div>
                  </form>
                )
              }

              return (
                <div key={f.id} className="relative">
                  {/* Drop indicator ABOVE */}
                  {isDropTarget && dragOverPosition === 'above' && (
                    <div className="absolute top-0 left-3 right-3 h-0.5 bg-white/60 rounded-full z-10 pointer-events-none" />
                  )}

                  <div
                    ref={isDragging ? dragNodeRef : null}
                    draggable
                    onDragStart={e => handleDragStart(e, f.id)}
                    onDragOver={e => handleDragOver(e, f.id)}
                    onDrop={e => handleDrop(e, f.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (dragId) return
                      onSelectFolder(f.id)
                      if (!isVaultPage) navigate('/vault')
                    }}
                    style={{ paddingLeft: '8px', paddingRight: '14px' }}
                    className={`group relative h-11 flex items-center justify-between rounded-xl text-[13px] transition-all cursor-pointer ${
                      isDragging
                        ? 'opacity-40 scale-[0.98]'
                        : isSelected
                        ? 'bg-[#000000] text-white font-bold shadow-sm'
                        : 'text-white font-semibold hover:bg-[#1c1c1c]'
                    }`}
                  >
                    {/* Grip Handle */}
                    <div
                      className="shrink-0 flex items-center justify-center w-6 h-full text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                      style={{ touchAction: 'none' }}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </div>

                    <div className="flex items-center gap-3 truncate min-w-0 flex-1">
                      {/* Bright solid cyan folder icon */}
                      <FolderIcon size={19} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuFolderId(isMenuOpen ? null : f.id)
                      }}
                      className={`p-1 rounded-md hover:bg-[#262626] text-white transition-opacity ${
                        isSelected || isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    {/* Folder Context Menu */}
                    {isMenuOpen && (
                      <div
                        ref={folderMenuRef}
                        style={{ padding: '6px', width: '132px' }}
                        className="absolute right-1 top-full mt-1.5 bg-[#181818] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 animate-in fade-in space-y-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Rename Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuFolderId(null)
                            setRenamingFolderId(f.id)
                            setEditFolderName(f.name)
                          }}
                          style={{ paddingLeft: '14px', paddingRight: '14px' }}
                          className="w-full h-8 flex items-center rounded-lg text-xs font-semibold text-white hover:bg-[#262626] transition-colors cursor-pointer text-left"
                        >
                          Rename
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuFolderId(null)
                            setMoveItemsToTrash(false)
                            setDeletingFolder(f)
                          }}
                          style={{ paddingLeft: '14px', paddingRight: '14px' }}
                          className="w-full h-8 flex items-center rounded-lg text-xs font-semibold text-[#dddddd] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer text-left"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Drop indicator BELOW */}
                  {isDropTarget && dragOverPosition === 'below' && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-white/60 rounded-full z-10 pointer-events-none" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Generous Separator Line: Pure dead neutral dark gray */}
      <div style={{ marginLeft: '20px', marginRight: '20px', height: '1.5px', backgroundColor: '#222222' }} />

      {/* Bottom Pinned Items with dead neutral #121212 background */}
      <div
        className="space-y-2 bg-[#121212]"
        style={{ paddingTop: '20px', paddingBottom: '24px', paddingLeft: '20px', paddingRight: '20px' }}
      >
        <button
          type="button"
          onClick={() => navigate('/generator')}
          style={{ paddingLeft: '16px', paddingRight: '16px' }}
          className={`w-full h-11 flex items-center gap-3.5 rounded-xl text-[13px] transition-all cursor-pointer ${
            location.pathname === '/generator'
              ? 'bg-[#000000] text-white font-bold shadow-sm'
              : 'text-white font-semibold hover:bg-[#1c1c1c]'
          }`}
        >
          <KeyRound size={19} className="text-white shrink-0" />
          <span className="truncate">Password Generator</span>
        </button>

        <button
          type="button"
          onClick={onLock}
          style={{ paddingLeft: '16px', paddingRight: '16px' }}
          className="w-full h-11 flex items-center gap-3.5 rounded-xl text-[13px] font-semibold text-white hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <Lock size={19} className="text-white shrink-0" />
          <span className="truncate">Lock Vault</span>
        </button>
      </div>
    </aside>

    {/* ── Delete Folder Confirmation Modal ──────────────────────────────────── */}
    {deletingFolder && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80"
        onClick={e => e.target === e.currentTarget && setDeletingFolder(null)}
      >
        <div
          style={{ padding: '36px 28px 32px 28px' }}
          className="w-full max-w-[430px] bg-[#121215] border border-[#26262d] rounded-2xl shadow-2xl space-y-6 animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Delete folder?</h3>
            <button
              type="button"
              onClick={() => setDeletingFolder(null)}
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

          {/* Footer: Checkbox + Delete button */}
          <div
            style={{ paddingTop: '28px' }}
            className="flex items-center justify-end gap-5"
          >
            <label
              onClick={() => setMoveItemsToTrash(!moveItemsToTrash)}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                  moveItemsToTrash
                    ? 'bg-white text-zinc-950 border border-white shadow-sm'
                    : 'border border-[#3d3d47] bg-[#1a1a1f] hover:border-zinc-300'
                }`}
              >
                {moveItemsToTrash && <Check size={13} strokeWidth={3.5} />}
              </div>
              <span className="text-xs font-semibold text-white">Move folder's items to Trash</span>
            </label>

            <button
              type="button"
              onClick={async () => {
                if (moveItemsToTrash) {
                  const accRes = await api.vault.getAccounts()
                  if (accRes.status === 'ok' && accRes.data) {
                    const inFolder = accRes.data.filter(a => a.folderId === deletingFolder.id && !a.deletedAt)
                    for (const acc of inFolder) {
                      await api.vault.saveAccount({ ...acc, deletedAt: new Date().toISOString(), folderId: null })
                    }
                  }
                }
                onDeleteFolder(deletingFolder.id, deletingFolder.name)
                setDeletingFolder(null)
                setMoveItemsToTrash(false)
              }}
              style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '10px', paddingBottom: '10px' }}
              className="rounded-xl text-xs font-bold bg-[#b52a2a] text-white hover:bg-[#c23636] transition-colors cursor-pointer shadow-md shrink-0"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
