import React, { useState, useRef, useEffect } from 'react'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Folder as FolderIcon,
  ChevronsUpDown,
  FolderPlus,
  ArrowLeft,
  X
} from 'lucide-react'
import RiotIcon from './RiotIcon'
import type { Account, Folder } from '../../../shared/types'
import { api } from '../lib/ipc'

interface Props {
  account: Partial<Account>
  folders: Folder[]
  onSave: (account: Account) => Promise<void> | void
  onCancel: () => void
}

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
      className={`relative w-full bg-[#141414] border rounded-xl transition-all cursor-text select-none ${
        focused ? 'border-white' : 'border-[#242424] hover:border-[#333333]'
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

      {/* Input container */}
      <div
        style={{ left: '20px', right: rightElement ? '48px' : '20px' }}
        className={`absolute flex items-center transition-all duration-150 ${
          isFloated ? 'bottom-[9px] h-[24px]' : 'top-1/2 -translate-y-1/2 h-[24px]'
        }`}
      >
        {prefix && isFloated && (
          <span className="text-sm font-bold text-zinc-400 select-none mr-1.5 leading-none">
            {prefix}
          </span>
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
        <div
          className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10"
          onClick={e => e.stopPropagation()}
        >
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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ height: '60px', paddingLeft: '20px', paddingRight: '20px' }}
        className={`relative w-full bg-[#141414] border rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
          open ? 'border-white ring-1 ring-white/20' : 'border-[#242424] hover:border-[#333333]'
        }`}
      >
        <div className="flex items-center gap-3.5 h-full min-w-0">
          <FolderIcon size={20} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
          <div className="flex flex-col justify-center h-full min-w-0">
            <span
              style={{ marginBottom: '5px' }}
              className="text-[10px] font-semibold text-zinc-400 tracking-wide select-none leading-none block"
            >
              Folder
            </span>
            <span className="text-sm font-bold text-white leading-none truncate block">
              {selectedFolder ? selectedFolder.name : 'No folder'}
            </span>
          </div>
        </div>
        <ChevronsUpDown size={16} className="text-zinc-500 shrink-0 ml-2" />
      </button>

      {/* Floating Dropdown Menu */}
      {open && (
        <div
          style={{ padding: '8px' }}
          className="absolute left-0 right-0 top-full mt-2 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 max-h-72 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header Action: Add Folder */}
          <div className="shrink-0 mb-2">
            {isCreating ? (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  style={{ height: '36px', paddingLeft: '12px', paddingRight: '12px' }}
                  className="flex-1 bg-[#1a1a1a] border border-[#333333] focus:border-white text-xs font-semibold text-white rounded-xl outline-none select-text"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{ height: '36px', paddingLeft: '14px', paddingRight: '14px' }}
                  className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                style={{ padding: '10px 12px' }}
                className="w-full flex items-center gap-2.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-[#202020] rounded-xl transition-colors cursor-pointer text-left"
              >
                <FolderPlus size={16} className="text-zinc-400" />
                <span>New Folder...</span>
              </button>
            )}
          </div>

          <div className="h-[1px] bg-[#222222] my-1 shrink-0" />

          {/* Folder Options List */}
          <div className="overflow-y-auto max-h-48 space-y-1">
            {/* No Folder / Default option */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder(null)
                setOpen(false)
              }}
              style={{ padding: '9px 12px' }}
              className={`w-full flex items-center gap-3 text-sm rounded-xl transition-colors cursor-pointer text-left ${
                selectedFolderId === null
                  ? 'bg-[#222222] text-white font-bold border border-[#2a2a2a] shadow-sm'
                  : 'text-zinc-400 hover:bg-[#1f1f1f] hover:text-white font-medium'
              }`}
            >
              <div className="w-[18px] h-[18px] rounded border border-dashed border-zinc-600 flex items-center justify-center shrink-0" />
              <span className="truncate">No folder</span>
            </button>

            {folders.map(f => {
              const isSelected = selectedFolderId === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(f.id)
                    setOpen(false)
                  }}
                  style={{ padding: '9px 12px' }}
                  className={`w-full flex items-center gap-3 text-sm rounded-xl transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#222222] text-white font-bold border border-[#2a2a2a] shadow-sm'
                      : 'text-zinc-300 hover:bg-[#1f1f1f] hover:text-white font-medium'
                  }`}
                >
                  <FolderIcon size={18} className="text-[#00c0f0] fill-[#00c0f0] shrink-0" />
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

const REGION_OPTIONS = [
  { id: 'EUW', label: 'EUW', name: 'Europe West' },
  { id: 'NA', label: 'NA', name: 'North America' },
  { id: 'EUNE', label: 'EUNE', name: 'Europe Nordic & East' },
  { id: 'KR', label: 'KR', name: 'Korea' },
  { id: 'BR', label: 'BR', name: 'Brazil' },
  { id: 'LAN', label: 'LAN', name: 'Latin America North' },
  { id: 'LAS', label: 'LAS', name: 'Latin America South' },
  { id: 'OCE', label: 'OCE', name: 'Oceania' },
  { id: 'TR', label: 'TR', name: 'Turkey' },
  { id: 'RU', label: 'RU', name: 'Russia' },
  { id: 'JP', label: 'JP', name: 'Japan' },
  { id: 'ME', label: 'ME', name: 'Middle East' },
  { id: 'SG', label: 'SG', name: 'Singapore' },
  { id: 'TW', label: 'TW', name: 'Taiwan' },
  { id: 'VN', label: 'VN', name: 'Vietnam' },
  { id: 'TH', label: 'TH', name: 'Thailand' },
  { id: 'PBE', label: 'PBE', name: 'Public Beta Environment' }
]

function RegionDropdown({
  selectedRegion,
  onSelectRegion
}: {
  selectedRegion: string
  onSelectRegion: (reg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const current =
    REGION_OPTIONS.find((r) => r.id.toLowerCase() === (selectedRegion || 'euw').toLowerCase()) ||
    REGION_OPTIONS[0]

  return (
    <div className="relative select-none" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ height: '60px', paddingLeft: '14px', paddingRight: '12px' }}
        className={`relative w-full bg-[#141414] border rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
          open ? 'border-white ring-1 ring-white/20' : 'border-[#242424] hover:border-[#333333]'
        }`}
      >
        <div className="flex flex-col justify-center h-full min-w-0">
          <span
            style={{ marginBottom: '5px' }}
            className="text-[10px] font-semibold text-zinc-400 tracking-wide select-none leading-none block"
          >
            Region
          </span>
          <span className="text-sm font-bold text-white leading-none truncate block">
            {current.id}
          </span>
        </div>
        <ChevronsUpDown size={14} className="text-zinc-500 shrink-0 ml-1" />
      </button>

      {open && (
        <div
          style={{ padding: '6px', maxHeight: '220px', width: '220px' }}
          className="absolute right-0 top-full mt-2 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95"
        >
          {REGION_OPTIONS.map((r) => {
            const isSelected = r.id.toLowerCase() === (selectedRegion || 'euw').toLowerCase()
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelectRegion(r.id)
                  setOpen(false)
                }}
                style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                className={`w-full flex items-center justify-between gap-3 text-xs font-bold rounded-xl transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-300 hover:bg-[#202020] hover:text-white'
                }`}
              >
                <span className="shrink-0">{r.id}</span>
                <span
                  className={`text-[11px] font-normal text-right whitespace-nowrap ${
                    isSelected ? 'text-zinc-700' : 'text-zinc-500'
                  }`}
                >
                  {r.name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AccountEditView({
  account,
  folders: initialFolders,
  onSave,
  onCancel
}: Props): JSX.Element {
  const isNew = !account?.id
  const [folders, setFolders] = useState<Folder[]>(initialFolders)

  // Extract Game Name & Tagline (Matches original layout)
  const initialGameName = account?.summonerName || (account?.title ? account.title.split('#')[0] : '')
  const initialTagLine = account?.summonerTag || (account?.title && account.title.includes('#') ? account.title.split('#')[1] : '')

  const [gameName, setGameName] = useState(initialGameName)
  const [tagLine, setTagLine] = useState(initialTagLine ? initialTagLine.replace(/^#/, '') : '')
  const [region, setRegion] = useState(account?.region || 'EUW')
  const [username, setUsername] = useState(account?.username || '')
  const [password, setPassword] = useState(account?.password || '')
  const [folderId, setFolderId] = useState<string | null>(account?.folderId || null)
  const [notes, setNotes] = useState(account?.notes || '')
  const [iconId] = useState<number | undefined>(account?.iconId)
  const [iconUrl] = useState<string | undefined>(account?.iconUrl)
  const [iconImgError, setIconImgError] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    setError(msg)
    errorTimerRef.current = setTimeout(() => {
      setError(null)
    }, 4000)
  }

  const currentIconSrc =
    iconUrl ||
    (iconId
      ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`
      : 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/7.jpg')

  useEffect(() => {
    setFolders(initialFolders)
  }, [initialFolders])

  const handleGeneratePassword = async () => {
    const res = await api.crypto.generatePassword({
      length: 18,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    })
    if (res.data) setPassword(res.data)
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

  const handleSave = async () => {
    if (!username.trim()) {
      showError('Username is required')
      return
    }
    if (!password) {
      showError('Password is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const cleanName = gameName.trim()
      const cleanTag = tagLine.replace(/^#/, '').trim()
      const formattedTitle = cleanName
        ? `${cleanName}${cleanTag ? `#${cleanTag}` : ''}`
        : username.trim()

      const updatedAccount: Account = {
        id: account.id || '',
        title: formattedTitle,
        summonerName: cleanName,
        summonerTag: cleanTag,
        username: username.trim(),
        password: password.trim(),
        region: region || 'EUW',
        rank: account.rank || 'Unranked',
        iconId,
        iconUrl,
        rankLp: account.rankLp || '',
        role: account.role || 'Fill',
        folderId,
        notes: notes.trim(),
        createdAt: account.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await onSave(updatedAccount)
    } catch (err: any) {
      showError(err.message || 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090909] select-none overflow-y-auto relative">
      {/* Floating Error Toast Notification Popup */}
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto select-none">
          <div
            style={{ padding: '12px 20px', gap: '10px' }}
            className="flex items-center bg-[#18181c] border border-red-500/50 text-red-400 rounded-2xl shadow-2xl backdrop-blur-xl text-xs font-bold"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 text-zinc-500 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Top Header / Action Bar */}
      <div
        className="sticky top-0 z-30 bg-[#090909]/95 backdrop-blur-md flex items-center justify-between border-b border-[#1e1e1e] shrink-0"
        style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '20px', paddingBottom: '20px' }}
      >
        {/* Cancel / Back Button */}
        <button
          type="button"
          onClick={onCancel}
          style={{ paddingLeft: '20px', paddingRight: '22px', height: '40px' }}
          className="flex items-center gap-2.5 rounded-xl text-xs font-bold bg-[#181818] text-white hover:bg-[#222222] border border-[#2a2a2a] transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft size={14} />
          <span>Cancel</span>
        </button>

        {/* Center Title */}
        <h1 className="text-sm font-bold text-white tracking-wide">
          {isNew ? 'New Item' : 'Edit Item'}
        </h1>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ paddingLeft: '28px', paddingRight: '28px', height: '40px', minWidth: '88px' }}
          className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Full Page Body */}
      <div
        className="flex-1 flex flex-col items-center justify-start w-full"
        style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '28px', paddingBottom: '60px' }}
      >
        <div className="w-full max-w-md">
          {/* Centered Summoner Avatar Icon */}
          <div className="flex justify-center select-none" style={{ marginBottom: '22px' }}>
            <div className="w-16 h-16 rounded-2xl bg-[#000000] border border-[#1e1e1e] flex items-center justify-center text-white shadow-xl shrink-0 overflow-hidden relative">
              <img
                src={currentIconSrc}
                alt="Summoner Icon"
                className="w-full h-full object-cover"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/7.jpg'
                }}
              />
            </div>
          </div>

          {/* Riot Identity Row: Game Name + Tagline + Region */}
          <div className="flex items-center gap-2.5" style={{ marginBottom: '22px' }}>
            {/* Game Name */}
            <div className="flex-1 min-w-0">
              <FloatingField
                label="Game Name"
                value={gameName}
                onChange={setGameName}
              />
            </div>

            {/* Tagline with # prefix */}
            <div className="w-24 shrink-0">
              <FloatingField
                label="Tag"
                value={tagLine}
                onChange={(val) => setTagLine(val.replace(/^#/, ''))}
                prefix="#"
              />
            </div>

            {/* Region Selector */}
            <div className="w-24 shrink-0">
              <RegionDropdown
                selectedRegion={region}
                onSelectRegion={setRegion}
              />
            </div>
          </div>

          {/* Section: Login Details */}
          <div style={{ marginBottom: '22px' }}>
            <h2
              style={{ marginBottom: '14px' }}
              className="text-sm font-bold text-white tracking-wide select-none"
            >
              Login Details
            </h2>

            <div>
              {/* Username Field */}
              <div style={{ marginBottom: '10px' }}>
                <FloatingField
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  mono
                />
              </div>

              {/* Password Field */}
              <div>
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
                      className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-[#222222]"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </div>

              {/* Below Password: Left Strong/Weak Password Badge | Right Generate Password text */}
              <div
                style={{ paddingTop: '10px', paddingBottom: '4px', paddingLeft: '4px', paddingRight: '4px' }}
                className="flex items-center justify-between select-none min-h-[24px]"
              >
                {(() => {
                  const strength = getPasswordStrength(password)
                  if (strength === 'strong') {
                    return (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                        <span>Strong Password</span>
                      </div>
                    )
                  }
                  if (strength === 'weak') {
                    return (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <AlertCircle size={15} className="shrink-0 text-red-400" />
                        <span>Weak Password</span>
                      </div>
                    )
                  }
                  return <div />
                })()}

                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer ml-auto"
                >
                  Generate Password
                </button>
              </div>
            </div>
          </div>

          {/* Section: Other (Folder & Note) */}
          <div>
            <h2
              style={{ marginBottom: '14px' }}
              className="text-sm font-bold text-white tracking-wide select-none"
            >
              Other
            </h2>

            <div>
              {/* Folder Dropdown */}
              <div style={{ marginBottom: '10px' }}>
                <FolderDropdown
                  folders={folders}
                  selectedFolderId={folderId}
                  onSelectFolder={setFolderId}
                  onCreateFolder={handleCreateFolder}
                />
              </div>

              {/* Note Multiline Box (Resizable with Corner Grip) */}
              <div
                style={{
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  paddingTop: '12px',
                  paddingBottom: '12px',
                  minHeight: '100px',
                  resize: 'vertical',
                  overflow: 'hidden'
                }}
                className="relative w-full bg-[#141414] border border-[#242424] hover:border-[#333333] focus-within:!border-white rounded-xl transition-colors flex flex-col group select-none"
              >
                <label
                  style={{ marginBottom: '6px' }}
                  className="block text-[10px] font-semibold text-zinc-400 tracking-wide select-none leading-none pointer-events-none"
                >
                  Note
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  style={{ padding: 0 }}
                  className="w-full bg-transparent text-xs font-medium text-white outline-none flex-1 resize-none font-sans leading-relaxed select-text placeholder:text-zinc-600"
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
        </div>
      </div>
    </div>
  )
}
