import React, { useState, useEffect, useRef } from 'react'
import {
  Shield,
  KeyRound,
  Play,
  CheckCircle2,
  AlertCircle,
  Check,
  Download,
  Upload,
  Laptop,
  Maximize2,
  Monitor,
  ChevronsUpDown,
  X
} from 'lucide-react'
import type { Settings as SettingsType } from '../../../shared/types'
import { api } from '../lib/ipc'

interface DropdownOption<T> {
  value: T
  label: string
}

function CustomDropdown<T extends string | number>({
  value,
  options,
  onChange,
  minWidth = '220px'
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (val: T) => void
  minWidth?: string
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

  const selectedOption = options.find(o => o.value === value) || options[0]

  return (
    <div className={`relative select-none ${open ? 'z-50' : 'z-10'}`} ref={dropdownRef} style={{ minWidth }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: '16px', paddingRight: '14px', paddingTop: '10px', paddingBottom: '10px' }}
        className={`w-full bg-[#181818] border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
          open ? 'border-white' : 'border-[#262626] hover:border-[#383838]'
        }`}
      >
        <span className="text-xs font-bold text-white truncate mr-2">
          {selectedOption ? selectedOption.label : ''}
        </span>
        <ChevronsUpDown size={15} className="text-zinc-400 shrink-0" />
      </button>

      {/* Dropdown Menu Popup */}
      {open && (
        <div
          style={{ padding: '8px', minWidth: '100%' }}
          className="absolute right-0 top-full mt-2 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col space-y-1"
        >
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={{ paddingLeft: '14px', paddingRight: '14px', paddingTop: '10px', paddingBottom: '10px' }}
                className={`w-full flex items-center justify-between text-xs rounded-xl transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-[#222222] text-white font-bold border border-[#2e2e2e]'
                    : 'text-zinc-300 hover:bg-[#1e1e1e] hover:text-white font-medium'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} className="text-white shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
        background: checked ? '#ffffff' : '#1c1c1c',
        border: checked ? '1px solid #ffffff' : '1px solid #2e2e2e',
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
          background: checked ? '#000000' : '#777777',
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

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [_riotState, setRiotState] = useState<any>(null)

  // Master password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwChanging, setPwChanging] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await api.settings.get()
      if (res.status === 'ok' && res.data) {
        const loginRes = await api.app.getLoginItemSettings()
        if (loginRes.status === 'ok' && loginRes.data) {
          setSettings({ ...res.data, startWithWindows: loginRes.data.openAtLogin })
        } else {
          setSettings(res.data)
        }
      }
      const riotRes = await api.riot.getState()
      if (riotRes.status === 'ok') setRiotState(riotRes.data)
    }
    load()

    const unbind = api.riot.onStateChanged((state: any) => {
      setRiotState(state)
    })
    return () => unbind()
  }, [])

  const updateSetting = async <K extends keyof SettingsType>(k: K, v: SettingsType[K]) => {
    if (!settings) return
    const updated = { ...settings, [k]: v }
    setSettings(updated)
    await api.settings.set(updated)
    if (k === 'startWithWindows') {
      await api.app.setLoginItemSettings(v as boolean)
    } else if (k === 'zoomFactor') {
      await api.app.setZoomFactor(v as number)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (!oldPassword) {
      setPwError('Please enter current master password')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    setPwChanging(true)
    try {
      const res = await api.vault.changeMasterPassword(oldPassword, newPassword)
      if (res.status === 'ok') {
        setPwSuccess(true)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setPwSuccess(false)
          setShowPasswordModal(false)
        }, 1500)
      } else {
        setPwError(res.error || 'Failed to update master password')
      }
    } catch (e: any) {
      setPwError(e.message)
    } finally {
      setPwChanging(false)
    }
  }

  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  // ── CSV helpers ──────────────────────────────────────────────────────────────
  function escapeCSV(val: string | null | undefined): string {
    const s = String(val ?? '')
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  function parseCSVRow(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') { inQuote = false }
        else { cur += ch }
      } else {
        if (ch === '"') { inQuote = true }
        else if (ch === ',') { result.push(cur); cur = '' }
        else { cur += ch }
      }
    }
    result.push(cur)
    return result
  }

  const handleExportCSV = async () => {
    try {
      const [accRes, folRes] = await Promise.all([
        api.vault.getAccounts(),
        api.vault.getFolders()
      ])
      if (accRes.status !== 'ok' || !accRes.data) return

      const accounts = accRes.data
      const folders = (folRes.status === 'ok' && folRes.data) ? folRes.data : []

      const lines: string[] = []

      // --- Section: FOLDERS ---
      lines.push('##SECTION:FOLDERS')
      lines.push('id,name,color,createdAt')
      for (const f of folders) {
        lines.push([f.id, f.name, f.color, f.createdAt].map(escapeCSV).join(','))
      }

      // --- Section: ACCOUNTS ---
      lines.push('##SECTION:ACCOUNTS')
      lines.push('id,title,summonerName,summonerTag,username,password,region,rank,role,folderId,notes,createdAt,updatedAt')
      for (const a of accounts.filter(x => !x.deletedAt)) {
        lines.push([
          a.id, a.title, a.summonerName, a.summonerTag,
          a.username, a.password, a.region, a.rank, a.role,
          a.folderId ?? '', a.notes, a.createdAt, a.updatedAt
        ].map(escapeCSV).join(','))
      }

      const csv = lines.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `umbral-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    }
  }

  const handleImportCSV = () => {
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so re-importing same file works
    e.target.value = ''

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')

      type Section = 'none' | 'folders' | 'accounts'
      let section: Section = 'none'
      let folderHeaders: string[] = []
      let accountHeaders: string[] = []

      const foldersToImport: Record<string, string>[] = []
      const accountsToImport: Record<string, string>[] = []

      for (const line of lines) {
        if (line === '##SECTION:FOLDERS') { section = 'folders'; continue }
        if (line === '##SECTION:ACCOUNTS') { section = 'accounts'; continue }

        if (section === 'folders') {
          const row = parseCSVRow(line)
          if (folderHeaders.length === 0) { folderHeaders = row; continue }
          const obj: Record<string, string> = {}
          folderHeaders.forEach((h, i) => { obj[h] = row[i] ?? '' })
          foldersToImport.push(obj)
        } else if (section === 'accounts') {
          const row = parseCSVRow(line)
          if (accountHeaders.length === 0) { accountHeaders = row; continue }
          const obj: Record<string, string> = {}
          accountHeaders.forEach((h, i) => { obj[h] = row[i] ?? '' })
          accountsToImport.push(obj)
        }
      }

      if (accountsToImport.length === 0 && foldersToImport.length === 0) {
        setImportStatus('error')
        setImportMessage('Invalid file - no data found.')
        setTimeout(() => setImportStatus('idle'), 3500)
        return
      }

      // 1) Upsert folders
      for (const f of foldersToImport) {
        await api.vault.saveFolder({
          id: f.id,
          name: f.name,
          color: f.color || '#00c0f0',
          createdAt: f.createdAt || new Date().toISOString()
        })
      }

      // 2) Upsert accounts
      for (const a of accountsToImport) {
        await api.vault.saveAccount({
          id: a.id,
          title: a.title,
          summonerName: a.summonerName,
          summonerTag: a.summonerTag,
          username: a.username,
          password: a.password,
          region: a.region,
          rank: a.rank,
          role: a.role,
          folderId: a.folderId || null,
          notes: a.notes,
          createdAt: a.createdAt || new Date().toISOString(),
          updatedAt: a.updatedAt || new Date().toISOString(),
          deletedAt: undefined
        })
      }

      setImportStatus('success')
      setImportMessage(`${accountsToImport.length} account(s) and ${foldersToImport.length} folder(s) imported.`)
      setTimeout(() => setImportStatus('idle'), 3500)
    } catch (err) {
      console.error(err)
      setImportStatus('error')
      setImportMessage('Import failed - check the file and try again.')
      setTimeout(() => setImportStatus('idle'), 3500)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full bg-[#090909]">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#090909] select-none overflow-y-auto">
      {/* Top Header with generous padding */}
      <div
        className="flex items-center justify-between border-b border-[#1e1e1e] shrink-0"
        style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '24px', paddingBottom: '20px' }}
      >
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <div className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
          <span>Umbral v1.0.1 • by</span>
          <button
            type="button"
            onClick={() => api.shell.openExternal('https://github.com/angelsarenotreal')}
            className="text-zinc-200 hover:text-white font-medium hover:underline transition-colors cursor-pointer"
            title="Open GitHub Profile"
          >
            angelsarenotreal
          </button>
        </div>
      </div>

      <div
        className="flex-1 w-full max-w-4xl mx-auto"
        style={{ paddingLeft: '48px', paddingRight: '48px', paddingTop: '32px', paddingBottom: '64px' }}
      >
        {/* Scale & Display Layout (Matches Windows Display Settings) */}
        <div>
          <h2
            className="text-sm font-bold text-white tracking-wide"
            style={{ marginBottom: '22px' }}
          >
            Scale & Layout
          </h2>

          <div className="bg-[#141414] border border-[#222222] rounded-2xl shadow-sm">
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e] last:border-b-0"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Display Scale</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Change the size of text, icons, buttons, and app elements
                </p>
              </div>
              <CustomDropdown
                value={settings.zoomFactor || 1.15}
                onChange={v => updateSetting('zoomFactor', v)}
                minWidth="230px"
                options={[
                  { value: 1, label: '100%' },
                  { value: 1.15, label: '115% (Recommended)' },
                  { value: 1.25, label: '125%' },
                  { value: 1.5, label: '150%' },
                  { value: 1.75, label: '175%' },
                  { value: 2, label: '200%' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Master Password & Security */}
        <div style={{ marginTop: '30px' }}>
          <h2
            className="text-sm font-bold text-white tracking-wide"
            style={{ marginBottom: '22px' }}
          >
            Vault Security
          </h2>

          <div className="bg-[#141414] border border-[#222222] rounded-2xl shadow-sm">
            {/* Change Master Password */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e]"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Master Password</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Used to encrypt and decrypt all your stored Riot credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                style={{ paddingLeft: '18px', paddingRight: '18px', paddingTop: '10px', paddingBottom: '10px' }}
                className="rounded-xl bg-[#1c1c1c] hover:bg-[#242424] text-xs font-bold text-white border border-[#2a2a2a] transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                Change Password
              </button>
            </div>

            {/* Stay Logged In (Auto-Unlock on Startup) */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e]"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Stay Logged In</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Keep vault unlocked across app restarts and PC reboots without asking for master password
                </p>
              </div>
              <ToggleSwitch
                checked={settings.stayLoggedIn}
                onChange={async v => {
                  await api.vault.setStayLoggedIn(v)
                  updateSetting('stayLoggedIn', v)
                }}
              />
            </div>

            {/* Lock on Minimize */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e]"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Lock on Minimize</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Automatically lock the vault when the Umbral window is minimized
                </p>
              </div>
              <ToggleSwitch
                checked={settings.lockOnMinimize}
                onChange={v => updateSetting('lockOnMinimize', v)}
              />
            </div>

            {/* Inactivity Auto-Lock */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e] last:border-b-0"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Auto-Lock Timer</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Automatically lock vault after a period of user inactivity
                </p>
              </div>
              <CustomDropdown
                value={settings.lockOnInactiveMinutes ?? 0}
                onChange={v => updateSetting('lockOnInactiveMinutes', v)}
                minWidth="180px"
                options={[
                  { value: 0, label: 'Never' },
                  { value: 1, label: '1 minute' },
                  { value: 5, label: '5 minutes' },
                  { value: 15, label: '15 minutes' },
                  { value: 30, label: '30 minutes' },
                  { value: 60, label: '1 hour' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* General Preferences */}
        <div style={{ marginTop: '30px' }}>
          <h2
            className="text-sm font-bold text-white tracking-wide"
            style={{ marginBottom: '22px' }}
          >
            General Preferences
          </h2>

          <div className="bg-[#141414] border border-[#222222] rounded-2xl shadow-sm">
            {/* Start with Windows */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e] last:border-b-0"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Start with Windows</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Automatically launch Umbral in background on Windows startup
                </p>
              </div>
              <ToggleSwitch
                checked={settings.startWithWindows}
                onChange={v => updateSetting('startWithWindows', v)}
              />
            </div>
          </div>
        </div>

        {/* Riot Client & Autofill Integration */}
        <div style={{ marginTop: '30px' }}>
          <h2
            className="text-sm font-bold text-white tracking-wide"
            style={{ marginBottom: '22px' }}
          >
            Autofill & Riot Client
          </h2>

          <div className="bg-[#141414] border border-[#222222] rounded-2xl shadow-sm">
            {/* Enable Floating Overlay */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e] last:border-b-0"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div>
                <p className="text-xs font-bold text-white">Enable Floating Overlay</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Automatically show account selector when Riot Client login screen is focused
                </p>
              </div>
              <ToggleSwitch
                checked={settings.overlayEnabled}
                onChange={v => updateSetting('overlayEnabled', v)}
              />
            </div>
          </div>
        </div>

        {/* Vault Data */}
        <div style={{ marginTop: '30px' }}>
          <h2
            className="text-sm font-bold text-white tracking-wide"
            style={{ marginBottom: '22px' }}
          >
            Vault Data
          </h2>

          <div className="bg-[#141414] border border-[#222222] rounded-2xl shadow-sm">
            {/* Export CSV */}
            <div
              className="flex items-center justify-between border-b border-[#1e1e1e]"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-bold text-white">Export Vault CSV</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Save all your accounts and folders as a .csv file to transfer to another PC
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
                className="w-24 flex items-center justify-center gap-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] text-xs font-bold text-white border border-[#2a2a2a] transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            </div>

            {/* Import CSV */}
            <div
              className="flex items-center justify-between"
              style={{ paddingLeft: '26px', paddingRight: '26px', paddingTop: '20px', paddingBottom: '20px' }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-bold text-white">Import Vault CSV</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Import a previously exported .csv file to restore or merge your accounts
                </p>
                {importStatus !== 'idle' && (
                  <p className={`text-xs mt-2 font-semibold ${importStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {importMessage}
                  </p>
                )}
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <button
                type="button"
                onClick={handleImportCSV}
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
                className="w-24 flex items-center justify-center gap-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] text-xs font-bold text-white border border-[#2a2a2a] transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <Upload size={14} />
                <span>Import</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80 select-none animate-in fade-in"
          onClick={e => e.target === e.currentTarget && setShowPasswordModal(false)}
        >
          <div
            style={{ padding: '32px 28px 28px 28px' }}
            className="w-full max-w-md bg-[#121212] border border-[#222222] rounded-3xl shadow-2xl space-y-5 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Change Master Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Current Master Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ paddingLeft: '16px', paddingRight: '16px', height: '44px' }}
                  className="w-full bg-[#181818] border border-[#262626] rounded-xl text-xs font-bold text-white outline-none focus:border-white font-mono placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">New Master Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ paddingLeft: '16px', paddingRight: '16px', height: '44px' }}
                  className="w-full bg-[#181818] border border-[#262626] rounded-xl text-xs font-bold text-white outline-none focus:border-white font-mono placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{ paddingLeft: '16px', paddingRight: '16px', height: '44px' }}
                  className="w-full bg-[#181818] border border-[#262626] rounded-xl text-xs font-bold text-white outline-none focus:border-white font-mono placeholder:text-zinc-500"
                />
              </div>

              {pwError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-bold">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-bold">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Master password updated successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{ height: '38px', paddingLeft: '18px', paddingRight: '18px' }}
                  className="rounded-xl text-xs font-bold bg-[#222222] text-white hover:bg-[#2c2c2c] border border-[#2e2e2e] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwChanging}
                  style={{ height: '38px', paddingLeft: '22px', paddingRight: '22px' }}
                  className="rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {pwChanging ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
