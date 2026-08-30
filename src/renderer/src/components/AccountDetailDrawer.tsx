import React, { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal,
  Copy,
  Check,
  Eye,
  EyeOff,
  Folder as FolderIcon,
  Edit3,
  Trash2,
  FolderInput,
  FolderMinus,
  History
} from 'lucide-react'
import RiotIcon from './RiotIcon'
import MoveAccountModal from './MoveAccountModal'
import PasswordHistoryModal from './PasswordHistoryModal'
import type { Account, Folder } from '../../../shared/types'

interface Props {
  account: Account | null
  folders: Folder[]
  width: number
  onWidthChange: (w: number) => void
  onClose: () => void
  onEdit: (account: Account) => void
  onDelete?: (id: string) => void
  onMoveToTrash?: (account: Account) => void
  onMoveAccount?: (account: Account, folderId: string | null) => Promise<void> | void
  onCreateAndMoveAccount?: (account: Account, folderName: string) => Promise<void> | void
  onRemoveFromFolder?: (account: Account) => Promise<void> | void
  onCopy: (text: string, label: string) => void
  onSelectFolder?: (folderId: string | null) => void
}

export default function AccountDetailDrawer({
  account,
  folders,
  width,
  onWidthChange,
  onClose: _onClose,
  onEdit,
  onDelete,
  onMoveToTrash,
  onMoveAccount,
  onCreateAndMoveAccount,
  onRemoveFromFolder,
  onCopy,
  onSelectFolder
}: Props): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const effectiveWidth = Math.max(300, width)

  useEffect(() => {
    setShowPassword(false)
  }, [account?.id])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = effectiveWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(600, Math.max(300, startWidth + (startX - moveEvent.clientX)))
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

  if (!account) {
    return (
      <aside
        className="relative shrink-0 bg-[#121212] border-l border-[#222222] flex flex-col items-center justify-center text-center select-none"
        style={{ width: `${effectiveWidth}px`, paddingLeft: '32px', paddingRight: '32px', borderLeftWidth: '1.5px' }}
      >
        {/* Resizing Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="group absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-40 flex items-center justify-start select-none"
          title="Drag to resize"
        >
          <div
            className={`w-[1px] h-full transition-colors duration-150 ${
              isResizing ? 'bg-white' : 'bg-transparent group-hover:bg-white/40'
            }`}
          />
        </div>
        <div className="w-16 h-16 rounded-2xl bg-[#181818] border border-[#242424] flex items-center justify-center text-zinc-500 mb-4 shadow-sm">
          <RiotIcon size={28} className="text-zinc-500" />
        </div>
        <h3 className="text-sm font-bold text-white">No item selected</h3>
        <p className="text-xs text-zinc-400 mt-1.5 max-w-[220px] leading-relaxed">
          Select an account from the list to view its credentials and details.
        </p>
      </aside>
    )
  }

  const folder = folders.find(f => f.id === account.folderId)
  const formattedTitle =
    account.title ||
    `${account.summonerName || account.username}${account.summonerTag ? `#${account.summonerTag}` : ''}`

  const handleCopy = (text: string, label: string) => {
    onCopy(text, label)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const handleMoveSubmit = async (targetFolderId: string | null) => {
    setShowMoveModal(false)
    if (onMoveAccount) {
      await onMoveAccount(account, targetFolderId)
    }
  }

  const handleCreateAndMoveSubmit = async (folderName: string) => {
    setShowMoveModal(false)
    if (onCreateAndMoveAccount) {
      await onCreateAndMoveAccount(account, folderName)
    }
  }

  const iconSrc = account.iconUrl || (account.iconId ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${account.iconId}.jpg` : 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/7.jpg')
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [iconSrc])

  const rawRank = account.rankLp || account.rank || null
  const displayRank = rawRank
    ? rawRank
        .replace(/\b([I|V|X]+)\s+I\s+LP\b/gi, '$1 1 LP')
        .replace(/\b([I|V|X]+)\s+II\s+LP\b/gi, '$1 2 LP')
        .replace(/\b([I|V|X]+)\s+III\s+LP\b/gi, '$1 3 LP')
        .replace(/\b([I|V|X]+)\s+IV\s+LP\b/gi, '$1 4 LP')
    : null

  return (
    <aside
      className="relative shrink-0 bg-[#121212] border-l border-[#222222] flex flex-col h-full overflow-hidden select-none"
      style={{ width: `${effectiveWidth}px`, borderLeftWidth: '1.5px' }}
    >
      {/* Resizing Handle on the left edge (Razor-thin white highlight) */}
      <div
        onMouseDown={handleMouseDown}
        className="group absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-40 flex items-center justify-start select-none"
        title="Drag to resize"
      >
        <div
          className={`w-[1px] h-full transition-colors duration-150 ${
            isResizing ? 'bg-white' : 'bg-transparent group-hover:bg-white/40'
          }`}
        />
      </div>

      {/* Top Action Bar: Edit & More Options */}
      <div
        className="flex items-center justify-end gap-2.5 border-b border-[#222222]"
        style={{ paddingLeft: '28px', paddingRight: '28px', paddingTop: '16px', paddingBottom: '16px' }}
      >
        <button
          type="button"
          onClick={() => onEdit(account)}
          style={{ paddingLeft: '16px', paddingRight: '16px' }}
          className="flex items-center gap-2 h-9 rounded-xl text-xs font-bold bg-[#222222] text-white hover:bg-[#2c2c2c] border border-[#303030] transition-colors cursor-pointer shadow-sm"
        >
          <Edit3 size={14} />
          <span>Edit</span>
        </button>

        {/* 3-Dots More Options Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="w-9 h-9 rounded-xl text-zinc-400 hover:text-white bg-[#222222] hover:bg-[#2c2c2c] border border-[#303030] flex items-center justify-center transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreHorizontal size={17} />
          </button>

          {showMoreMenu && (
            <div
              style={{ padding: '8px', minWidth: '220px' }}
              className="absolute right-0 top-full mt-2 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1 select-none"
            >
              {/* Option 1: Move */}
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false)
                  setShowMoveModal(true)
                }}
                style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', height: '40px' }}
                className="w-full flex items-center rounded-xl text-xs font-bold text-white hover:bg-[#222222] transition-colors text-left cursor-pointer"
              >
                Move
              </button>

              {/* Option 2: Remove from Folder (Only when in a folder) */}
              {account.folderId && onRemoveFromFolder && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    onRemoveFromFolder(account)
                  }}
                  style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', height: '40px' }}
                  className="w-full flex items-center rounded-xl text-xs font-bold text-white hover:bg-[#222222] transition-colors text-left cursor-pointer"
                >
                  Remove from Folder
                </button>
              )}

              {/* Option 3: Password History */}
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false)
                  setShowHistoryModal(true)
                }}
                style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', height: '40px' }}
                className="w-full flex items-center rounded-xl text-xs font-bold text-white hover:bg-[#222222] transition-colors text-left cursor-pointer"
              >
                Password History
              </button>

              {/* Separator */}
              <div style={{ marginTop: '4px', marginBottom: '4px', height: '1px', backgroundColor: '#222222', marginLeft: '6px', marginRight: '6px' }} />

              {/* Option 4: Delete Item */}
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false)
                  if (onMoveToTrash) {
                    onMoveToTrash(account)
                  } else if (onDelete) {
                    onDelete(account.id)
                  }
                }}
                style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', height: '40px' }}
                className="w-full flex items-center rounded-xl text-xs font-bold text-red-400 hover:bg-[#261414] transition-colors text-left cursor-pointer"
              >
                Delete Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Drawer Scroll Area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingLeft: '28px', paddingRight: '28px', paddingTop: '32px', paddingBottom: '36px' }}
      >
        {/* Header Icon + Title */}
        <div
          className="flex flex-col items-center text-center select-none"
          style={{ marginBottom: '32px' }}
        >
          <div
            style={{ marginBottom: '18px' }}
            className="w-16 h-16 rounded-2xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shadow-lg shrink-0 overflow-hidden relative"
          >
            <img
              src={iconSrc}
              alt="Summoner Icon"
              className="w-full h-full object-cover"
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/7.jpg'
              }}
            />
          </div>
          <h2 className="text-[19px] font-bold text-white tracking-tight break-words max-w-full px-2 leading-snug">
            {formattedTitle}
          </h2>
          {displayRank && (
            <p className="text-xs text-zinc-400 font-mono mt-1.5 font-semibold">
              {displayRank}
            </p>
          )}
        </div>

        {/* Credentials Field Cards */}
        <div className="space-y-3.5">
          {/* Username Field */}
          <div
            onClick={() => handleCopy(account.username, 'Username')}
            style={{ padding: '13px 16px' }}
            className="group relative flex items-center justify-between rounded-2xl hover:bg-[#1e1e1e] transition-all cursor-pointer select-none"
          >
            <div className="min-w-0 flex-1 pr-3">
              <span className="text-xs text-zinc-400 font-medium block">
                Username
              </span>
              <p className="text-sm font-bold text-white truncate mt-1 leading-snug">
                {account.username}
              </p>
            </div>

            <div className="relative shrink-0 flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy(account.username, 'Username')
                }}
                className="w-9 h-9 rounded-xl bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white flex items-center justify-center cursor-pointer transition-all shadow-sm opacity-0 group-hover:opacity-100"
                title="Copy"
              >
                {copiedField === 'Username' ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          </div>

          {/* Password Field */}
          <div
            onClick={() => handleCopy(account.password, 'Password')}
            style={{ padding: '13px 16px' }}
            className="group relative flex items-center justify-between rounded-2xl hover:bg-[#1e1e1e] transition-all cursor-pointer select-none"
          >
            <div className="min-w-0 flex-1 pr-3">
              <span className="text-xs text-zinc-400 font-medium block">
                Password
              </span>
              <p className="text-sm font-bold text-white font-mono truncate mt-1 leading-snug tracking-wider">
                {showPassword ? account.password : '••••••••••••••••'}
              </p>
            </div>

            <div className="relative shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPassword(!showPassword)
                }}
                className="w-9 h-9 rounded-xl bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white flex items-center justify-center cursor-pointer transition-all shadow-sm"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={16} />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy(account.password, 'Password')
                }}
                className="w-9 h-9 rounded-xl bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white flex items-center justify-center cursor-pointer transition-all shadow-sm"
                title="Copy"
              >
                {copiedField === 'Password' ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          </div>

          {/* Rank & LP Field if present */}
          {displayRank && (
            <div
              style={{ padding: '13px 16px' }}
              className="group relative flex items-center justify-between rounded-2xl bg-[#161616] border border-[#222222] select-none"
            >
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-xs text-zinc-400 font-medium block">
                  Rank & LP
                </span>
                <p className="text-sm font-bold text-white font-mono truncate mt-1 leading-snug">
                  {displayRank}
                </p>
              </div>
            </div>
          )}

          {/* Region Field */}
          <div
            style={{ padding: '13px 16px' }}
            className="group relative flex items-center justify-between rounded-2xl hover:bg-[#1e1e1e] transition-all select-none"
          >
            <div className="min-w-0 flex-1">
              <span className="text-xs text-zinc-400 font-medium block">
                Region
              </span>
              <p className="text-sm font-bold text-white truncate mt-1 leading-snug">
                {account.region ? account.region.toUpperCase() : 'EUW'}
              </p>
            </div>
          </div>

          {/* Folder Field - Click navigates to that folder */}
          <div
            onClick={() => {
              if (account.folderId && onSelectFolder) {
                onSelectFolder(account.folderId)
              }
            }}
            style={{ padding: '13px 16px' }}
            className={`group relative flex items-center justify-between rounded-2xl hover:bg-[#1e1e1e] transition-all select-none ${
              account.folderId && onSelectFolder ? 'cursor-pointer' : 'cursor-default'
            }`}
            title={folder ? `Go to folder: ${folder.name}` : undefined}
          >
            <div className="min-w-0 flex-1">
              <span className="text-xs text-zinc-400 font-medium block">
                Folder
              </span>
              <div className="flex items-center gap-2.5 mt-1.5">
                <FolderIcon size={18} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                <span className="text-sm font-bold text-white truncate">
                  {folder ? folder.name : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes Field if present */}
          {account.notes && (
            <div
              style={{ padding: '13px 16px' }}
              className="group relative rounded-2xl hover:bg-[#1e1e1e] transition-all select-none"
            >
              <span className="text-xs text-zinc-400 font-medium block">
                Notes
              </span>
              <p className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed mt-1.5">
                {account.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Move Account Modal */}
      {showMoveModal && (
        <MoveAccountModal
          account={account}
          folders={folders}
          onClose={() => setShowMoveModal(false)}
          onMove={handleMoveSubmit}
          onCreateAndMove={handleCreateAndMoveSubmit}
        />
      )}

      {/* Password History Modal */}
      {showHistoryModal && (
        <PasswordHistoryModal
          account={account}
          onClose={() => setShowHistoryModal(false)}
          onCopy={onCopy}
        />
      )}
    </aside>
  )
}
