import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  RotateCcw,
  Copy,
  Plus,
  Check,
  CheckCircle2,
  History,
  X,
  MoreHorizontal,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { api } from '../lib/ipc'
import AccountModal from '../components/AccountModal'
import type { Account, Folder } from '../../../shared/types'

interface HistoryItem {
  id: string
  password: string
  createdAt: string
}

type Toast = { id: number; message: string }

function ToggleSwitch({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative shrink-0 cursor-pointer select-none rounded-full"
      style={{
        width: '46px',
        height: '26px',
        background: checked ? '#ffffff' : '#26262b',
        border: checked ? '1px solid #ffffff' : '1px solid #383842',
        transition: 'background-color 0.2s ease, border-color 0.2s ease'
      }}
    >
      <div
        className="absolute rounded-full flex items-center justify-center shadow-sm"
        style={{
          top: '2.5px',
          left: '2.5px',
          width: '19px',
          height: '19px',
          transform: checked ? 'translateX(19px)' : 'translateX(0px)',
          background: checked ? '#0e0e10' : '#8e8e98',
          transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease'
        }}
      >
        <Check
          size={11}
          strokeWidth={3.5}
          className="text-white transition-opacity duration-150"
          style={{ opacity: checked ? 1 : 0 }}
        />
      </div>
    </button>
  )
}

export default function PasswordGenerator(): JSX.Element {
  const [genType, setGenType] = useState<'characters' | 'words'>('characters')
  const [length, setLength] = useState(20)
  const [useUppercase, setUseUppercase] = useState(true)
  const [useDigits, setUseDigits] = useState(true)
  const [useSymbols, setUseSymbols] = useState(true)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  // History Drawer State
  const [showHistory, setShowHistory] = useState(false)
  const [showAllPasswords, setShowAllPasswords] = useState(false)
  const [showHistoryMenu, setShowHistoryMenu] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('umbral_pw_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([])

  // Add to vault modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])

  const historyMenuRef = useRef<HTMLDivElement>(null)

  const toast = (message: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500)
  }

  // Save history to localStorage
  const saveToHistory = useCallback((pw: string) => {
    if (!pw) return
    setHistory(prev => {
      // Don't add duplicate of most recent item
      if (prev.length > 0 && prev[0].password === pw) return prev
      const newItem: HistoryItem = {
        id: String(Date.now()),
        password: pw,
        createdAt: new Date().toISOString()
      }
      const updated = [newItem, ...prev.slice(0, 49)]
      try {
        localStorage.setItem('umbral_pw_history', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem('umbral_pw_history')
    } catch {}
    setShowHistoryMenu(false)
    toast('History cleared')
  }

  // Close history menu when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) {
        setShowHistoryMenu(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      if (genType === 'words') {
        const words = [
          'shadow', 'blade', 'phantom', 'umbral', 'radiant', 'vortex', 'cipher', 'nexus',
          'eclipse', 'valkyrie', 'dragon', 'titan', 'spirit', 'frost', 'abyss', 'striker',
          'horizon', 'pulsar', 'spectre', 'solaris', 'stellar', 'chronos', 'aurora'
        ]
        const picked: string[] = []
        for (let i = 0; i < Math.max(3, Math.floor(length / 5)); i++) {
          picked.push(words[Math.floor(Math.random() * words.length)])
        }
        const pw = picked.join('-') + (useDigits ? Math.floor(Math.random() * 90 + 10) : '')
        setPassword(pw)
      } else {
        const res = await api.crypto.generatePassword({
          length,
          uppercase: useUppercase,
          lowercase: true,
          numbers: useDigits,
          symbols: useSymbols
        })
        if (res.status === 'ok' && typeof res.data === 'string') {
          setPassword(res.data)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [genType, length, useUppercase, useDigits, useSymbols])

  useEffect(() => {
    generate()
  }, [generate])

  const handleCopy = async (textToCopy?: string) => {
    const target = textToCopy || password
    if (!target) return
    await api.clipboard.write(target)
    saveToHistory(target)
    setCopied(true)
    toast('Password copied')
    setTimeout(() => setCopied(false), 2000)
    setTimeout(() => api.clipboard.write(''), 30000)
  }

  const handleOpenAddModal = async () => {
    if (!password) return
    saveToHistory(password)
    try {
      const res = await api.vault.getFolders()
      if (res.status === 'ok' && res.data) {
        setFolders(res.data)
      }
    } catch {}
    setShowAddModal(true)
  }

  const handleSaveAccount = async (acc: Account) => {
    const res = await api.vault.saveAccount(acc)
    if (res.status === 'ok') {
      setShowAddModal(false)
      toast('Account saved to vault')
    } else {
      toast(res.error || 'Failed to save')
    }
  }

  const formatRelative = (iso: string) => {
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="flex h-full w-full bg-[#090909] select-none overflow-hidden">
      {/* Main Spacious Password Generator Section */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#090909] overflow-y-auto">
        {/* Top Header Row with Centered Title & History Icon Button */}
        <div
          className="relative shrink-0 flex items-center justify-between border-b border-[#1e1e1e]"
          style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '20px', paddingBottom: '20px' }}
        >
          <div className="w-10" />

          {/* Centered Title */}
          <h1 className="text-base font-bold text-white tracking-tight">
            Password Generator
          </h1>

          {/* History Button (Matches Screenshot media_1788031519040.png) */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              showHistory
                ? 'bg-[#222222] text-white border border-[#303030] shadow-sm'
                : 'text-zinc-400 hover:text-white bg-[#181818] border border-[#262626] hover:bg-[#222222]'
            }`}
            title="History"
          >
            <History size={17} />
          </button>
        </div>

        {/* Spacious Main Generator Workspace (Matches Reference Screenshot media_1788031503743.png) */}
        <div
          className="flex-1 flex flex-col justify-start"
          style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '48px', paddingBottom: '64px' }}
        >
          <div className="w-full max-w-4xl space-y-8 mx-auto">
            {/* Big Password Display Section */}
            <div className="space-y-6">
              {/* Generated Password Text */}
              <div className="select-all">
                <span className="font-mono text-3xl font-bold tracking-wider text-white break-all leading-relaxed">
                  {password || 'Generating...'}
                </span>
              </div>

              {/* Status Bar & Quick Actions */}
              <div className="flex items-center justify-between pt-2">
                {/* Status Indicator */}
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Strong Password</span>
                </div>

                {/* 3 Action Buttons: Regenerate, Copy, Add */}
                <div className="flex items-center gap-3">
                  {/* Regenerate */}
                  <button
                    type="button"
                    onClick={generate}
                    className="p-2 rounded-lg text-white hover:bg-[#1c1c1c] transition-colors cursor-pointer"
                    title="Regenerate"
                  >
                    <RotateCcw size={17} className={loading ? 'animate-spin' : ''} />
                  </button>

                  {/* Copy */}
                  <button
                    type="button"
                    onClick={() => handleCopy()}
                    className="p-2 rounded-lg text-white hover:bg-[#1c1c1c] transition-colors cursor-pointer"
                    title="Copy Password"
                  >
                    {copied ? <Check size={17} className="text-emerald-400" /> : <Copy size={17} />}
                  </button>

                  {/* Add to Vault */}
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="p-2 rounded-lg text-white hover:bg-[#1c1c1c] transition-colors cursor-pointer"
                    title="Add to Vault"
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
            </div>

            {/* Top Separator Divider */}
            <div className="border-t border-[#1e1e1e]" style={{ marginTop: '32px', marginBottom: '4px' }} />

            {/* Full-Width Settings Rows with 26px padding above and below each line */}
            <div className="text-[13.5px] font-semibold text-white">
              {/* Row 1: Type (Characters vs Words) */}
              <div
                style={{ paddingTop: '26px', paddingBottom: '26px' }}
                className="flex items-center justify-between border-b border-[#1e1e1e]"
              >
                <span>Type</span>
                <div className="flex items-center gap-8">
                  {/* Characters Radio */}
                  <label
                    onClick={() => setGenType('characters')}
                    className="flex items-center gap-2.5 cursor-pointer text-white font-medium select-none"
                  >
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: genType === 'characters' ? '#ffffff' : '#444444',
                        background: genType === 'characters' ? '#ffffff' : 'transparent'
                      }}
                    >
                      {genType === 'characters' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0e0e10]" />
                      )}
                    </div>
                    <span>Characters</span>
                  </label>

                  {/* Words Radio */}
                  <label
                    onClick={() => setGenType('words')}
                    className="flex items-center gap-2.5 cursor-pointer text-[#a1a1a1] hover:text-white font-medium select-none"
                  >
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: genType === 'words' ? '#ffffff' : '#444444',
                        background: genType === 'words' ? '#ffffff' : 'transparent'
                      }}
                    >
                      {genType === 'words' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0e0e10]" />
                      )}
                    </div>
                    <span>Words</span>
                  </label>
                </div>
              </div>

              {/* Row 2: Length Slider */}
              <div
                style={{ paddingTop: '26px', paddingBottom: '26px' }}
                className="flex items-center justify-between border-b border-[#1e1e1e]"
              >
                <span>Length</span>
                <div className="flex items-center gap-5 w-80">
                  <input
                    type="range"
                    min={8}
                    max={64}
                    value={length}
                    onChange={e => setLength(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer outline-none"
                    style={{ accentColor: '#ffffff' }}
                  />
                  <span className="w-6 text-right font-mono font-bold text-white text-sm">
                    {length}
                  </span>
                </div>
              </div>

              {/* Row 3: Use capital letters (A-Z) */}
              <div
                style={{ paddingTop: '26px', paddingBottom: '26px' }}
                className="flex items-center justify-between border-b border-[#1e1e1e]"
              >
                <span>Use capital letters (A-Z)</span>
                <ToggleSwitch checked={useUppercase} onChange={setUseUppercase} />
              </div>

              {/* Row 4: Use digits (0-9) */}
              <div
                style={{ paddingTop: '26px', paddingBottom: '26px' }}
                className="flex items-center justify-between border-b border-[#1e1e1e]"
              >
                <span>Use digits (0-9)</span>
                <ToggleSwitch checked={useDigits} onChange={setUseDigits} />
              </div>

              {/* Row 5: Use symbols (@!$%&*+) */}
              <div
                style={{ paddingTop: '26px', paddingBottom: '26px' }}
                className="flex items-center justify-between border-b border-[#1e1e1e]"
              >
                <span>Use symbols (@!$%&*+)</span>
                <ToggleSwitch checked={useSymbols} onChange={setUseSymbols} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right History Sidebar Drawer (Matches Screenshots media_1788031534994.png & media_1788031547754.png) */}
      {showHistory && (
        <aside
          className="w-[360px] shrink-0 bg-[#121212] border-l border-[#222222] flex flex-col h-full select-none animate-in slide-in-from-right duration-150 z-30"
        >
          {/* History Top Action Bar */}
          <div
            className="flex items-center justify-between border-b border-[#222222]"
            style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '16px', paddingBottom: '16px' }}
          >
            {/* Close Button ✕ */}
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1c1c1c] transition-colors cursor-pointer"
              title="Close History"
            >
              <X size={18} />
            </button>
            <h2 className="text-sm font-bold text-white tracking-wide">History</h2>

            {/* 3-Dots More Options Menu */}
            <div className="relative" ref={historyMenuRef}>
              <button
                type="button"
                onClick={() => setShowHistoryMenu(!showHistoryMenu)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f25] transition-colors cursor-pointer"
                title="Options"
              >
                <MoreHorizontal size={18} />
              </button>

              {/* History Context Menu (Matches Screenshot media_1788031547754.png) */}
              {showHistoryMenu && (
                <div
                  style={{ minWidth: '220px', padding: '10px' }}
                  className="absolute right-0 top-full mt-2 bg-[#181818] border border-[#262626] rounded-2xl shadow-2xl z-50 animate-in fade-in space-y-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllPasswords(!showAllPasswords)
                      setShowHistoryMenu(false)
                    }}
                    style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px' }}
                    className="w-full flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white hover:bg-[#222222] rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <span>{showAllPasswords ? 'Hide Passwords' : 'Show All Passwords'}</span>
                    {showAllPasswords ? <EyeOff size={15} className="ml-3 shrink-0" /> : <Eye size={15} className="ml-3 shrink-0" />}
                  </button>

                  <div className="border-t border-[#262626]" style={{ margin: '6px 4px' }} />

                  <button
                    type="button"
                    onClick={clearHistory}
                    style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px' }}
                    className="w-full flex items-center justify-between text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <span>Clear History</span>
                    <Trash2 size={15} className="ml-3 shrink-0" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* History Body: Empty State or Passwords List */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {history.length === 0 ? (
              /* Empty State (Matches Screenshot media_1788031534994.png) */
              <div
                className="flex-1 flex flex-col items-center justify-center text-center"
                style={{ paddingLeft: '32px', paddingRight: '32px' }}
              >
                {/* Lime/Yellow-Green Rounded Square Icon Box */}
                <div className="w-16 h-16 rounded-2xl bg-[#d9f99d] flex items-center justify-center text-zinc-950 shadow-xl mb-4">
                  <History size={30} strokeWidth={2.2} />
                </div>

                <h3 className="text-base font-bold text-white mb-1.5">
                  No history to show
                </h3>

                <p className="text-xs text-zinc-400 max-w-[220px] leading-relaxed">
                  Generated passwords will appear here once you copy or save them
                </p>
              </div>
            ) : (
              /* Populated History List */
              <div
                className="space-y-3"
                style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '20px', paddingBottom: '24px' }}
              >
                {history.map(item => (
                  <div
                    key={item.id}
                    className="group bg-[#161616] border border-[#222222] hover:border-[#303030] rounded-2xl transition-all"
                    style={{ padding: '14px 16px' }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="font-mono text-xs font-bold text-white break-all select-all flex-1">
                        {showAllPasswords ? item.password : '••••••••••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.password)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer shrink-0"
                        title="Copy Password"
                      >
                        <Copy size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                      <span>{formatRelative(item.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPassword(item.password)
                          toast('Loaded into generator')
                        }}
                        className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Account Modal for Adding to Vault */}
      {showAddModal && (
        <AccountModal
          account={{ password }}
          folders={folders}
          onSave={handleSaveAccount}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Floating Toast Notifications */}
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
