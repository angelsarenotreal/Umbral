import React, { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search all items'
}: Props): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
      if (e.key === 'Escape' && document.activeElement === ref.current) {
        onChange('')
        ref.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onChange])

  return (
    <div className="relative w-full max-w-xl no-drag select-none flex items-center">
      {/* Search Icon properly positioned on the left */}
      <Search
        size={15}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none shrink-0"
      />

      {/* Input Field with guaranteed padding preventing text overlap */}
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 text-xs rounded-xl outline-none transition-all placeholder:text-zinc-500 text-white font-medium shadow-inner"
        style={{
          background: '#18181b',
          border: '1px solid #222226',
          paddingLeft: '38px',
          paddingRight: '80px'
        }}
        onFocus={e => (e.target.style.borderColor = '#00c0f0')}
        onBlur={e => (e.target.style.borderColor = '#222226')}
      />

      {/* Right side: Clear button or Ctrl + F badge */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-zinc-400 hover:text-white pointer-events-auto cursor-pointer"
          >
            <X size={13} />
          </button>
        ) : (
          <span
            style={{
              paddingLeft: '8px',
              paddingRight: '8px',
              paddingTop: '3.5px',
              paddingBottom: '3.5px',
              lineHeight: 1
            }}
            className="text-[10px] font-medium rounded-md bg-[#222226] text-zinc-400 border border-[#333338] inline-flex items-center justify-center select-none shadow-xs"
          >
            Ctrl F
          </span>
        )}
      </div>
    </div>
  )
}
