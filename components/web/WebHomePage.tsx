'use client'
import { useImperativeHandle, useRef, useState, forwardRef } from 'react'

export interface WebHomePageHandle { focus: () => void }

const STARTERS: [string, string][] = [
  ['google',    'Google'],
  ['chatgpt',   'ChatGPT'],
  ['wikipedia', 'Wikipedia'],
]

function GlobeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 2c-2.5 2.5-4 5-4 8s1.5 5.5 4 8" />
      <path d="M10 2c2.5 2.5 4 5 4 8s-1.5 5.5-4 8" />
      <line x1="2" y1="10" x2="18" y2="10" />
    </svg>
  )
}

const WebHomePage = forwardRef<WebHomePageHandle, { navigate: (raw: string) => void }>(
function WebHomePage({ navigate }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))
  const [query, setQuery] = useState('')

  function submit() {
    const q = query.trim()
    if (!q) return
    navigate(q)
    setQuery('')
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '0',
    }}>
      <style>{`.wb-search::placeholder { color: #484848; }`}</style>

      {/* Icon + label */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        marginBottom: '28px', color: '#383838',
      }}>
        <GlobeIcon />
      </div>

      {/* Search input */}
      <input
        ref={inputRef}
        className="wb-search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Search or enter URL"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '360px', height: '42px',
          background: '#0e0e0e', border: '1px solid #252525',
          borderRadius: '8px', color: '#d0d0d0',
          fontSize: '13px', padding: '0 16px',
          outline: 'none', fontFamily: 'inherit', letterSpacing: '0.01em',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.background = '#111' }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.background = '#0e0e0e' }}
      />

      {/* Starter chips */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {STARTERS.map(([key, label]) => (
          <StarterChip key={key} label={label} onClick={() => navigate(key)} />
        ))}
      </div>

      {/* Hint */}
      <span style={{ marginTop: '20px', fontSize: '10px', color: '#313131', letterSpacing: '0.03em' }}>
        <span style={{ fontFamily: 'monospace', color: '#444' }}>? query</span>
        {' '}searches Google
      </span>
    </div>
  )
})

export default WebHomePage

function StarterChip({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '28px', padding: '0 14px',
        background: hov ? '#141414' : 'transparent',
        border: `1px solid ${hov ? '#303030' : '#222'}`,
        borderRadius: '5px',
        color: hov ? '#999' : '#404040',
        fontSize: '11px', letterSpacing: '0.03em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
