import React, { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, Lock, ArrowRight, Check } from 'lucide-react'
import { api } from '../lib/ipc'

interface Props {
  mode: 'setup' | 'unlock'
  onUnlocked: () => void
}

export default function UnlockScreen({ mode, onUnlocked }: Props): JSX.Element {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    async function loadSettings() {
      try {
        const res = await api.settings.get()
        if (res.status === 'ok' && res.data && typeof res.data.stayLoggedIn === 'boolean') {
          setStayLoggedIn(res.data.stayLoggedIn)
        }
      } catch {}
    }
    loadSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'setup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Master password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const res = mode === 'setup'
        ? await api.vault.initialize(password, stayLoggedIn)
        : await api.vault.unlock(password, stayLoggedIn)
      if (res.status === 'error') {
        setError(res.error || 'Authentication failed')
        return
      }
      onUnlocked()
    } catch (e: any) {
      setError(e.message || 'Unlock error')
    } finally {
      setLoading(false)
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <div
      className="flex items-center justify-center h-screen select-none bg-black text-white"
      style={{ background: '#000000' }}
    >
      <div className="w-full max-w-[380px] px-6">
        {/* Brand Heading & Title */}
        <div className="flex flex-col items-center text-center" style={{ marginBottom: '32px' }}>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Umbral</h1>
          <p className="text-xs text-zinc-400 font-medium" style={{ marginTop: '10px' }}>
            {mode === 'setup'
              ? 'Create a Master Password to encrypt your vault'
              : 'Enter your Master Password to unlock credentials'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Password Input Box */}
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'setup' ? 'Create Master Password' : 'Master Password'}
              autoComplete="current-password"
              style={{
                background: '#141417',
                border: '1px solid #282830',
                color: '#ffffff',
                height: '50px',
                paddingLeft: '18px',
                paddingRight: '48px'
              }}
              className="w-full rounded-xl text-sm outline-none transition-all placeholder:text-zinc-500 font-mono focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1.5 cursor-pointer"
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Confirm Password Input Box (Setup Mode) */}
          {mode === 'setup' && (
            <div className="relative" style={{ marginTop: '16px' }}>
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm Master Password"
                style={{
                  background: '#141417',
                  border: '1px solid #282830',
                  color: '#ffffff',
                  height: '50px',
                  paddingLeft: '18px',
                  paddingRight: '48px'
                }}
                className="w-full rounded-xl text-sm outline-none transition-all placeholder:text-zinc-500 font-mono focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1.5 cursor-pointer"
                title={showConfirmPw ? 'Hide password' : 'Show password'}
              >
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {/* Stay Logged In Checkbox with clean spacing above and below */}
          <div style={{ marginTop: '18px', marginBottom: '24px' }}>
            <label className="flex items-center gap-3 cursor-pointer select-none text-xs font-medium text-zinc-300 group">
              <div
                onClick={() => setStayLoggedIn(!stayLoggedIn)}
                className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                  stayLoggedIn
                    ? 'bg-white border-white text-zinc-950 shadow-sm'
                    : 'bg-[#141417] border-[#383842] group-hover:border-zinc-300'
                }`}
              >
                {stayLoggedIn && <Check size={11} strokeWidth={3.5} className="text-zinc-950" />}
              </div>
              <span onClick={() => setStayLoggedIn(!stayLoggedIn)}>
                Stay logged in (remember on this computer)
              </span>
            </label>
          </div>

          {error && (
            <div
              style={{ marginBottom: '18px', padding: '12px 16px' }}
              className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-center"
            >
              {error}
            </div>
          )}

          {/* Unlock Vault Button */}
          <button
            type="submit"
            disabled={loading}
            style={{ height: '48px', paddingLeft: '20px', paddingRight: '20px' }}
            className="w-full rounded-xl text-sm font-bold text-zinc-950 bg-white hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'setup' ? 'Create Secure Vault' : 'Unlock Vault'}</span>
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Security Footer with clean vertical spacing */}
        <div className="text-center" style={{ marginTop: '32px' }}>
          <p className="text-xs text-zinc-500 font-medium flex items-center justify-center gap-2">
            <Lock size={12} className="text-zinc-500" />
            Encrypted with AES-256-GCM & PBKDF2
          </p>
        </div>
      </div>
    </div>
  )
}
