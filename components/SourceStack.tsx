'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { QueuedSource } from '@/lib/types'

// ─── SourceStack ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'docs' | 'pages'

export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, selectedId, selectedId2, patchSource, uploadFiles,
    openDocInPane, pinPageToView, view1Page, view2Page, removeSource,
    setSelectedId, setSelectedId2, clearView,
  } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const [renameId,    setRenameId]    = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  function commitRename() {
    if (!renameId) return
    const trimmed = renameValue.trim()
    if (trimmed) patchSource('', renameId, { label: trimmed })
    setRenameId(null); setRenameValue('')
  }
  function cancelRename() { setRenameId(null); setRenameValue('') }

  if (hidden) return null

  const fileSources = stackSources.filter(s => s.fileType !== 'url')
  const siteSources = stackSources.filter(s => s.fileType === 'url')

  const showDocs  = filter === 'all' || filter === 'docs'
  const showPages = filter === 'all' || filter === 'pages'

  const sharedRename = {
    renameId, renameValue,
    onRenameChange: setRenameValue,
    onRenameCommit: commitRename,
    onRenameCancel: cancelRename,
  }

  const isEmpty = (showDocs && fileSources.length === 0 && !showPages) ||
                  (showPages && siteSources.length === 0 && !showDocs) ||
                  (showDocs && showPages && fileSources.length === 0 && siteSources.length === 0)

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: '1px solid #232523', borderRadius: '4px', background: '#080909',
    }}>
      {/* ── Header: filter tabs + add button ── */}
      <div style={{
        height: '44px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 10px', gap: '0',
        background: '#080909', borderBottom: '1px solid #232523',
        userSelect: 'none',
      }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
          {(['all', 'docs', 'pages'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                height: '26px', padding: '0 10px',
                background: filter === f ? '#171817' : 'none',
                border: `1px solid ${filter === f ? '#232523' : 'transparent'}`,
                borderRadius: '4px', cursor: 'pointer', outline: 'none',
                fontSize: '11px', letterSpacing: '0.03em',
                color: filter === f ? '#E6E2D8' : '#8A8780',
                fontFamily: 'inherit', transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { if (filter !== f) e.currentTarget.style.color = '#E6E2D8' }}
              onMouseLeave={e => { if (filter !== f) e.currentTarget.style.color = '#8A8780' }}
            >
              {f === 'all' ? 'All' : f === 'docs' ? 'Documents' : 'Pages'}
            </button>
          ))}
        </div>
        {/* Add document */}
        {(filter === 'all' || filter === 'docs') && (
          <>
            <button onClick={() => fileInputRef.current?.click()} title="Add Document"
              style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: '#8A8780', lineHeight: 0, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#8A8780' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8A8780' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) { uploadFiles(e.target.files); e.target.value = '' } }} />
          </>
        )}
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 0 4px', display: 'flex', flexDirection: 'column' }}>
        {isEmpty ? (
          <EmptyRow text={filter === 'docs' ? 'No documents in this session.' : filter === 'pages' ? 'No saved pages.' : 'No sources yet.'} />
        ) : (
          <>
            {showDocs && fileSources.map(src => (
              <StackRow key={src.id} src={src} isActive={src.id === selectedId || src.id === selectedId2}
                {...sharedRename} renaming={renameId === src.id}
                onClick={() => {}}
                onRename={() => { setRenameId(src.id); setRenameValue(src.label || src.raw || '') }}
                onRemove={() => removeSource(src.id)}
                paneButtons={{
                  active1: selectedId  === src.id,
                  active2: selectedId2 === src.id,
                  onSet1: e => { e.stopPropagation(); if (selectedId  === src.id) setSelectedId(null);  else openDocInPane(1, src.id) },
                  onSet2: e => { e.stopPropagation(); if (selectedId2 === src.id) setSelectedId2(null); else openDocInPane(2, src.id) },
                }}
              />
            ))}
            {/* Divider between docs and pages in "All" view */}
            {filter === 'all' && fileSources.length > 0 && siteSources.length > 0 && (
              <div style={{ height: '1px', background: '#171817', margin: '4px 0', flexShrink: 0 }} />
            )}
            {showPages && siteSources.map(src => (
              <StackRow key={src.id} src={src} isActive={view1Page?.srcId === src.id || view2Page?.srcId === src.id}
                {...sharedRename} renaming={renameId === src.id}
                onClick={() => src.raw && window.dispatchEvent(new CustomEvent('proof:browser-navigate', { detail: src.raw }))}
                onRename={() => { setRenameId(src.id); setRenameValue(src.label || src.raw || '') }}
                onRemove={() => removeSource(src.id)}
                pinButtons={{
                  active1: view1Page?.srcId === src.id,
                  active2: view2Page?.srcId === src.id,
                  onPin1: () => { if (view1Page?.srcId === src.id) clearView(1); else pinPageToView(1, src) },
                  onPin2: () => { if (view2Page?.srcId === src.id) clearView(2); else pinPageToView(2, src) },
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


function getMetaLine(src: QueuedSource): string {
  if (src.fileType === 'url') {
    try { return new URL(src.raw).hostname.replace(/^www\./, '') } catch { return src.raw }
  }
  if (src.fileType === 'note') return 'Note'
  if (src.fileType === 'image') return 'Image'
  const type = src.fileType === 'pdf' ? 'PDF' : 'Document'
  if (src.status === 'queued')     return `${type} · Queued`
  if (src.status === 'extracting') return `${type} · Reading…`
  if (src.status === 'error')      return `${type} · Error`
  return type
}


function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{
      flex: 1, background: 'transparent',
      padding: '12px 14px', fontSize: '11px', color: '#8A8780',
      letterSpacing: '0.02em', lineHeight: 1.55, userSelect: 'none',
    }}>
      {text}
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

function StackRow({
  src, isActive,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  onClick, onRename, onRemove, paneButtons, pinButtons,
}: {
  src: QueuedSource
  isActive: boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onClick: () => void
  onRename: () => void
  onRemove: () => void
  paneButtons?: { active1: boolean; active2: boolean; onSet1: (e: React.MouseEvent) => void; onSet2: (e: React.MouseEvent) => void }
  pinButtons?: { active1?: boolean; active2?: boolean; onPin1: () => void; onPin2: () => void }
}) {
  const [hov,   setHov]   = useState(false)
  const [armed, setArmed] = useState(false)
  const label = src.label || src.raw
  const meta  = getMetaLine(src)
  const show  = hov && !renaming

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!armed) { setArmed(true); return }
    setArmed(false)
    onRemove()
  }

  return (
    <div
      onClick={() => { if (!renaming) onClick() }}
      onDoubleClick={() => { if (!renaming) onRename() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setArmed(false) }}
      draggable={!renaming}
      onDragStart={e => { e.dataTransfer.setData('application/x-proof-source-id', src.id); e.dataTransfer.effectAllowed = 'move' }}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 10px 8px 14px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: armed ? 'rgba(196,107,90,0.05)' : isActive ? '#171817' : hov ? '#171817' : 'transparent',
        borderLeft: `2px solid ${armed ? 'rgba(196,107,90,0.18)' : isActive ? '#9b9892' : hov ? '#232523' : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Title — wraps freely */}
        {renaming ? (
          <textarea autoFocus spellCheck={false}
            value={renameValue}
            ref={el => { if (el) { el.style.height = '0px'; el.style.height = el.scrollHeight + 'px' } }}
            onChange={e => { onRenameChange(e.target.value); e.target.style.height = '0px'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onFocus={e => e.target.select()}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            onBlur={onRenameCommit}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() } if (e.key === 'Escape') onRenameCancel() }}
            rows={1}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent', border: 'none', outline: 'none',
              margin: 0, padding: 0, resize: 'none', overflow: 'hidden',
              fontSize: '12px', lineHeight: '1.45', color: '#8A8780',
              fontFamily: 'inherit', letterSpacing: '0.01em',
              WebkitAppearance: 'none',
            } as React.CSSProperties}
          />
        ) : (
          <div style={{
            fontSize: '12px', lineHeight: '1.45', letterSpacing: '0.01em',
            color: isActive ? '#8A8780' : hov ? '#8A8780' : '#8A8780',
            wordBreak: 'break-word', transition: 'color 0.1s',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {label}
          </div>
        )}

        {/* Bottom row — 1/2 or confirm + × */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', minHeight: '18px', gap: '3px' }}>
          {armed ? (
            <span style={{ fontSize: '10px', color: '#c46b5a', letterSpacing: '0.02em', flexShrink: 0 }}>Remove?</span>
          ) : (
            <div
              onDoubleClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', opacity: show || isActive || renaming ? 1 : 0, pointerEvents: show || isActive || renaming ? 'auto' : 'none', transition: 'opacity 0.12s' }}>
              {paneButtons && (
                <>
                  <ActionBtn label={<MonoNum n={1} />} title="View 1" active={paneButtons.active1} onClick={paneButtons.onSet1} />
                  <ActionBtn label={<MonoNum n={2} />} title="View 2" active={paneButtons.active2} onClick={paneButtons.onSet2} />
                </>
              )}
              {pinButtons && (
                <>
                  <ActionBtn label={<MonoNum n={1} />} title="View 1" active={!!pinButtons.active1} onClick={e => { e.stopPropagation(); pinButtons.onPin1() }} />
                  <ActionBtn label={<MonoNum n={2} />} title="View 2" active={!!pinButtons.active2} onClick={e => { e.stopPropagation(); pinButtons.onPin2() }} />
                </>
              )}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button
            title="Remove"
            onClick={handleRemoveClick}
            onDoubleClick={e => e.stopPropagation()}
            style={{ flexShrink: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', lineHeight: 0, color: armed ? '#c46b5a' : '#8A8780', opacity: armed || show || isActive || renaming ? 1 : 0, pointerEvents: armed || show || isActive || renaming ? 'auto' : 'none', transition: 'opacity 0.12s, color 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.color = armed ? '#d27b6a' : '#8A8780')}
            onMouseLeave={e => (e.currentTarget.style.color = armed ? '#c46b5a' : '#8A8780')}>
            <svg width="8" height="8" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M1 1L8 8M8 1L1 8" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function MonoNum({ n }: { n: 1 | 2 }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1, fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace', letterSpacing: 0 }}>{n}</span>
  )
}

function ActionBtn({ label, title, active, onClick }: {
  label: React.ReactNode; title: string; active: boolean; onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: '22px', height: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#232523' : hov ? '#232523' : 'none',
        border: `1px solid ${active ? '#8A8780' : hov ? '#9b9892' : '#232523'}`,
        borderRadius: '3px', padding: 0, outline: 'none',
        color: active ? '#8A8780' : hov ? '#8A8780' : '#8A8780',
        fontSize: '10px', cursor: 'pointer',
        transition: 'color 0.1s, background 0.1s, border-color 0.1s',
        fontFamily: 'inherit',
      }}>
      {label}
    </button>
  )
}
