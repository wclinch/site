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
  const [panePrefs,   setPanePrefs]   = useState<Record<string, 2>>({})

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

  const sharedRename = { renameId, renameValue, onRenameChange: setRenameValue, onRenameCommit: commitRename, onRenameCancel: cancelRename }

  function handleContextMenu(srcId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ srcId, x: e.clientX, y: e.clientY })
  }

  return (
    <>
      {/* ── Documents ── */}
      <div style={{
        flex: '0 1 42%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid #1e1e1e', borderRadius: '4px',
        background: 'linear-gradient(180deg, #0d0d0d 0%, transparent 100%)',
      }}>
        <SectionHeader title="Documents" action={
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Add Document"
              style={{
                background: 'none', border: 'none', padding: '4px 2px',
                cursor: 'pointer', color: '#555', lineHeight: 0,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
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
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 0 6px', display: 'flex', flexDirection: 'column' }}>
          {fileSources.length === 0 ? (
            <EmptyRow text="Add documents to this session." />
          ) : (
            fileSources.map(src => (
              <StackRow
                key={src.id}
                src={src}
                isActive={src.id === selectedId}
                {...sharedRename}
                renaming={renameId === src.id}
                onClick={() => {}}
                onContextMenu={e => handleContextMenu(src.id, e)}
                paneButtons={{
                  active1: selectedId === src.id,
                  active2: selectedId2 === src.id,
                  onSet1: e => { setPref(src.id, 1, e); openDocInPane(1, src.id) },
                  onSet2: e => { setPref(src.id, 2, e); openDocInPane(2, src.id) },
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Pages ── */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid #1e1e1e', borderRadius: '4px',
      }}>
        <SectionHeader title="Pages" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 0 6px', display: 'flex', flexDirection: 'column' }}>
          {siteSources.length === 0 ? (
            <EmptyRow text="Save pages from the Web browser." />
          ) : (
            siteSources.map(src => (
              <StackRow
                key={src.id}
                src={src}
                isActive={src.id === selectedId}
                {...sharedRename}
                renaming={renameId === src.id}
                onClick={() => src.raw && window.dispatchEvent(new CustomEvent('proof:browser-navigate', { detail: src.raw }))}
                onContextMenu={e => handleContextMenu(src.id, e)}
                pinButtons={{
                  onPin1: () => pinPageToView(1, src),
                  onPin2: () => pinPageToView(2, src),
                  active1: view1Page?.srcId === src.id,
                  active2: view2Page?.srcId === src.id,
                  onWeb: src.raw ? () => window.dispatchEvent(new CustomEvent('proof:browser-navigate', { detail: src.raw })) : undefined,
                }}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ─── Metadata helper ──────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024 * 1024)       return `${Math.round(b / 1024)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getMetaLine(src: QueuedSource): string {
  if (src.fileType === 'url') {
    try { return new URL(src.raw).hostname.replace(/^www\./, '') } catch { return src.raw }
  }
  if (src.fileType === 'note') return 'Note'
  const size = src.fileSize ? ` · ${fmtBytes(src.fileSize)}` : ''
  if (src.fileType === 'image') return `Image${size}`
  const type = src.fileType === 'pdf' ? 'PDF' : 'Document'
  if (src.status === 'queued')     return `${type} · Queued${size}`
  if (src.status === 'extracting') return `${type} · Reading…${size}`
  if (src.status === 'error')      return `${type} · Error`
  return `${type}${size}`
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      height: '32px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 10px 0 16px',
      background: '#060606',
      borderBottom: '1px solid #1e1e1e',
      userSelect: 'none',
    }}>
      <span style={{ fontSize: '10px', color: '#555', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {title}
      </span>
      {action}
    </div>
  )
}

function EmptyRow({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(180deg, #0d0d0d 0%, transparent 80%)',
      padding: '12px 14px',
      fontSize: '11px', color: '#3c3c3c',
      letterSpacing: '0.02em', lineHeight: 1.55,
      userSelect: 'none',
      display: 'flex', alignItems: 'flex-start', gap: '7px',
    }}>
      {icon && <span style={{ marginTop: '1px', flexShrink: 0, color: '#2a2a2a', lineHeight: 0 }}>{icon}</span>}
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
  paneButtons?: { active1: boolean; active2: boolean; onSet1: (e: React.MouseEvent) => void; onSet2: (e: React.MouseEvent) => void }
  pinButtons?: { onPin1: () => void; onPin2: () => void; active1?: boolean; active2?: boolean; onWeb?: () => void }
}) {
  const [hov, setHov] = useState(false)
  const label = src.label || src.raw
  const meta  = getMetaLine(src)

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
        display: 'flex', alignItems: 'center',
        padding: '9px 10px 9px 16px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: isActive ? '#141414' : hov ? '#0d0d0d' : 'transparent',
        borderLeft: `2px solid ${isActive ? '#383838' : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {/* Two-line text block — rename input replaces label line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Fixed-height row so swapping div↔input never shifts the meta line */}
        <div style={{ height: '16px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {renaming ? (
            <input
              autoFocus
              spellCheck={false}
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
                flex: 1, minWidth: 0, width: '100%',
                height: '16px', boxSizing: 'border-box',
                background: 'transparent', border: 'none', outline: 'none',
                margin: 0, padding: 0,
                fontSize: '12px', lineHeight: '16px', color: '#c2c2c2',
                fontFamily: 'inherit', letterSpacing: '0.01em',
                WebkitAppearance: 'none',
              } as React.CSSProperties}
            />
          ) : (
            <div style={{
              fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em',
              color: isActive ? '#d4d4d4' : hov ? '#bbb' : '#999',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              width: '100%', height: '16px', boxSizing: 'border-box',
              transition: 'color 0.1s',
            }}>
              {label}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
          <div style={{
            minWidth: 0,
            fontSize: '10px', color: src.status === 'error' ? '#7a3a3a' : '#3e3e3e',
            letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {meta}
          </div>
          {/* Controls — inline with meta line, fade in on hover, hidden while renaming */}
          {!renaming && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0,
              opacity: hov ? 1 : 0,
              pointerEvents: hov ? 'auto' : 'none',
              transition: 'opacity 0.12s',
            }}>
              {paneButtons && (
                <>
                  <HoverBtn label="1" title="Open in View 1" active={paneButtons.active1} onClick={paneButtons.onSet1} />
                  <HoverBtn label="2" title="Open in View 2" active={paneButtons.active2} onClick={paneButtons.onSet2} />
                </>
              )}
              {pinButtons && (
                <>
                  <HoverBtn label="1" title="Pin to View 1" active={!!pinButtons.active1} onClick={e => { e.stopPropagation(); pinButtons.onPin1() }} />
                  <HoverBtn label="2" title="Pin to View 2" active={!!pinButtons.active2} onClick={e => { e.stopPropagation(); pinButtons.onPin2() }} />
                  {pinButtons.onWeb && (
                    <HoverBtn
                      label={
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                          <circle cx="6" cy="6" r="4.5" />
                          <path d="M6 1.5C4.5 3 3.5 4.5 3.5 6s1 3 2.5 4.5M6 1.5C7.5 3 8.5 4.5 8.5 6S7.5 9 6 10.5" />
                          <line x1="1.5" y1="6" x2="10.5" y2="6" />
                        </svg>
                      }
                      title="Open in Web"
                      active={false}
                      onClick={e => { e.stopPropagation(); pinButtons.onWeb!() }}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Hover control button ─────────────────────────────────────────────────────

function HoverBtn({ label, title, active, onClick }: {
  label: React.ReactNode; title: string; active: boolean; onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: '20px', height: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#1e1e1e' : hov ? '#181818' : 'none',
        border: `1px solid ${active ? '#333' : hov ? '#2a2a2a' : 'transparent'}`,
        borderRadius: '3px', padding: 0, outline: 'none',
        color: active ? '#bbb' : hov ? '#888' : '#555',
        fontSize: '10px', letterSpacing: '0.02em',
        cursor: 'pointer', transition: 'color 0.1s, background 0.1s, border-color 0.1s',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
