'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import type { WorkspaceSnapshot } from '@/context/workspaceHistoryTypes'
import { describeSnapshot, formatSnapshotTime } from '@/context/workspaceHistoryHelpers'

export default function WorkspaceHistoryPanel({ visible, onClose }: {
  visible: boolean
  onClose: () => void
}) {
  const {
    isPro, workspaceHistory,
    saveHistorySnapshot, restoreHistorySnapshot,
    restoreHistorySnapshotAsCopy, clearWorkspaceHistory,
  } = useApp()

  const [tick, setTick] = useState(0)

  // Re-render timestamps every minute.
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [visible])

  function handleRestore(snap: WorkspaceSnapshot) {
    restoreHistorySnapshot(snap)
    onClose()
  }

  function handleRestoreAsCopy(snap: WorkspaceSnapshot) {
    restoreHistorySnapshotAsCopy(snap)
    onClose()
  }

  function handleSave() {
    saveHistorySnapshot(true)
  }

  function handleClear() {
    clearWorkspaceHistory()
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      borderBottom: '1px solid #1e1e1e', background: '#060606',
    }}>
      {/* Header row */}
      <div style={{
        height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 10px', borderBottom: '1px solid #1e1e1e',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <span style={{
          flex: 1, fontSize: '10px', color: '#555',
          letterSpacing: '0.08em', textTransform: 'uppercase', userSelect: 'none',
        }}>
          Workspace History
        </span>

        <SaveBtn onClick={handleSave} />

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', padding: '0 2px',
            color: '#333', cursor: 'pointer', fontSize: '16px',
            lineHeight: 1, outline: 'none', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#777')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        >×</button>
      </div>

      {/* Snapshot list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>

        {workspaceHistory.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#555', letterSpacing: '0.04em' }}>
            No history yet. States save automatically.
          </div>
        )}

        {workspaceHistory.map(snap => (
          <SnapshotRow
            key={snap.id}
            snap={snap}
            isPro={isPro}
            onRestore={() => handleRestore(snap)}
            onRestoreAsCopy={() => handleRestoreAsCopy(snap)}
            tick={tick}
          />
        ))}

        {workspaceHistory.length > 0 && (
          <div style={{ padding: '10px 10px 14px', display: 'flex', justifyContent: 'flex-end' }}>
            <ClearBtn onClick={handleClear} />
          </div>
        )}
      </div>
    </div>
  )
}

function SnapshotRow({ snap, isPro, onRestore, onRestoreAsCopy, tick }: {
  snap: WorkspaceSnapshot
  isPro: boolean
  onRestore: () => void
  onRestoreAsCopy: () => void
  tick: number
}) {
  void tick  // causes re-render for live timestamp updates
  const [hov, setHov] = useState(false)
  const desc = describeSnapshot(snap)
  const time = formatSnapshotTime(snap.timestamp)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '7px 10px',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: hov ? '#0d0d0d' : 'none',
        transition: 'background 0.1s',
      }}
    >
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px', color: '#888', letterSpacing: '0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{time}</div>
        {desc && (
          <div style={{
            fontSize: '10px', color: '#444', letterSpacing: '0.02em', marginTop: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{desc}</div>
        )}
      </div>

      {/* Actions — only visible on hover */}
      <div style={{
        display: 'flex', gap: '4px', flexShrink: 0,
        opacity: hov ? 1 : 0, transition: 'opacity 0.1s',
        pointerEvents: hov ? 'auto' : 'none',
      }}>
        <RowBtn onClick={onRestore}>Restore</RowBtn>
        {isPro && (
          <RowBtn onClick={onRestoreAsCopy}>Copy</RowBtn>
        )}
      </div>
    </div>
  )
}

function RowBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '20px', padding: '0 7px',
        background: 'none',
        border: `1px solid ${hov ? '#333' : '#252525'}`,
        borderRadius: '3px',
        color: hov ? '#aaa' : '#555',
        fontSize: '10px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.1s, border-color 0.1s',
      }}
    >{children}</button>
  )
}

function SaveBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Save current state"
      style={{
        height: '20px', padding: '0 7px',
        background: 'none',
        border: `1px solid ${hov ? '#2a2a2a' : '#1e1e1e'}`,
        borderRadius: '3px',
        color: hov ? '#777' : '#444',
        fontSize: '10px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.1s, border-color 0.1s',
        whiteSpace: 'nowrap',
      }}
    >Save current state</button>
  )
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: 0,
        color: hov ? '#555' : '#333',
        fontSize: '10px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.1s',
      }}
    >Clear history</button>
  )
}
