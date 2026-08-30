import React, { useState } from 'react'
import { X, Eye, EyeOff, Copy, Check } from 'lucide-react'
import RiotIcon from './RiotIcon'
import type { Account } from '../../../shared/types'

interface Props {
  account: Account
  onClose: () => void
  onCopy: (text: string, label: string) => void
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'Recently'
    const datePart = d.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric'
    })
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    return `${datePart} at ${timePart}`
  } catch {
    return 'Recently'
  }
}

export default function PasswordHistoryModal({
  account,
  onClose,
  onCopy
}: Props): JSX.Element {
  const [showAllPasswords, setShowAllPasswords] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const formattedTitle =
    account.title ||
    `${account.summonerName || account.username}${account.summonerTag ? `#${account.summonerTag}` : ''}${account.rank ? ` [${account.rank}]` : ''}`

  // Aggregate current password and historical passwords
  const historyList = [
    {
      password: account.password,
      changedAt: account.updatedAt || account.createdAt || new Date().toISOString(),
      isCurrent: true
    },
    ...(account.passwordHistory || []).map(h => ({
      password: h.password,
      changedAt: h.changedAt,
      isCurrent: false
    }))
  ]

  const handleCopy = (pwd: string, idx: number) => {
    onCopy(pwd, 'Password')
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80 select-none animate-in fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ padding: '32px 28px 28px 28px' }}
        className="w-full max-w-[480px] bg-[#121212] border border-[#222222] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]"
      >
        {/* Header: Title + X */}
        <div className="flex items-center justify-between shrink-0" style={{ marginBottom: '20px' }}>
          <h3 className="text-base font-bold text-white tracking-tight">
            Password History
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subheader: Item Avatar + Title + Username + Global Eye Toggle */}
        <div
          style={{ padding: '14px 16px', marginBottom: '20px' }}
          className="bg-[#181818] border border-[#242424] rounded-2xl flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shrink-0 shadow-sm">
              <RiotIcon size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white tracking-tight truncate">
                {formattedTitle}
              </h4>
              <p className="text-xs text-zinc-400 truncate mt-0.5 font-medium">
                {account.username}
              </p>
            </div>
          </div>

          {/* Eye Reveal Button */}
          <button
            type="button"
            onClick={() => setShowAllPasswords(!showAllPasswords)}
            className="w-9 h-9 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-[#2e2e2e]"
            title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
          >
            {showAllPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Scrollable Password History List with generous item spacing */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[140px] max-h-[300px]">
          <div className="space-y-2.5">
            {historyList.map((item, index) => {
              const isCopied = copiedIndex === index
              return (
                <div
                  key={index}
                  style={{ padding: '14px 16px' }}
                  className="group flex items-center justify-between gap-3 rounded-2xl bg-[#161616] hover:bg-[#1c1c1c] border border-[#222222] transition-colors"
                >
                  {/* Left: Date & Username */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-tight">
                        {formatDate(item.changedAt)}
                      </span>
                      {item.isCurrent && (
                        <span
                          style={{
                            paddingLeft: '10px',
                            paddingRight: '10px',
                            paddingTop: '3px',
                            paddingBottom: '3px',
                            lineHeight: 1
                          }}
                          className="text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center justify-center shrink-0 ml-1.5 select-none"
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-medium truncate">
                      {account.username}
                    </p>
                  </div>

                  {/* Right: Password string + on-hover Copy button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs font-mono font-bold text-zinc-200 tracking-wider">
                      {showAllPasswords ? item.password : '••••••••'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopy(item.password, index)}
                      className="w-8 h-8 rounded-lg bg-[#262626] hover:bg-[#333333] text-white flex items-center justify-center cursor-pointer transition-all shadow-sm opacity-0 group-hover:opacity-100"
                      title="Copy Password"
                    >
                      {isCopied ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
