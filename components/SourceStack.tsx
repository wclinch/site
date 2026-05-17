'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { QueuedSource } from '@/lib/types'

// ─── SourceStack ──────────────────────────────────────────────────────────────

export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, setContextMenu,
    selectedId, selectedId2, patchSource, openInPane, uploadFiles,
    pinPageToView, view1Page, view2Page, openDocInPane,
  } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [renameId,    setRenameId]    = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Pane preferences: absence = View 1 (default), present = View 2
  const [panePrefs, setPanePrefs] = useState<Record<string, 2>>({})

  // Effective pref: actual open-in-view-2 state takes precedence over stored preference.
  function getEffectivePref(srcId: string): 1 | 2 {
    if (selectedId2 === srcId) return 2
    return panePrefs[srcId] ?? 1
  }
  function setPref(srcId: string, pane: 1 | 2, e: React.MouseEvent) {
    e.stopPropagation()
    setPanePrefs(prev => {
      const next = { ...prev }
      if (pane === 1) delete next[srcId]; else next[srcId] = 2
      return next
    })
  }
  function openWithPref(srcId: string) {
    openDocInPane(getEffectivePref(srcId), srcId)
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
        <SectionHeader title="Documents" action={
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Add document"
              style={{
                background: 'none', border: 'none', padding: '4px 2px',
                cursor: 'pointer', color: '#444', lineHeight: 0,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
              </svg>
            </button>
            <input
              ref={fileInputRef} type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) { uploadFiles(e.target.files); e.target.value = '' } }}
            />
          </>
        } />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 8px', display: 'flex', flexDirection: 'column' }}>
          {fileSources.length === 0 ? (
            <EmptyRow text="Documents you add stay with this workspace." />
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
                paneButtons={{
                  pref: getEffectivePref(src.id),
                  onSet1: e => setPref(src.id, 1, e),
                  onSet2: e => setPref(src.id, 2, e),
                }}
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
        <SectionHeader title="Pages" />
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
                onClick={() => pinPageToView(getEffectivePref(src.id) === 2 ? 2 : 1, src)}
                onContextMenu={e => rowProps.onContextMenu(src.id, e)}
                pinButtons={{
                  onPin1: () => pinPageToView(1, src),
                  onPin2: () => pinPageToView(2, src),
                  active1: view1Page?.srcId === src.id,
                  active2: view2Page?.srcId === src.id,
                }}
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
  onClick, onContextMenu, paneButtons, pinButtons,
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
  paneButtons?: { pref: 1 | 2; onSet1: (e: React.MouseEvent) => void; onSet2: (e: React.MouseEvent) => void }
  pinButtons?: { onPin1: () => void; onPin2: () => void; active1?: boolean; active2?: boolean }
}) {
  const [hov, setHov] = useState(false)
  const label = src.label || src.raw

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
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 10px 8px 14px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: isActive ? '#131313' : hov ? '#0d0d0d' : 'transparent',
        borderLeft: isActive ? '2px solid #383838' : '2px solid transparent',
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
            fontSize: '12px', color: '#bbb', fontFamily: 'inherit',
            padding: 0, letterSpacing: '0.01em',
          }}
        />
      ) : (
        <span
          title={label}
          style={{
            flex: 1, minWidth: 0,
            fontSize: '12px', letterSpacing: '0.01em',
            color: '#bbb',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}

      {/* Pane selector — Documents: 1 / 2 buttons */}
      {paneButtons && !renaming && (
        <>
          <PinBtn
            label="1"
            title="Open in View 1"
            active={paneButtons.pref === 1}
            onClick={paneButtons.onSet1}
          />
          <PinBtn
            label="2"
            title="Open in View 2"
            active={paneButtons.pref === 2}
            onClick={paneButtons.onSet2}
          />
        </>
      )}

      {/* View pin buttons — Pages only */}
      {pinButtons && !renaming && (
        <>
          <PinBtn label="1" title="Open in View 1" active={!!pinButtons.active1} onClick={e => { e.stopPropagation(); pinButtons.onPin1() }} />
          <PinBtn label="2" title="Open in View 2" active={!!pinButtons.active2} onClick={e => { e.stopPropagation(); pinButtons.onPin2() }} />
        </>
      )}

      {/* File type badge — Documents only */}
      {src.fileType !== 'url' && <TypeBadge kind={src.fileType === 'image' ? 'IMG' : 'PDF'} />}
    </div>
  )
}

function PinBtn({ label, title, active, onClick }: {
  label: string; title: string; active: boolean; onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: '16px', height: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0, outline: 'none',
        color: active ? '#aaa' : hov ? '#777' : '#333',
        fontSize: '9px', letterSpacing: '0.02em',
        cursor: 'pointer', transition: 'color 0.12s', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function TypeBadge({ kind }: { kind: 'IMG' | 'PDF' }) {
  return (
    <span style={{
      flexShrink: 0,
      fontSize: '8px', letterSpacing: '0.08em',
      color: '#3a3a3a',
      border: '1px solid #1e1e1e', borderRadius: '2px',
      padding: '1px 4px',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {kind}
    </span>
  )
}
