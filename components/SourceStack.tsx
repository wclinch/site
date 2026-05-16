'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { QueuedSource } from '@/lib/types'

// ─── SourceStack ──────────────────────────────────────────────────────────────

export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, setContextMenu,
    selectedId, setSelectedId, setSelectedId2, patchSource, openInPane,
  } = useApp()

  const [renameId,    setRenameId]    = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Pane preferences: absence = Source 1 (default), present = Source 2
  const [panePrefs, setPanePrefs] = useState<Record<string, 2>>({})

  function getPref(srcId: string): 1 | 2 { return panePrefs[srcId] ?? 1 }
  function togglePref(srcId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setPanePrefs(prev => {
      const next = { ...prev }
      if (next[srcId] === 2) delete next[srcId]; else next[srcId] = 2
      return next
    })
  }
  function openWithPref(srcId: string) {
    if (getPref(srcId) === 2) setSelectedId2(srcId)
    else                       setSelectedId(srcId)
  }

  useEffect(() => {
    function onRename(e: Event) {
      const { srcId, currentLabel } = (e as CustomEvent<{ srcId: string; currentLabel: string }>).detail
      setRenameId(srcId)
      setRenameValue(currentLabel ?? '')
    }
    window.addEventListener('proof:rename-source', onRename as EventListener)
    return () => window.removeEventListener('proof:rename-source', onRename as EventListener)
  }, [])

  function commitRename() {
    if (!renameId) return
    const trimmed = renameValue.trim()
    if (trimmed) patchSource('', renameId, { label: trimmed })
    setRenameId(null)
    setRenameValue('')
  }
  function cancelRename() { setRenameId(null); setRenameValue('') }

  if (hidden) return null

  const fileSources = stackSources.filter(s => s.fileType !== 'url')
  const siteSources = stackSources.filter(s => s.fileType === 'url')

  const rowProps = {
    renameId, renameValue,
    onRenameChange: setRenameValue,
    onRenameCommit: commitRename,
    onRenameCancel: cancelRename,
    onContextMenu: (srcId: string, e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setContextMenu({ srcId, x: e.clientX, y: e.clientY })
    },
    onClick: (srcId: string) => openInPane(srcId),
    selectedId,
  }

  return (
    <>
      {/* ── Sources box ── */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid #1e1e1e', borderRadius: '4px',
      }}>
        <SectionHeader title="Sources" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 8px', display: 'flex', flexDirection: 'column' }}>
          {fileSources.length === 0 ? (
            <EmptyRow text="Files you add stay with this workspace." />
          ) : (
            fileSources.map(src => (
              <StackRow
                key={src.id}
                src={src}
                isActive={src.id === selectedId}
                renaming={renameId === src.id}
                renameValue={renameValue}
                onRenameChange={rowProps.onRenameChange}
                onRenameCommit={rowProps.onRenameCommit}
                onRenameCancel={rowProps.onRenameCancel}
                onClick={() => openWithPref(src.id)}
                onContextMenu={e => rowProps.onContextMenu(src.id, e)}
                pref={getPref(src.id)}
                onTogglePref={e => togglePref(src.id, e)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Sites box ── */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid #1e1e1e', borderRadius: '4px',
      }}>
        <SectionHeader title="Sites" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 8px', display: 'flex', flexDirection: 'column' }}>
          {siteSources.length === 0 ? (
            <EmptyRow text="Pages you save stay with this workspace." />
          ) : (
            siteSources.map(src => (
              <StackRow
                key={src.id}
                src={src}
                isActive={src.id === selectedId}
                renaming={renameId === src.id}
                renameValue={renameValue}
                onRenameChange={rowProps.onRenameChange}
                onRenameCommit={rowProps.onRenameCommit}
                onRenameCancel={rowProps.onRenameCancel}
                onClick={() => rowProps.onClick(src.id)}
                onContextMenu={e => rowProps.onContextMenu(src.id, e)}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      height: '28px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 10px 0 14px',
      borderBottom: '1px solid #1a1a1a',
      userSelect: 'none',
    }}>
      <span style={{ fontSize: '10px', color: '#666', letterSpacing: '0.05em' }}>
        {title}
      </span>
      {action}
    </div>
  )
}


function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{
      padding: '10px 14px',
      fontSize: '11px', color: '#444',
      letterSpacing: '0.02em', lineHeight: 1.5,
      userSelect: 'none',
    }}>
      {text}
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

function StackRow({
  src, isActive,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  onClick, onContextMenu, pref, onTogglePref,
}: {
  src: QueuedSource
  isActive: boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  pref?: 1 | 2
  onTogglePref?: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <div
      onClick={() => { if (!renaming) onClick() }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      draggable={!renaming}
      onDragStart={e => {
        e.dataTransfer.setData('application/x-proof-source-id', src.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      title={renaming ? undefined : (src.label || src.raw)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 10px 7px 14px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: isActive ? '#111' : hov ? '#0d0d0d' : 'transparent',
        borderLeft: isActive ? '2px solid #444' : '2px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {renaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onFocus={e => e.target.select()}
          onClick={e => e.stopPropagation()}
          onBlur={onRenameCommit}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter')  onRenameCommit()
            if (e.key === 'Escape') onRenameCancel()
          }}
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '11px', color: '#ccc', fontFamily: 'inherit',
            padding: 0, letterSpacing: '0.02em',
          }}
        />
      ) : (
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: '11px', letterSpacing: '0.02em',
          color: '#ccc',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {src.label || src.raw}
        </span>
      )}
      {pref !== undefined && onTogglePref && (
        <button
          onClick={renaming ? undefined : onTogglePref}
          title={renaming ? undefined : (pref === 1 ? 'Opens in Source 1 — click for Source 2' : 'Opens in Source 2 — click for Source 1')}
          style={{
            flexShrink: 0,
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', padding: 0, outline: 'none',
            color: '#444',
            cursor: renaming ? 'default' : 'pointer',
            transition: 'color 0.12s',
            visibility: renaming ? 'hidden' : 'visible',
            pointerEvents: renaming ? 'none' : 'auto',
          }}
          onMouseEnter={e => { if (!renaming) { e.stopPropagation(); e.currentTarget.style.color = '#999' } }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ display: 'block' }}>
            <path
              d={pref === 1 ? 'M1 4L4 1.5L7 4' : 'M1 1.5L4 4L7 1.5'}
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <TypeBadge kind={badgeKind(src)} />
    </div>
  )
}

function badgeKind(src: QueuedSource): 'IMG' | 'PDF' | 'URL' | 'NOTE' {
  if (src.fileType === 'image') return 'IMG'
  if (src.fileType === 'url')   return 'URL'
  if (src.fileType === 'note')  return 'NOTE'
  return 'PDF'
}

const KIND_COLOR: Record<'IMG' | 'PDF' | 'URL' | 'NOTE', string> = {
  IMG:  '#5c9e6e',
  PDF:  '#5c7eb8',
  URL:  '#5ca8a0',
  NOTE: '#b8935c',
}

function TypeBadge({ kind }: { kind: 'IMG' | 'PDF' | 'URL' | 'NOTE' }) {
  const color = KIND_COLOR[kind]
  return (
    <span style={{
      flexShrink: 0,
      width: '36px', textAlign: 'center',
      fontSize: '8px', letterSpacing: '0.1em',
      color, background: '#141414',
      border: '1px solid #1e1e1e', borderRadius: '2px',
      padding: '1px 0',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {kind}
    </span>
  )
}
