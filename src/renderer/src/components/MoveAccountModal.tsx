import React, { useState } from 'react'
import { X, Folder as FolderIcon, FolderPlus } from 'lucide-react'
import RiotIcon from './RiotIcon'
import type { Account, Folder } from '../../../shared/types'

interface Props {
  account?: Account | null
  accountsCount?: number
  folders: Folder[]
  onClose: () => void
  onMove: (folderId: string | null) => void
  onCreateAndMove: (folderName: string) => Promise<void> | void
}

export default function MoveAccountModal({
  account,
  accountsCount,
  folders,
  onClose,
  onMove,
  onCreateAndMove
}: Props): JSX.Element {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(account ? account.folderId || null : null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)

  const count = accountsCount || (account ? 1 : 1)
  const formattedTitle = account
    ? account.title ||
      `${account.summonerName || account.username}${account.summonerTag ? `#${account.summonerTag}` : ''}${account.rank ? ` [${account.rank}]` : ''}`
    : `${count} ${count === 1 ? 'item' : 'items'} selected`
  const formattedSubtitle = account ? account.username : 'Choose a destination folder'

  const handleCreateAndMoveSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newFolderName.trim() || creating) return
    setCreating(true)
    try {
      await onCreateAndMove(newFolderName.trim())
    } finally {
      setCreating(false)
    }
  }

  // ── "Add New Folder" Sub-modal ──
  if (isCreatingFolder) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80 select-none animate-in fade-in"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div
          style={{ padding: '36px 32px 32px 32px' }}
          className="w-full max-w-[420px] bg-[#121212] border border-[#222222] rounded-3xl shadow-2xl animate-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
            <h3 className="text-base font-bold text-white tracking-tight">Add New Folder</h3>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Folder name input card */}
          <form onSubmit={handleCreateAndMoveSubmit}>
            <div
              style={{ paddingLeft: '18px', paddingRight: '18px', height: '58px', marginBottom: '28px' }}
              className="w-full bg-[#181818] border border-[#262626] focus-within:border-white rounded-xl flex items-center gap-3.5 transition-colors"
            >
              <FolderIcon size={20} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
              />
            </div>

            {/* Footer button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!newFolderName.trim() || creating}
                style={{ height: '42px', paddingLeft: '24px', paddingRight: '24px' }}
                className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create and Move'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── "Move Item(s)" Modal ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80 select-none animate-in fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ padding: '32px 28px 28px 28px' }}
        className="w-full max-w-[450px] bg-[#121212] border border-[#222222] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]"
      >
        {/* Header: Avatar, Title, Subtitle, Close X */}
        <div className="flex items-center justify-between gap-3 shrink-0" style={{ marginBottom: '22px' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shrink-0 shadow-sm">
              <RiotIcon size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight truncate">
                {formattedTitle}
              </h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5 font-medium">
                {formattedSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Folder List with generous margins */}
        <div
          className="flex-1 overflow-y-auto pr-1 min-h-[160px] max-h-[280px]"
          style={{ marginTop: '4px', marginBottom: '18px' }}
        >
          <div className="space-y-2">
            {/* Vault Root option */}
            <div
              onClick={() => setSelectedFolderId(null)}
              style={{ padding: '12px 16px' }}
              className={`flex items-center gap-3.5 rounded-2xl cursor-pointer transition-all ${
                selectedFolderId === null
                  ? 'bg-[#222222] border border-[#2e2e2e] shadow-sm'
                  : 'hover:bg-[#181818] border border-transparent'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  selectedFolderId === null
                    ? 'border-white bg-black'
                    : 'border-zinc-600 bg-transparent'
                }`}
              >
                {selectedFolderId === null && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <FolderIcon size={19} className="text-zinc-400 shrink-0" />
              <span className="text-sm font-bold text-white truncate flex-1">
                Vault (No folder)
              </span>
            </div>

            {/* Custom Folders */}
            {folders.map(f => {
              const isSelected = selectedFolderId === f.id
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  style={{ padding: '12px 16px' }}
                  className={`flex items-center gap-3.5 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#222222] border border-[#2e2e2e] shadow-sm'
                      : 'hover:bg-[#181818] border border-transparent'
                  }`}
                >
                  {/* Radio circle button */}
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-white bg-black'
                        : 'border-zinc-600 bg-transparent'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>

                  {/* Folder icon & name */}
                  <FolderIcon size={19} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                  <span className="text-sm font-bold text-white truncate flex-1">
                    {f.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom Actions Footer */}
        <div
          className="flex items-center justify-between border-t border-[#222222] shrink-0"
          style={{ paddingTop: '20px', marginTop: '6px' }}
        >
          {/* + New folder button on left */}
          <button
            type="button"
            onClick={() => setIsCreatingFolder(true)}
            className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer py-2 px-1"
          >
            <FolderPlus size={16} className="text-white" />
            <span>New folder</span>
          </button>

          {/* Cancel & Move buttons on right */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              style={{ height: '40px', paddingLeft: '20px', paddingRight: '20px' }}
              className="rounded-xl text-xs font-bold bg-[#222222] text-white hover:bg-[#2c2c2c] border border-[#2e2e2e] transition-colors cursor-pointer shadow-sm"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onMove(selectedFolderId)}
              style={{ height: '40px', paddingLeft: '24px', paddingRight: '24px' }}
              className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-md"
            >
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
