'use client'
import { useEffect, useState, useRef } from 'react'
import { loadHistory } from '@/lib/storage'
import { useApp } from '@/context/AppContext'
import type { HistoryEntry } from '@/lib/types'

export default function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries,  setEntries]  = useState<HistoryEntry[]>([])
  const [armedId,  setArmedId]  = useState<string | null>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { restoreFromHistory, deleteHistoryEntry, activeId } = useApp()

  useEffect(() => {
    if (open) { setEntries(loadHistory()); setArmedId(null) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (armedId) { clearArm(); }
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, armedId])

  function clearArm() {
    if (armTimer.current) clearTimeout(armTimer.current)
    setArmedId(null)
  }

  function handleArm(id: string) {
    if (armedId === id) {
      // Second click — delete
      clearArm()
      deleteHistoryEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } else {
      // First click — arm
      if (armTimer.current) clearTimeout(armTimer.current)
      setArmedId(id)
      armTimer.current = setTimeout(() => setArmedId(null), 1800)
    }
  }

  function handleRestore(entry: HistoryEntry) {
    clearArm()
    restoreFromHistory(entry)
    onClose()
  }

  if (!open) return null

  const current = entries.filter(e => e.wsId === activeId).sort((a, b) => b.ts - a.ts)
  const other   = entries.filter(e => e.wsId !== activeId).sort((a, b) => b.ts - a.ts)
  const sorted  = [...current, ...other]
  const isArmed = armedId !== null

  return (
    <div
      onClick={() => { clearArm(); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '460px', maxWidth: 'calc(100vw - 48px)',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: '#080808', border: '1px solid #1e1e1e',
          borderRadius: '6px', boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden', fontFamily: 'inherit',
        }}
      >
        {/* Header — step bars always visible, matching Clear Documents pattern */}
        <div style={{
          height: '40px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px 0 16px', borderBottom: '1px solid #141414',
        }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: isArmed ? '#c44' : '#444', transition: 'color 0.15s' }}>HISTORY</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Step indicator bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '16px', height: '2px', borderRadius: '1px',
                background: !isArmed ? '#c44' : '#222',
                transition: 'background 0.2s',
              }} />
              <div style={{
                width: '16px', height: '2px', borderRadius: '1px',
                background: isArmed ? '#c44' : '#222',
                transition: 'background 0.2s',
              }} />
            </div>
            <button
              onClick={() => { clearArm(); onClose() }}
              style={{
                width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: '#333',
                fontSize: '16px', lineHeight: 1, cursor: 'pointer',
                padding: 0, outline: 'none', fontFamily: 'inherit', transition: 'color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#333' }}
            >×</button>
          </div>
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: '12px', color: '#333', letterSpacing: '0.02em' }}>
              No history yet. History is captured when switching, creating, or removing workspaces.
            </div>
          ) : (
            sorted.map((entry, i) => {
              const isFirst     = i === 0 || sorted[i - 1].wsId !== entry.wsId
              const showDivider = i > 0 && sorted[i - 1].wsId === activeId && entry.wsId !== activeId
              return (
                <div key={entry.id}>
                  {showDivider && <div style={{ height: '1px', background: '#111', margin: '4px 0' }} />}
                  <HistoryRow
                    entry={entry}
                    isCurrent={entry.wsId === activeId}
                    isFirstInGroup={isFirst}
                    armed={armedId === entry.id}
                    onRestore={() => handleRestore(entry)}
                    onDelete={() => handleArm(entry.id)}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function HistoryRow({
  entry, isCurrent, isFirstInGroup, armed, onRestore, onDelete,
}: {
  entry: HistoryEntry
  isCurrent: boolean
  isFirstInGroup: boolean
  armed: boolean
  onRestore: () => void
  onDelete: () => void
}) {
  const [hov, setHov] = useState(false)

  const parts: string[] = []
  if (entry.docs.length)     parts.push(`${entry.docs.length} doc${entry.docs.length !== 1 ? 's' : ''}`)
  if (entry.pages.length)    parts.push(`${entry.pages.length} page${entry.pages.length !== 1 ? 's' : ''}`)
  if (entry.webTabs.length)  parts.push(`${entry.webTabs.length} tab${entry.webTabs.length !== 1 ? 's' : ''}`)
  if (entry.splitView)       parts.push('split')
  const summary = parts.join(' · ') || 'empty'

  const diff = Date.now() - entry.ts
  const timeStr =
    diff < 60_000      ? 'just now' :
    diff < 3_600_000   ? `${Math.floor(diff / 60_000)}m ago` :
    diff < 86_400_000  ? `${Math.floor(diff / 3_600_000)}h ago` :
    diff < 604_800_000 ? `${Math.floor(diff / 86_400_000)}d ago` :
    new Date(entry.ts).toLocaleDateString()

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 14px 9px 16px',
        borderBottom: '1px solid #0d0d0d',
        background: hov ? '#0c0c0c' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFirstInGroup && (
          <div style={{
            fontSize: '10px', color: isCurrent ? '#555' : '#333',
            letterSpacing: '0.05em', marginBottom: '3px', textTransform: 'uppercase',
          }}>
            {entry.wsName}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: isCurrent ? '#666' : '#444' }}>
            {timeStr}
          </span>
          <span style={{ fontSize: '10px', color: '#222' }}>·</span>
          <span style={{ fontSize: '10px', color: '#2e2e2e', letterSpacing: '0.03em' }}>{summary}</span>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        opacity: (hov || armed) ? 1 : 0,
        transition: 'opacity 0.1s',
        flexShrink: 0,
      }}>
        <button
          onClick={onRestore}
          style={{
            height: '22px', padding: '0 9px',
            background: 'none', border: '1px solid #222', borderRadius: '3px',
            color: '#555', fontSize: '10px', letterSpacing: '0.05em',
            cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
            transition: 'color 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
        >Restore</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title={armed ? 'Click again to remove' : 'Remove'}
          style={{
            width: '18px', height: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            color: armed ? '#c44' : '#2e2e2e',
            fontSize: '14px', lineHeight: 1,
            cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => { if (!armed) e.currentTarget.style.color = '#944' }}
          onMouseLeave={e => { e.currentTarget.style.color = armed ? '#c44' : '#2e2e2e' }}
        >×</button>
      </div>
    </div>
  )
}
