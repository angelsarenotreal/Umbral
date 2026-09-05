import React, { useEffect, useState } from 'react'
import { ArrowRight, RotateCw, X } from 'lucide-react'
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

  // If no update or dismissed or idle/checking/not-available, don't show modal
  if (
    dismissed ||
    updateState.status === 'idle' ||
    updateState.status === 'checking' ||
    updateState.status === 'not-available'
  ) {
    return null
  }

  const isDownloading = updateState.status === 'downloading'
  const isDownloaded = updateState.status === 'downloaded'
  const isError = updateState.status === 'error'

  const handleUpdateNow = async () => {
    setUpdateState(prev => ({
      ...prev,
      status: 'downloading',
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 }
    }))
    const res = await api.updater.download()
    if (res?.status === 'error') {
      setUpdateState(prev => ({
        ...prev,
        status: 'error',
        error: res.error || 'Failed to download update'
      }))
    }
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
          padding: '36px 28px 28px 28px',
          background: '#121216',
          border: '1px solid #282834',
          borderRadius: '24px',
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

        {/* Title */}
        <h2 className="text-lg font-bold text-white tracking-tight">
          {isDownloaded
            ? 'Update Ready'
            : isDownloading
            ? 'Downloading Update'
            : isError
            ? 'Update Notice'
            : 'Update Available'}
        </h2>

        {/* Version Badge or Progress Text with generous padding inside the bubble */}
        <div style={{ marginTop: '12px', marginBottom: '26px' }}>
          {isDownloading ? (
            <p className="text-xs font-mono font-medium text-zinc-400">
              {percent}% completed
            </p>
          ) : isError ? (
            <p className="text-xs text-red-400 font-medium px-2">
              {updateState.error || 'Unable to download update automatically.'}
            </p>
          ) : updateState.version ? (
            <span
              style={{ padding: '6px 18px' }}
              className="inline-block rounded-full text-xs font-bold bg-[#1a1a24] text-zinc-300 border border-[#2e2e42] tracking-wide shadow-sm"
            >
              v{updateState.version}
            </span>
          ) : null}
        </div>

        {/* Downloading Progress Bar */}
        {isDownloading && (
          <div className="w-full mb-6 px-1">
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
              <span>Downloading update...</span>
            </div>
          ) : isError ? (
            <>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                style={{ height: '42px' }}
                className="flex-1 rounded-xl text-xs font-bold bg-[#181820] text-zinc-400 hover:text-white hover:bg-[#20202c] border border-[#282836] transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpdateNow}
                style={{ height: '42px' }}
                className="flex-1 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Retry</span>
              </button>
            </>
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
