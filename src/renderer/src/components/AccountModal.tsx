import React, { useState, useRef, useEffect } from 'react'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Folder as FolderIcon,
  ChevronsUpDown,
  FolderPlus
} from 'lucide-react'
import RiotIcon from './RiotIcon'
import type { Account, Folder } from '../../../shared/types'
import { api } from '../lib/ipc'

function getPasswordStrength(pwd: string): 'empty' | 'weak' | 'strong' {
  if (!pwd || !pwd.trim()) return 'empty'
  const trimmed = pwd.trim()
  if (trimmed.length < 8) return 'weak'

  let variety = 0
  if (/[A-Z]/.test(trimmed)) variety++
  if (/[a-z]/.test(trimmed)) variety++
  if (/[0-9]/.test(trimmed)) variety++
  if (/[^A-Za-z0-9]/.test(trimmed)) variety++

  if (trimmed.length >= 10 && variety >= 3) return 'strong'
  if (trimmed.length >= 12 && variety >= 2) return 'strong'
  return 'weak'
}

interface Props {
  account: Partial<Account> | null
  folders: Folder[]
  onSave: (account: Account) => void
  onClose: () => void
}

function FloatingField({
  label,
  value,
  onChange,
  type = 'text',
  prefix,
  rightElement,
  mono = false
}: {
  label: string
  value: string
  onChange: (val: string) => void
  type?: string
  prefix?: string
  rightElement?: React.ReactNode
  mono?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const isFloated = focused || (value && value.length > 0)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        paddingLeft: '20px',
        paddingRight: rightElement ? '48px' : '20px',
        height: '60px'
      }}
      className={`relative w-full bg-[#18181b] border rounded-xl transition-all cursor-text select-none ${
        focused ? 'border-zinc-400' : 'border-[#27272b] hover:border-[#35353a]'
      }`}
    >
      {/* Floating Label */}
      <label
        style={{ left: '20px' }}
        className={`pointer-events-none absolute transition-all duration-150 select-none leading-none ${
          isFloated
            ? 'top-[9px] text-[10px] font-semibold text-zinc-400 tracking-wide'
            : 'top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500'
        }`}
      >
        {label}
      </label>

      {/* Input container explicitly positioned in lower portion */}
      <div
        style={{ left: '20px', right: rightElement ? '48px' : '20px' }}
        className={`absolute flex items-center transition-all duration-150 ${
          isFloated
            ? 'bottom-[9px] h-[24px]'
            : 'top-1/2 -translate-y-1/2 h-[24px]'
        }`}
      >
        {prefix && isFloated && (
          <span className="text-sm font-bold text-zinc-400 select-none mr-1.5 leading-none">{prefix}</span>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full bg-transparent text-sm font-bold text-white outline-none select-text leading-none ${
            mono ? 'font-mono' : ''
          } ${!isFloated ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        />
      </div>

      {rightElement && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10" onClick={e => e.stopPropagation()}>
          {rightElement}
        </div>
      )}
    </div>
  )
}

function FolderDropdown({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder
}: {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onCreateFolder?: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedFolder = folders.find(f => f.id === selectedFolderId)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setIsCreating(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleCreate = async () => {
    if (!newFolderName.trim() || !onCreateFolder) return
    await onCreateFolder(newFolderName.trim())
    setNewFolderName('')
    setIsCreating(false)
  }

  return (
    <div className="relative select-none" ref={dropdownRef}>
      {/* Trigger Button (Matches screenshot media_1788030410970.png) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ height: '60px', paddingLeft: '20px', paddingRight: '20px' }}
        className={`relative w-full bg-[#18181b] border rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
          open ? 'border-zinc-400 ring-1 ring-zinc-400/20' : 'border-[#27272b] hover:border-[#35353a]'
        }`}
      >
        <div className="flex items-center gap-3.5 h-full">
          <FolderIcon
            size={20}
            className="text-[#00c0f0] fill-[#00c0f0] shrink-0"
          />
          <div className="flex flex-col justify-center h-full">
            <span
              style={{ marginBottom: '6px' }}
              className="text-[10px] font-semibold text-zinc-400 tracking-wide select-none leading-none block"
            >
              Folder
            </span>
            <span className="text-sm font-bold text-white leading-none truncate max-w-[340px] block">
              {selectedFolder ? selectedFolder.name : 'No folder'}
            </span>
          </div>
        </div>
        <ChevronsUpDown size={18} className="text-zinc-400 shrink-0" />
      </button>

      {/* Custom Dropdown Popup: Spacious with generous insets and larger scale */}
      {open && (
        <div
          style={{ padding: '12px' }}
          className="absolute left-0 right-0 top-full mt-2.5 bg-[#141417] border border-[#27272b] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-80 flex flex-col"
        >
          <div className="overflow-y-auto flex-1 space-y-1.5" style={{ padding: '4px' }}>
            {/* + New folder */}
            {isCreating ? (
              <div
                style={{ padding: '8px 14px' }}
                className="bg-[#1e1e23] border border-[#2e2e36] rounded-xl flex items-center gap-3"
              >
                <FolderPlus size={20} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  placeholder="Folder name..."
                  className="bg-transparent text-sm font-bold text-white outline-none flex-1 min-w-0 placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{ height: '34px', minWidth: '72px', paddingLeft: '18px', paddingRight: '18px' }}
                  className="text-xs font-bold bg-[#00c0f0] text-black rounded-xl hover:bg-cyan-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-md ml-2"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                style={{ padding: '10px 14px' }}
                className="w-full flex items-center gap-3.5 text-sm font-bold text-white hover:bg-[#1e1e23] rounded-xl transition-colors cursor-pointer text-left"
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <FolderIcon size={20} className="text-[#00c0f0] fill-[#00c0f0]" />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-zinc-950 pt-0.5">+</span>
                </div>
                <span>New folder</span>
              </button>
            )}

            {/* No folder */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder(null)
                setOpen(false)
              }}
              style={{ padding: '10px 14px' }}
              className={`w-full flex items-center text-sm rounded-xl transition-colors cursor-pointer text-left ${
                selectedFolderId === null
                  ? 'bg-[#242429] text-white font-bold border border-[#2f2f38]'
                  : 'text-zinc-300 hover:bg-[#1e1e23] hover:text-white font-medium'
              }`}
            >
              No folder
            </button>

            <div className="border-t border-[#27272b]" style={{ marginTop: '10px', marginBottom: '10px' }} />

            {/* List of folders */}
            {folders.map(f => {
              const isSelected = f.id === selectedFolderId
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(f.id)
                    setOpen(false)
                  }}
                  style={{ padding: '10px 14px' }}
                  className={`w-full flex items-center gap-3.5 text-sm rounded-xl transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#242429] text-white font-bold border border-[#2f2f38] shadow-sm'
                      : 'text-zinc-200 hover:bg-[#1e1e23] hover:text-white font-medium'
                  }`}
                >
                  <FolderIcon size={20} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountModal({ account, folders: initialFolders, onSave, onClose }: Props): JSX.Element {
  const isNew = !account?.id
  const [folders, setFolders] = useState<Folder[]>(initialFolders)

  // Extract Game Name and Tagline
  const initialGameName = account?.summonerName || (account?.title ? account.title.split('#')[0] : '')
  const initialTagLine = account?.summonerTag || (account?.title && account.title.includes('#') ? account.title.split('#')[1] : '')

  const [gameName, setGameName] = useState(initialGameName)
  const [tagLine, setTagLine] = useState(initialTagLine ? initialTagLine.replace(/^#/, '') : '')
  const [username, setUsername] = useState(account?.username || '')
  const [password, setPassword] = useState(account?.password || '')
  const [folderId, setFolderId] = useState<string | null>(account?.folderId || (folders[0]?.id || null))
  const [notes, setNotes] = useState(account?.notes || '')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatePassword = async () => {
    const res = await api.crypto.generatePassword({
      length: 18,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    })
    if (res.status === 'ok' && res.data) {
      setPassword(res.data)
    }
  }

  const handleCreateFolder = async (name: string) => {
    try {
      const newF: Folder = {
        id: '',
        name: name.trim(),
        color: '#00c0f0',
        createdAt: new Date().toISOString()
      }
      const res = await api.vault.saveFolder(newF)
      if (res.status === 'ok') {
        const updated = await api.vault.getFolders()
        if (updated.data) {
          setFolders(updated.data)
          const created = updated.data.find(f => f.name === name.trim())
          if (created) setFolderId(created.id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const cleanTag = tagLine.trim().replace(/^#/, '')
      const cleanName = gameName.trim()
      const formattedTitle = cleanName
        ? (cleanTag ? `${cleanName}#${cleanTag}` : cleanName)
        : username.trim()

      const full: Account = {
        id: account?.id || '',
        title: formattedTitle,
        summonerName: cleanName,
        summonerTag: cleanTag,
        username: username.trim(),
        password: password.trim(),
        region: account?.region || 'EUW',
        rank: account?.rank || '',
        role: account?.role || 'MAIN',
        folderId: folderId || null,
        notes: notes.trim(),
        lastUsedAt: account?.lastUsedAt,
        createdAt: account?.createdAt || now,
        updatedAt: now,
      }
      await onSave(full)
    } catch (err: any) {
      setError(err.message || 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 select-none backdrop-blur-md bg-black/75 overflow-y-auto animate-in fade-in duration-150"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Outer Card with rounded corners and strict overflow-hidden clipping */}
      <div
        className="w-full max-w-xl rounded-3xl shadow-2xl bg-[#111113] border border-[#222226] my-8 overflow-hidden max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Inner Scrollable Container with comfortable insets */}
        <div
          className="overflow-y-auto flex-1"
          style={{ padding: '36px 36px 36px 36px' }}
        >
          <form onSubmit={handleSave} className="space-y-6">
            {/* Center Riot Fist Icon */}
            <div className="flex justify-center pb-2">
              <div className="w-18 h-18 rounded-2xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shadow-xl">
                <RiotIcon size={38} />
              </div>
            </div>

            {/* Game Name & Tagline Floating Inputs */}
            <div className="flex items-center gap-3" style={{ marginTop: '16px' }}>
              {/* Game Name */}
              <div className="flex-1">
                <FloatingField
                  label="Game Name"
                  value={gameName}
                  onChange={setGameName}
                />
              </div>

              {/* Tagline with # prefix */}
              <div className="w-40">
                <FloatingField
                  label="Tagline"
                  value={tagLine}
                  onChange={val => setTagLine(val.replace(/^#/, ''))}
                  prefix="#"
                />
              </div>
            </div>

            {/* Login Details Section with generous spacing */}
            <div style={{ marginTop: '26px' }}>
              <h3 className="text-sm font-bold text-white pl-1 tracking-wide" style={{ marginBottom: '14px' }}>
                Login Details
              </h3>

              {/* Username */}
              <div style={{ marginTop: '12px' }}>
                <FloatingField
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  mono
                />
              </div>

              {/* Password */}
              <div style={{ marginTop: '14px' }}>
                <FloatingField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type={showPassword ? 'text' : 'password'}
                  mono
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer hover:bg-[#222227]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                {/* Password Strength & Generator */}
                <div className="flex items-center justify-between pt-2 px-1 text-xs min-h-[22px]">
                  {(() => {
                    const strength = getPasswordStrength(password)
                    if (strength === 'strong') {
                      return (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                          <span>Strong Password</span>
                        </div>
                      )
                    }
                    if (strength === 'weak') {
                      return (
                        <div className="flex items-center gap-1.5 font-semibold text-red-400">
                          <AlertCircle size={15} className="shrink-0 text-red-400" />
                          <span>Weak Password</span>
                        </div>
                      )
                    }
                    return <div />
                  })()}

                  <button
                    type="button"
                    onClick={generatePassword}
                    className="font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer ml-auto text-xs"
                  >
                    Generate Password
                  </button>
                </div>
              </div>
            </div>

            {/* Other Section (Folder & Note) */}
            <div style={{ marginTop: '16px' }}>
              <h3 className="text-sm font-bold text-white pl-1 tracking-wide" style={{ marginBottom: '12px' }}>
                Other
              </h3>

              {/* Custom Folder Dropdown (Matches Screenshot media_1788030410970.png) */}
              <div style={{ marginTop: '12px' }}>
                <FolderDropdown
                  folders={folders}
                  selectedFolderId={folderId}
                  onSelectFolder={setFolderId}
                  onCreateFolder={handleCreateFolder}
                />
              </div>

              {/* Note (Resizable with Corner Grip & No Placeholder) */}
              <div style={{ marginTop: '14px' }}>
                <div
                  style={{
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    minHeight: '96px',
                    resize: 'vertical',
                    overflow: 'hidden'
                  }}
                  className="relative w-full bg-[#18181b] border border-[#27272b] focus-within:border-zinc-400 rounded-xl transition-colors flex flex-col group select-none"
                >
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1 select-none pointer-events-none">
                    Note
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-transparent text-sm font-medium text-white outline-none flex-1 resize-none font-sans leading-relaxed select-text"
                  />
                  {/* Diagonal resize corner grip */}
                  <div className="absolute right-1.5 bottom-1.5 pointer-events-none text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 2L2 10M10 6L6 10M10 10L9 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Action Buttons Footer: Wide, spacious, comfortable buttons */}
            <div
              className="flex items-center gap-4 border-t border-[#1c1c1f]"
              style={{ paddingTop: '28px', marginTop: '36px' }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{ minWidth: '140px', height: '46px', paddingLeft: '28px', paddingRight: '28px' }}
                className="rounded-xl text-sm font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ minWidth: '120px', height: '46px', paddingLeft: '24px', paddingRight: '24px' }}
                className="rounded-xl text-sm font-semibold bg-[#222226] text-white hover:bg-[#2c2c32] border border-[#2b2b31] transition-all cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
