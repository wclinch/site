'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { QueuedSource, Project } from '@/lib/types'
import { notify } from './NotificationsPanel'

// ─── SourceStack ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'docs' | 'pages'


export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, patchSource, uploadFiles,
    openInView, viewTabs, activeViewTabId,
    removeSource,
    restoreArchivedSource, commitWorkspaceRemoval, restoreWorkspace, activeId,
    setProjects,
    addSourceToSession, addUrlToSession, removeSourceFromProject, allSources, projects,
  } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [dragSrcId,    setDragSrcId]    = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [isDragActive,  setIsDragActive]  = useState(false)
  const [shelfDragOver, setShelfDragOver] = useState(false)

  function handleSourceReorder(fromId: string, toId: string) {
    if (fromId === toId || !activeId) return
    setProjects(ps => ps.map(p => {
      if (p.id !== activeId) return p
      const sources = [...p.sources]
      const from = sources.findIndex(s => s.id === fromId)
      const to   = sources.findIndex(s => s.id === toId)
      if (from === -1 || to === -1) return p
      sources.splice(to, 0, sources.splice(from, 1)[0])
      return { ...p, sources }
    }))
  }

  const [renameId,    setRenameId]    = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function handleRemove(src: QueuedSource) {
    removeSource(src.id)
    const pid = activeId ?? ''
    notify('Deleted', () => restoreArchivedSource(src.id, pid))
  }

  useEffect(() => {
    function onSessionRemoved(e: Event) {
      const { proj, insertIdx } = (e as CustomEvent).detail
      let undone = false
      notify('Deleted session', () => {
        undone = true
        restoreWorkspace(proj, insertIdx)
      })
      setTimeout(() => { if (!undone) commitWorkspaceRemoval(proj) }, 4000)
    }
    window.addEventListener('proof:session-removed', onSessionRemoved)
    return () => window.removeEventListener('proof:session-removed', onSessionRemoved)
  }, [])

  useEffect(() => {
    const onActive = () => setIsDragActive(true)
    const onDone   = () => { setIsDragActive(false); setShelfDragOver(false) }
    window.addEventListener('proof:drag-active', onActive)
    window.addEventListener('proof:drag-done',   onDone)
    return () => {
      window.removeEventListener('proof:drag-active', onActive)
      window.removeEventListener('proof:drag-done',   onDone)
    }
  }, [])

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
    <div
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: `1px solid ${shelfDragOver ? 'rgba(230,226,216,0.45)' : 'rgba(230,226,216,0.1)'}`, borderRadius: '4px', background: '#070807', position: 'relative',
        transition: 'border-color 0.1s',
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('application/x-proof-source-id') ||
            e.dataTransfer.types.includes('application/x-proof-web-url')) {
          e.preventDefault()
          setShelfDragOver(true)
        }
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setShelfDragOver(false)
      }}
      onDrop={e => {
        setShelfDragOver(false)
        const srcId = e.dataTransfer.getData('application/x-proof-source-id')
        if (srcId && activeId) {
          addSourceToSession(srcId, activeId)
          const proj = projects.find(p => p.id === activeId)
          const label = allSources.find(s => s.id === srcId)?.label || 'Source'
          const pid = activeId
          notify('Added', () => removeSourceFromProject(srcId, pid))
          return
        }
        const webRaw = e.dataTransfer.getData('application/x-proof-web-url')
        if (webRaw && activeId) {
          try {
            const { url, title } = JSON.parse(webRaw)
            const result = addUrlToSession(activeId, url, title)
            if (result) {
              const pid = activeId
              notify('Added', () => removeSourceFromProject(result.srcId, pid))
            }
          } catch {}
        }
      }}
    >
      {/* ── Header: filter tabs + add button ── */}
      <div style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 10px', gap: '0',
        background: '#070807', borderBottom: '1px solid rgba(230,226,216,0.1)',
        userSelect: 'none',
      }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
          {(['all', 'docs', 'pages'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                height: '34px', padding: '0 14px',
                background: filter === f ? '#151615' : 'none',
                border: `1px solid ${filter === f ? '#151615' : 'transparent'}`,
                borderRadius: '4px', cursor: 'pointer', outline: 'none',
                fontSize: '13px', letterSpacing: '0.01em',
                color: filter === f ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
                fontFamily: 'inherit', transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { if (filter !== f) e.currentTarget.style.color = '#E6E2D8' }}
              onMouseLeave={e => { if (filter !== f) e.currentTarget.style.color = 'rgba(230,226,216,0.65)' }}
            >
              {f === 'all' ? 'All' : f === 'docs' ? 'Documents' : 'Pages'}
            </button>
          ))}
        </div>
        {/* Add document */}
        {(filter === 'all' || filter === 'docs') && (
          <>
            <button onClick={() => fileInputRef.current?.click()} title="Add Document"
              style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: 'rgba(230,226,216,0.65)', lineHeight: 0, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.65)' }}>
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
          <EmptyRow text={filter === 'docs' ? 'No documents.' : filter === 'pages' ? 'No saved pages.' : 'Nothing here yet.'} />
        ) : (
          <>
            {showDocs && fileSources.map(src => {
              const activeTab = viewTabs.find(t => t.id === activeViewTabId)
              const isInView = activeTab?.srcId === src.id
              return (
              <StackRow key={src.id} src={src} isActive={isInView}
                {...sharedRename} renaming={renameId === src.id}
                dropBefore={dropTargetId === src.id && dragSrcId !== src.id}
                onClick={() => openInView(src.id)}
                onRename={() => { setRenameId(src.id); setRenameValue(src.label || src.raw || '') }}
                onRemove={() => handleRemove(src)}
                onDragStart={e => {
                  const ghost = document.createElement('div')
                  ghost.textContent = (src.label || src.raw || 'Source').slice(0, 40)
                  Object.assign(ghost.style, {
                    position: 'fixed', top: '-1000px', left: '-1000px',
                    background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '4px',
                    padding: '5px 12px', fontSize: '12px', color: '#E6E2D8',
                    fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  })
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 14, 14)
                  setTimeout(() => ghost.remove(), 0)
                  setDragSrcId(src.id)
                  window.dispatchEvent(new CustomEvent('proof:drag-active', { detail: { originalSessionId: activeId } }))
                }}
                onDragOver={() => setDropTargetId(src.id)}
                onDragEnd={e => {
                  setDragSrcId(null); setDropTargetId(null)
                  window.dispatchEvent(new CustomEvent('proof:drag-done', { detail: { canceled: e.dataTransfer.dropEffect === 'none' } }))
                }}
                onDrop={() => { if (dragSrcId) handleSourceReorder(dragSrcId, src.id); setDragSrcId(null); setDropTargetId(null) }}
              />
              )
            })}
            {/* Divider between docs and pages in "All" view */}
            {filter === 'all' && fileSources.length > 0 && siteSources.length > 0 && (
              <div style={{ height: '1px', background: 'rgba(230,226,216,0.15)', margin: '4px 0', flexShrink: 0 }} />
            )}
            {showPages && siteSources.map(src => {
              const srcUrl = src.url ?? src.raw
              const activeTab = viewTabs.find(t => t.id === activeViewTabId)
              const isInView = activeTab?.srcId === src.id || activeTab?.url === srcUrl
              return (
              <StackRow key={src.id} src={src} isActive={isInView}
                {...sharedRename} renaming={renameId === src.id}
                dropBefore={dropTargetId === src.id && dragSrcId !== src.id}
                onClick={() => src.raw && window.dispatchEvent(new CustomEvent('proof:browser-navigate', { detail: src.raw }))}
                onRename={() => { setRenameId(src.id); setRenameValue(src.label || src.raw || '') }}
                onRemove={() => handleRemove(src)}
                onDragStart={e => {
                  const ghost = document.createElement('div')
                  ghost.textContent = (src.label || src.raw || 'Source').slice(0, 40)
                  Object.assign(ghost.style, {
                    position: 'fixed', top: '-1000px', left: '-1000px',
                    background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '4px',
                    padding: '5px 12px', fontSize: '12px', color: '#E6E2D8',
                    fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  })
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 14, 14)
                  setTimeout(() => ghost.remove(), 0)
                  setDragSrcId(src.id)
                  window.dispatchEvent(new CustomEvent('proof:drag-active', { detail: { originalSessionId: activeId } }))
                }}
                onDragOver={() => setDropTargetId(src.id)}
                onDragEnd={e => {
                  setDragSrcId(null); setDropTargetId(null)
                  window.dispatchEvent(new CustomEvent('proof:drag-done', { detail: { canceled: e.dataTransfer.dropEffect === 'none' } }))
                }}
                onDrop={() => { if (dragSrcId) handleSourceReorder(dragSrcId, src.id); setDragSrcId(null); setDropTargetId(null) }}
              />
              )
            })}
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
  const isAll   = text === 'Nothing here yet.'
  const isPages = text === 'No saved pages.'

  type Line = { t: string; dim?: boolean }
  const lines: Line[] = isAll ? [
    { t: 'PDFs, images, notes, saved pages.' },
    { t: 'Add with + or drop onto the View.', dim: true },
    { t: 'Bookmark pages from the browser.', dim: true },
  ] : isPages ? [
    { t: 'No saved pages yet.', dim: true },
    { t: 'Bookmark pages from the browser.', dim: true },
  ] : [
    { t: text, dim: true },
  ]

  return (
    <div style={{
      flex: 1, background: 'transparent',
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'flex-start',
      padding: '16px 14px 24px',
      userSelect: 'none', gap: '5px',
    }}>
      {lines.map(({ t, dim }, i) => (
        <span key={i} style={{
          fontSize: '11px',
          color: dim ? 'rgba(230,226,216,0.22)' : 'rgba(230,226,216,0.38)',
          letterSpacing: '0.01em', lineHeight: 1.65,
        }}>
          {t}
        </span>
      ))}
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

function StackRow({
  src, isActive, dropBefore,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  onClick, onRename, onRemove, onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  src: QueuedSource
  isActive: boolean
  dropBefore?: boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onClick: () => void
  onRename: () => void
  onRemove: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: () => void
  onDragEnd?: (e: React.DragEvent) => void
  onDrop?: () => void
}) {
  const [hov,   setHov]   = useState(false)
  const [armed, setArmed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const label = src.label || src.raw
  const meta  = getMetaLine(src)
  const show  = hov && !renaming

  useLayoutEffect(() => {
    if (renaming && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
      el.select()
    }
  }, [renaming])

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
      onDragStart={e => {
        e.dataTransfer.setData('application/x-proof-source-id', src.id)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStart?.(e)
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('application/x-proof-source-id')) {
          e.preventDefault(); e.stopPropagation(); onDragOver?.()
        }
      }}
      onDragEnd={e => onDragEnd?.(e)}
      onDrop={e => {
        if (e.dataTransfer.types.includes('application/x-proof-source-id')) {
          e.preventDefault(); e.stopPropagation(); onDrop?.()
        }
      }}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 8px 10px 14px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: isActive ? '#151615' : hov ? '#151615' : 'transparent',
        borderTop: dropBefore ? '1px solid rgba(230,226,216,0.65)' : '1px solid transparent',
        borderRight: '1px solid transparent',
        borderBottom: '1px solid transparent',
        borderLeft: `2px solid ${dropBefore ? 'rgba(230,226,216,0.65)' : isActive ? 'rgba(230,226,216,0.65)' : hov ? '#151615' : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <textarea
            ref={textareaRef}
            rows={1}
            spellCheck={false}
            value={renameValue}
            onChange={e => {
              onRenameChange(e.target.value.replace(/\n/g, ''))
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            onBlur={onRenameCommit}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() }
              if (e.key === 'Escape') onRenameCancel()
            }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent',
              border: 'none', borderBottom: '1px solid rgba(230,226,216,0.35)',
              outline: 'none',
              margin: 0, padding: 0,
              resize: 'none', overflow: 'hidden',
              fontSize: '12px', lineHeight: '1.45', color: '#E6E2D8',
              fontFamily: 'inherit', letterSpacing: '0.01em',
              WebkitAppearance: 'none', display: 'block',
            } as React.CSSProperties}
          />
        ) : (
          <div style={{
            fontSize: '12px', lineHeight: '1.45', letterSpacing: '0.01em',
            color: '#E6E2D8',
            wordBreak: 'break-word',
            opacity: armed ? 0.4 : 1,
            textDecoration: armed ? 'line-through' : 'none',
            transition: 'opacity 0.15s',
            display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {label}
          </div>
        )}
      </div>

      {/* Inline actions — right side */}
      <div
        onDoubleClick={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, marginLeft: '6px', opacity: armed || show || isActive || renaming ? 1 : 0, pointerEvents: armed || show || isActive || renaming ? 'auto' : 'none', transition: 'opacity 0.12s' }}>
        <button
          title="Remove"
          onClick={handleRemoveClick}
          onDoubleClick={e => e.stopPropagation()}
          style={{ flexShrink: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', lineHeight: 0, color: armed ? '#E6E2D8' : 'rgba(230,226,216,0.65)', transition: 'color 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E6E2D8')}
          onMouseLeave={e => (e.currentTarget.style.color = armed ? '#E6E2D8' : 'rgba(230,226,216,0.65)')}>
          <svg width="8" height="8" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1 1L8 8M8 1L1 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

