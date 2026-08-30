import React, { useState, useEffect, useRef } from 'react'
import { Search, Zap, X, SlidersHorizontal, ArrowLeft } from 'lucide-react'
import RiotIcon from '../components/RiotIcon'
import UmbralLogo from '../components/UmbralLogo'

type OverlayAccount = {
  id: string
  title: string
  summonerName: string
  summonerTag: string
  username: string
  rank: string
  iconId?: number
  iconUrl?: string
  rankLp?: string
  region: string
  role: string
}

export default function OverlayApp(): JSX.Element {
  const [accounts, setAccounts] = useState<OverlayAccount[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL')
  const [isOpen, setIsOpen] = useState(false)
  const [isBtnHovered, setIsBtnHovered] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filling, setFilling] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const api = (window as any).api

  const load = async () => {
    try {
      const res = await api.overlay.getAccounts()
      if (res && res.status === 'ok') {
        setAccounts(res.data || [])
        setStatusMsg(null)
      } else {
        setAccounts([])
      }
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    const interval = setInterval(load, 1500)
    try {
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.on('vault:accountsUpdated', load)
        (window as any).electron.ipcRenderer.on('vault:unlocked', load)
      }
    } catch {}
    return () => {
      window.removeEventListener('focus', load)
      clearInterval(interval)
    }
  }, [])

  // Manage click-through when closed vs open
  useEffect(() => {
    if (isOpen) {
      api.overlay?.setIgnoreMouseEvents?.(false)
    } else {
      api.overlay?.setIgnoreMouseEvents?.(true, true)
    }
  }, [isOpen])

  // Close when clicking away / window blur
  useEffect(() => {
    const handleBlur = () => {
      setIsOpen(false)
      setIsSearching(false)
      setSearch('')
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  const filtered = accounts.filter(a => {
    if (selectedRegion !== 'ALL') {
      const accReg = (a.region || 'EUW').toUpperCase()
      if (accReg !== selectedRegion) return false
    }

    const q = search.toLowerCase().trim()
    return (
      !q ||
      a.username?.toLowerCase().includes(q) ||
      a.summonerName?.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.rankLp?.toLowerCase().includes(q) ||
      a.rank?.toLowerCase().includes(q) ||
      a.region?.toLowerCase().includes(q)
    )
  })

  const handleAutofill = async (account: OverlayAccount) => {
    if (filling) return
    setFilling(account.id)
    setStatusMsg(`Autofilling ${account.title || account.username}...`)
    try {
      const res = await api.overlay.autofill(account.id)
      if (res.status === 'error') {
        setStatusMsg(res.error || 'Autofill failed')
        setTimeout(() => setStatusMsg(null), 2500)
      } else {
        setIsOpen(false)
      }
    } catch (err: any) {
      setStatusMsg(err.message || 'Autofill error')
      setTimeout(() => setStatusMsg(null), 2500)
    } finally {
      setFilling(null)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSearching) {
          setIsSearching(false)
          setSearch('')
          setSelected(0)
        } else if (isOpen) {
          setIsOpen(false)
        }
        return
      }
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, Math.max(0, filtered.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter') {
        if (filtered[selected]) {
          e.preventDefault()
          handleAutofill(filtered[selected])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, filtered, isSearching, isOpen])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        padding: '0px',
        margin: '0px',
        boxSizing: 'border-box'
      }}
    >
      {/* Thumbnail Artwork Trigger Button Row (Top-Left of Riot Client Artwork) */}
      <div
        style={{
          width: '100%',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: 0,
          boxSizing: 'border-box',
          pointerEvents: 'none'
        }}
      >
        <button
          type="button"
          title="Umbral Autofill"
          onClick={e => {
            e.stopPropagation()
            setIsOpen(prev => !prev)
          }}
          onMouseEnter={() => {
            setIsBtnHovered(true)
            api.overlay?.setIgnoreMouseEvents?.(false)
          }}
          onMouseLeave={() => {
            setIsBtnHovered(false)
            if (!isOpen) {
              api.overlay?.setIgnoreMouseEvents?.(true, true)
            }
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: isOpen ? '#22222a' : isBtnHovered ? '#1c1c24' : '#121216',
            border: isOpen ? '1px solid #484856' : isBtnHovered ? '1px solid #3c3c48' : '1px solid #282832',
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.15s ease',
            pointerEvents: 'auto',
            flexShrink: 0
          }}
        >
          <UmbralLogo size={22} />
        </button>
      </div>

      {/* Floating Card (Opened when Trigger Button is clicked) */}
      {isOpen && (
        <div
          style={{
            width: '100%',
            maxHeight: 310,
            background: '#131316',
            border: '1px solid #2e2e36',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            marginTop: 8
          }}
        >
        {/* Topbar Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 50,
            padding: '8px 14px',
            borderBottom: '1px solid #24242c',
            background: '#17171c',
            boxSizing: 'border-box'
          }}
        >
          {isSearching ? (
            /* Search Mode: Back button + Search Input Pill */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSearching(false)
                  setSearch('')
                  setSelected(0)
                }}
                style={{
                  background: '#24242b',
                  border: '1px solid #34343d',
                  color: '#e4e4e7',
                  cursor: 'pointer',
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2e2e38' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#24242b' }}
              >
                <ArrowLeft size={15} />
              </button>

              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#222228',
                  border: '1px solid #363640',
                  borderRadius: '8px',
                  padding: '0 10px',
                  height: 32,
                  boxSizing: 'border-box'
                }}
              >
                <Search size={14} style={{ color: '#8e8e98', flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setSelected(0)
                  }}
                  placeholder="Search"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8e8e98',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Default Mode: "Passwords" Title + Search & Filter Icons */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fafafa',
                  letterSpacing: '-0.01em'
                }}
              >
                Passwords
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  title="Search"
                  onClick={() => {
                    setIsSearching(true)
                    setTimeout(() => searchRef.current?.focus(), 40)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    width: 32,
                    height: 32,
                    borderRadius: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = '#27272e'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#a1a1aa'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Search size={16} />
                </button>

                <button
                  type="button"
                  title="Settings"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    width: 32,
                    height: 32,
                    borderRadius: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = '#27272e'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#a1a1aa'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Horizontal Region Filter Bubble Bar (Scrollable with clean whitespace) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px 8px 10px',
            background: '#15151a',
            borderBottom: '1px solid #23232b',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          {['ALL', 'EUW', 'NA', 'EUNE', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU', 'JP', 'ME', 'SG', 'TW', 'VN', 'TH', 'PBE'].map(reg => {
            const isSelected = selectedRegion === reg
            return (
              <button
                key={reg}
                type="button"
                onClick={() => {
                  setSelectedRegion(selectedRegion === reg && reg !== 'ALL' ? 'ALL' : reg)
                  setSelected(0)
                }}
                style={{
                  padding: '3.5px 9px',
                  borderRadius: '9999px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #ffffff' : '1px solid #2c2c36',
                  background: isSelected ? '#ffffff' : '#1c1c23',
                  color: isSelected ? '#0d0d10' : '#a1a1aa',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  userSelect: 'none',
                  letterSpacing: '0.02em',
                  lineHeight: 1
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.borderColor = '#444452'
                    e.currentTarget.style.background = '#24242d'
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.color = '#a1a1aa'
                    e.currentTarget.style.borderColor = '#2c2c36'
                    e.currentTarget.style.background = '#1c1c23'
                  }
                }}
              >
                {reg}
              </button>
            )
          })}
        </div>

        {/* Status notice */}
        {statusMsg && (
          <div
            style={{
              padding: '6px 14px',
              fontSize: 11,
              background: '#181822',
              color: '#38bdf8',
              fontWeight: 600,
              borderBottom: '1px solid #222230'
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* Accounts List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 250,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxSizing: 'border-box'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid #ffffff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 10px', color: '#71717a', fontSize: 11 }}>
              {accounts.length === 0 ? 'Vault is locked or empty' : 'No accounts found'}
            </div>
          ) : (
            filtered.map((a, i) => {
              const isSelected = i === selected
              const isFillingThis = filling === a.id
              const title = a.title || `${a.summonerName || a.username}${a.summonerTag ? `#${a.summonerTag}` : ''}`
              const rawRankSubtitle =
                a.rankLp && a.rankLp !== 'UNRANKED'
                  ? a.rankLp
                  : a.rank && a.rank.toUpperCase() !== 'UNRANKED'
                  ? a.rank.toUpperCase()
                  : a.username

              const rankSubtitle = rawRankSubtitle
                .replace(/\b([I|V|X]+)\s+I\s+LP\b/gi, '$1 1 LP')
                .replace(/\b([I|V|X]+)\s+II\s+LP\b/gi, '$1 2 LP')
                .replace(/\b([I|V|X]+)\s+III\s+LP\b/gi, '$1 3 LP')
                .replace(/\b([I|V|X]+)\s+IV\s+LP\b/gi, '$1 4 LP')

              const iconSrc =
                a.iconUrl ||
                (a.iconId
                  ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${a.iconId}.jpg`
                  : null)

              return (
                <button
                  key={a.id}
                  onClick={() => handleAutofill(a)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: isSelected ? '#222228' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  {/* Summoner Icon Avatar */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: '#09090b',
                      border: '1px solid #232328',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt="Icon"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => ((e.currentTarget as HTMLElement).style.display = 'none')}
                      />
                    ) : (
                      <RiotIcon size={17} />
                    )}
                  </div>

                  {/* Account Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* IGN / Title (bold white top line) */}
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {title}
                    </div>

                    {/* Rank & LP (NordPass style subtitle) */}
                    <div
                      style={{
                        fontSize: 10.5,
                        color: '#9ca3af',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 1
                      }}
                    >
                      {rankSubtitle}
                    </div>
                  </div>

                  {/* Fill Animation / Indicator */}
                  {isFillingThis ? (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        border: '2px solid #ffffff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        flexShrink: 0
                      }}
                    />
                  ) : isSelected ? (
                    <Zap size={13} className="text-white" style={{ flexShrink: 0 }} />
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          ::-webkit-scrollbar { width: 3px; }
          ::-webkit-scrollbar-track { background: transparent !important; }
          ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18) !important; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35) !important; }
        `}</style>
      </div>
      )}
    </div>
  )
}
