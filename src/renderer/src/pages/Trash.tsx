import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trash2,
  RotateCcw,
  CheckCircle2,
  ArrowUpDown,
  X
} from 'lucide-react'
import RiotIcon from '../components/RiotIcon'
import type { Account, Folder } from '../../../shared/types'
import { api } from '../lib/ipc'

interface Props {
  accounts: Account[]
  folders: Folder[]
  onReload: () => void
}

type Toast = { id: number; message: string }

export default function Trash({
  accounts,
  onReload
}: Props): JSX.Element {
  const navigate = useNavigate()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [sortField, setSortField] = useState<'title' | 'deleted'>('deleted')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: 'title' | 'deleted') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'deleted' ? 'desc' : 'asc')
    }
  }

  const toast = (message: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500)
  }

  // Filter accounts in trash and sort
  const trashAccounts = accounts.filter(a => !!a.deletedAt).sort((a, b) => {
    if (sortField === 'title') {
      const titleA = (a.title || a.summonerName || a.username || '').toLowerCase()
      const titleB = (b.title || b.summonerName || b.username || '').toLowerCase()
      return sortDirection === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA)
    }
    const timeA = new Date(a.deletedAt || a.updatedAt || a.createdAt).getTime()
    const timeB = new Date(b.deletedAt || b.updatedAt || b.createdAt).getTime()
    return sortDirection === 'asc' ? timeA - timeB : timeB - timeA
  })

  useEffect(() => {
    if (trashAccounts.length === 0) {
      navigate('/vault')
    }
  }, [trashAccounts.length, navigate])

  const handleRestore = async (account: Account) => {
    const updated: Account = {
      ...account,
      deletedAt: null
    }
    const res = await api.vault.saveAccount(updated)
    if (res.status === 'ok') {
      toast(`Restored "${account.title || account.username}" to Vault`)
      onReload()
    } else {
      toast('Failed to restore item')
    }
  }

  const handleDeletePermanently = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete "${name}"? This action cannot be undone.`)) return
    const res = await api.vault.deleteAccount(id)
    if (res.status === 'ok') {
      toast('Item permanently deleted')
      onReload()
    } else {
      toast('Failed to delete item')
    }
  }

  const handleEmptyTrash = async () => {
    setConfirmEmptyTrash(false)
    for (const acc of trashAccounts) {
      await api.vault.deleteAccount(acc.id)
    }
    toast('Trash emptied')
    onReload()
  }

  return (
    <div className="flex h-full w-full bg-[#090909] overflow-hidden select-none relative">
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#090909]">
        {/* Top Header Row */}
        <div
          className="shrink-0"
          style={{ paddingLeft: '36px', paddingRight: '36px', paddingTop: '24px', paddingBottom: '16px' }}
        >
          <div className="flex items-center justify-between gap-5">
            {/* Header Title: Trash */}
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 size={23} className="text-zinc-400 shrink-0" />
              <h1 className="text-[21px] font-bold text-white tracking-tight truncate">
                Trash ({trashAccounts.length})
              </h1>
            </div>

            {/* Right Action: Empty Trash */}
            {trashAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmEmptyTrash(true)}
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
                className="inline-flex items-center gap-2 h-9 rounded-lg text-[12.5px] font-bold bg-[#261414] hover:bg-[#381c1c] text-red-400 border border-red-500/20 transition-all cursor-pointer shadow-sm"
              >
                <Trash2 size={14} />
                <span>Empty Trash</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Column Headers */}
        <div
          className="shrink-0 flex items-center justify-between border-b border-[#1e1e1e] text-xs font-bold text-zinc-400 select-none"
          style={{
            paddingLeft: '50px',
            paddingRight: '52px',
            paddingTop: '12px',
            paddingBottom: '12px',
            borderBottomWidth: '1.5px'
          }}
        >
          {/* Left: Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
            <button
              type="button"
              onClick={() => handleSort('title')}
              className="inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
            >
              <span className={sortField === 'title' ? 'text-white' : ''}>Title</span>
              <ArrowUpDown size={11} className={sortField === 'title' ? 'text-white' : 'text-zinc-500'} />
            </button>
          </div>

          {/* Middle: Deleted Date */}
          <div className="w-36 shrink-0 flex items-center pr-2">
            <button
              type="button"
              onClick={() => handleSort('deleted')}
              className="inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
            >
              <span className={sortField === 'deleted' ? 'text-white' : ''}>Deleted</span>
              <ArrowUpDown size={11} className={sortField === 'deleted' ? 'text-white' : 'text-zinc-500'} />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="w-36 shrink-0 text-right pr-1">
            <span>Actions</span>
          </div>
        </div>

        {/* Scrollable Accounts List Area */}
        <div
          className="flex-1 overflow-y-auto space-y-2"
          style={{
            paddingLeft: '36px',
            paddingRight: '36px',
            paddingTop: '12px',
            paddingBottom: '36px'
          }}
        >
          {trashAccounts.map(acc => {
            const formattedTitle =
              acc.title ||
              `${acc.summonerName || acc.username}${acc.summonerTag ? `#${acc.summonerTag}` : ''}`
            const iconSrc = acc.iconUrl || (acc.iconId ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${acc.iconId}.jpg` : null)
            const rankSubtitle =
              acc.rankLp && acc.rankLp !== 'UNRANKED'
                ? acc.rankLp
                : acc.rank && acc.rank.toUpperCase() !== 'UNRANKED'
                ? acc.rank.toUpperCase()
                : acc.username

            return (
              <div
                key={acc.id}
                style={{ paddingLeft: '16px', paddingRight: '18px' }}
                className="group relative flex items-center justify-between h-[68px] w-full rounded-xl select-none transition-all duration-150 bg-[#141414] hover:bg-[#181818] border border-[#222222]"
              >
                {/* Left section: Avatar + Title & Rank/Username */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                  {/* Summoner Icon / Riot Squircle Avatar */}
                  <div className="w-9.5 h-9.5 rounded-xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden relative">
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt="Icon"
                        className="w-full h-full object-cover"
                        onError={e => ((e.currentTarget as HTMLElement).style.display = 'none')}
                      />
                    ) : (
                      <RiotIcon size={19} />
                    )}
                  </div>

                  {/* Title & Rank + LP */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13.5px] font-bold text-white truncate leading-tight">
                      {formattedTitle}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono leading-tight truncate mt-0.5 tracking-tight">
                      {rankSubtitle}
                    </p>
                  </div>
                </div>

                {/* Middle Column: Deleted date */}
                <div className="w-36 shrink-0 flex items-center text-xs text-zinc-400 font-medium whitespace-nowrap truncate pr-2">
                  {acc.deletedAt ? new Date(acc.deletedAt).toLocaleDateString() : 'Recently'}
                </div>

                {/* Right Column: Restore + Delete Buttons */}
                <div className="w-36 shrink-0 flex items-center justify-end gap-2 pr-1">
                  {/* Restore Button */}
                  <button
                    type="button"
                    onClick={() => handleRestore(acc)}
                    style={{ height: '34px', paddingLeft: '14px', paddingRight: '14px' }}
                    className="flex items-center gap-1.5 rounded-xl text-xs font-bold bg-[#1e1e1e] hover:bg-[#262626] text-white border border-[#2e2e2e] transition-colors cursor-pointer shadow-sm"
                    title="Restore to Vault"
                  >
                    <RotateCcw size={13} />
                    <span>Restore</span>
                  </button>

                  {/* Permanently Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeletePermanently(acc.id, formattedTitle)}
                    style={{ height: '34px', width: '34px' }}
                    className="flex items-center justify-center rounded-xl text-xs font-bold bg-[#261414] hover:bg-[#381c1c] text-red-400 border border-red-500/20 transition-colors cursor-pointer shrink-0"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty Trash Confirmation Modal */}
      {confirmEmptyTrash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80"
          onClick={e => e.target === e.currentTarget && setConfirmEmptyTrash(false)}
        >
          <div
            style={{ padding: '32px 28px 24px 28px' }}
            className="w-full max-w-[420px] bg-[#121212] border border-[#222222] rounded-3xl shadow-2xl space-y-6 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">
                Empty Trash?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmEmptyTrash(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete all {trashAccounts.length} item(s) in the trash? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEmptyTrash(false)}
                style={{ height: '38px', paddingLeft: '18px', paddingRight: '18px' }}
                className="rounded-xl text-xs font-bold bg-[#222222] text-white hover:bg-[#2c2c2c] border border-[#2e2e2e] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleEmptyTrash}
                style={{ height: '38px', paddingLeft: '20px', paddingRight: '20px' }}
                className="rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer shadow-md"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Toast Notification */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              style={{ padding: '12px 22px' }}
              className="bg-[#121212] border border-[#262626] text-white text-xs font-bold rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
            >
              <CheckCircle2 size={16} className="text-white shrink-0" />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
