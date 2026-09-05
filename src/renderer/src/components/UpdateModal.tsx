import React, { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, RotateCw, CheckCircle2, X } from 'lucide-react'
import { api } from '../lib/ipc'
import type { UpdateInfoState } from '../../../shared/types'

export default function UpdateModal(): JSX.Element | null {
  const [updateState, setUpdateState] = useState<UpdateInfoState>({ status: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Fetch initial state
    api.updater?.getState?.().then((res: any) => {
      if (res?.status === 'ok' && res.data) {
        setUpdateState(res.data)
      }
    })

    // Listen to live updater events
    const unsub = api.updater?.onStatusChanged?.((state: UpdateInfoState) => {
      setUpdateState(state)
      if (state.status === 'available' || state.status === 'downloaded') {
        setDismissed(false)
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  // If no update or dismissed or idle/checking/not-available/error, don'\''t show modal
  if (
    dismissed ||
    updateState.status === 'idle' ||
    updateState.status === 'checking' ||
    updateState.status === 'not-available' ||
    updateState.status === 'error'
  ) {
    return null
  }

  const isDownloading = updateState.status === 'downloading'
  const isDownloaded = updateState.status === 'downloaded'
  const isAvailable = updateState.status === 'available'

  const handleUpdateNow = async () => {
    await api.updater.download()
  }

  const handleRestartNow = async () => {
    await api.updater.install()
  }

  const percent = updateState.progress?.percent ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        style={{
          width: '380px',
          padding: '28px 24px',
          background: '#121216',
          border: '1px solid #282834',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        }}
        className="relative flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
      >
        {/* Dismiss X button (only when not actively downloading) */}
        {!isDownloading && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        )}

        {/* Icon Container with generous margin */}
        <div
          style={{ marginBottom: '20px' }}
          className="w-14 h-14 rounded-2xl bg-[#181820] border border-[#2c2c3a] flex items-center justify-center text-white shadow-inner"
        >
          {isDownloading ? (
            <RotateCw size={24} className="animate-spin text-white" />
          ) : isDownloaded ? (
            <CheckCircle2 size={26} className="text-emerald-400" />
          ) : (
            <Sparkles size={24} className="text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-white tracking-tight">
          {isDownloaded
            ? 'Update Ready'
            : isDownloading
            ? 'Downloading Update'
            : 'Update Available'}
        </h2>

        {/* Version Badge or Progress Text */}
        <div style={{ marginTop: '6px', marginBottom: '24px' }}>
          {isDownloading ? (
            <p className="text-xs font-mono font-medium text-zinc-400">
              {percent}% completed
            </p>
          ) : updateState.version ? (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1c1c26] text-zinc-300 border border-[#2e2e3e]">
              v{updateState.version}
            </span>
          ) : null}
        </div>

        {/* Downloading Progress Wheel / Bar */}
        {isDownloading && (
          <div className="w-full mb-6 px-2">
            <div className="w-full h-1.5 bg-[#1e1e28] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-200 rounded-full"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex items-center gap-3">
          {isDownloaded ? (
            <button
              type="button"
              onClick={handleRestartNow}
              style={{ height: '42px' }}
              className="w-full rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <span>Restart & Install</span>
              <ArrowRight size={14} />
            </button>
          ) : isDownloading ? (
            <div
              style={{ height: '42px' }}
              className="w-full rounded-xl text-xs font-bold bg-[#181822] text-zinc-400 border border-[#2a2a3a] flex items-center justify-center gap-2 select-none"
            >
              <RotateCw size={13} className="animate-spin text-zinc-300" />
              <span>Please wait...</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                style={{ height: '42px' }}
                className="flex-1 rounded-xl text-xs font-bold bg-[#181820] text-zinc-400 hover:text-white hover:bg-[#20202c] border border-[#282836] transition-all cursor-pointer"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleUpdateNow}
                style={{ height: '42px' }}
                className="flex-1 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Update Now</span>
                <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
