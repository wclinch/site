'use client'
import { useEffect, useState } from 'react'
import { HOME_SHORTCUTS } from './quickOpenDefaults'
import { loadPins, savePins, shuffleArray } from './quickOpenHelpers'

const stripStyle = {
  height: '36px', flexShrink: 0,
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '0 8px',
  background: '#070807', borderBottom: '1px solid #252725',
  overflowX: 'auto' as const, overflowY: 'hidden' as const,
  scrollbarWidth: 'none' as const,
  WebkitAppRegion: 'no-drag' as const,
}

function SectionDivider() {
  return <div style={{ width: '1px', height: '14px', background: '#252725', flexShrink: 0, margin: '0 6px' }} />
}

function ShortcutChip({ label, pinned, onClick, onPin }: {
  label: string
  pinned: boolean
  onClick: () => void
  onPin: () => void
}) {
  const [hov, setHov] = useState(false)
  const [pinHov, setPinHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPinHov(false) }}
      style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        height: '22px',
        border: `1px solid ${hov ? '#5E5A54' : pinned ? '#252725' : '#252725'}`,
        borderRadius: '3px',
        transition: 'border-color 0.1s',
      }}
    >
      <button
        onClick={onClick}
        style={{
          height: '100%', padding: '0 8px 0 10px',
          background: 'none', border: 'none', outline: 'none',
          color: hov ? '#8C887F' : pinned ? '#8C887F' : 'rgba(230,226,216,0.55)',
          fontSize: '11px', letterSpacing: '0.02em',
          cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          transition: 'color 0.1s',
        }}
      >{label}</button>

      {/* Pin icon — always in layout to prevent width shift, opacity controls visibility */}
      <button
        onClick={e => { e.stopPropagation(); onPin() }}
        onMouseEnter={() => setPinHov(true)}
        onMouseLeave={() => setPinHov(false)}
        title={pinned ? 'Unpin from session' : 'Pin to session'}
        style={{
          height: '100%', padding: '0 6px 0 2px',
          background: 'none', border: 'none', outline: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          color: pinHov ? (pinned ? '#8C887F' : 'rgba(230,226,216,0.55)') : pinned ? '#8C887F' : '#5E5A54',
          opacity: (hov || pinned) ? 1 : 0,
          pointerEvents: (hov || pinned) ? 'auto' : 'none',
          transition: 'color 0.1s, opacity 0.1s',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1h4v1l-1 3h1a1 1 0 010 2H6v3H4V7H3a1 1 0 010-2h1L3 2V1z" />
        </svg>
      </button>
    </div>
  )
}

export default function QuickOpenStrip({ urlInput, navigate, workspaceId }: {
  urlInput: string
  navigate: (s: string) => void
  workspaceId: string
}) {
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() =>
    typeof window !== 'undefined' ? loadPins(workspaceId) : []
  )
  const [shuffled, setShuffled] = useState<[string, string][]>(() => shuffleArray(HOME_SHORTCUTS))

  useEffect(() => {
    setPinnedKeys(loadPins(workspaceId))
    setShuffled(shuffleArray(HOME_SHORTCUTS))
  }, [workspaceId])

  function togglePin(key: string) {
    setPinnedKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [key, ...prev]
      savePins(workspaceId, next)
      return next
    })
  }

  const q = urlInput.trim().toLowerCase()
  const isUrl = /^https?:\/\//i.test(q) || /^[?g]\s+/.test(q) || /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/.test(q)
  const isFiltering = !(!q || isUrl)

  if (isFiltering) {
    const matches = shuffled.filter(([k, l]) => k.includes(q) || l.toLowerCase().includes(q))
    if (matches.length === 0) return null
    const sorted = [...matches].sort(([ka], [kb]) =>
      (pinnedKeys.includes(kb) ? 1 : 0) - (pinnedKeys.includes(ka) ? 1 : 0)
    )
    return (
      <div style={stripStyle}>
        {sorted.map(([key, label]) => (
          <ShortcutChip key={key} label={label} pinned={pinnedKeys.includes(key)}
            onClick={() => navigate(key)} onPin={() => togglePin(key)} />
        ))}
      </div>
    )
  }

  const pinnedEntries = shuffled.filter(([k]) => pinnedKeys.includes(k))
  const unpinned      = shuffled.filter(([k]) => !pinnedKeys.includes(k))

  return (
    <div style={stripStyle}>
      {pinnedEntries.map(([key, label]) => (
        <ShortcutChip key={key} label={label} pinned
          onClick={() => navigate(key)} onPin={() => togglePin(key)} />
      ))}
      {pinnedEntries.length > 0 && <SectionDivider />}
      {unpinned.map(([key, label]) => (
        <ShortcutChip key={key} label={label} pinned={false}
          onClick={() => navigate(key)} onPin={() => togglePin(key)} />
      ))}
    </div>
  )
}
