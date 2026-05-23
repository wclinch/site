'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import type { Project } from '@/lib/types'
import { notify } from './NotificationsPanel'

export default function ProjectBar({ askSiteOpen = false }: { askSiteOpen?: boolean }) {
  const {
    projects, activeId,
    switchWorkspace, newWorkspace, removeWorkspace,
    removeWorkspaceSoft, addSourceToSession, addUrlToSession, removeSourceFromProject,
    allSources, updateProject, setProjects,
  } = useApp()

  const [editingProjId,  setEditingProjId]  = useState<string | null>(null)
  const [nameInput,      setNameInput]      = useState('')
  const [draggedId,      setDraggedId]      = useState<string | null>(null)
  const [dragOverId,     setDragOverId]     = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<string | null>(null)
  const [peekHoverId,    setPeekHoverId]    = useState<string | null>(null)
  const [isDragActive,   setIsDragActive]   = useState(false)

  const rmTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)  // kept for compat, unused
  const tabStripRef         = useRef<HTMLDivElement>(null)
  const cancelEditRef       = useRef(false)
  const isDragActiveRef     = useRef(false)
  const originalSessionRef  = useRef<string | null>(null)
  const hoverPeekRef        = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  const activeIdRef         = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  function handleSessionDrop(e: React.DragEvent, toProjectId: string) {
    e.preventDefault()
    setTransferTarget(null)
    if (toProjectId === activeId) return

    const srcId = e.dataTransfer.getData('application/x-proof-source-id')
    if (srcId) {
      const name = addSourceToSession(srcId, toProjectId)
      if (name) {
        const label = allSources.find(s => s.id === srcId)?.label || 'Source'
        notify('Added', () => removeSourceFromProject(srcId, toProjectId))
      }
      return
    }

    const webRaw = e.dataTransfer.getData('application/x-proof-web-url')
    if (webRaw) {
      try {
        const { url, title } = JSON.parse(webRaw)
        const result = addUrlToSession(toProjectId, url, title)
        if (result) notify('Added', () => removeSourceFromProject(result.srcId, toProjectId))
      } catch {}
    }
  }

  function isTransferDrag(e: React.DragEvent) {
    return e.dataTransfer.types.includes('application/x-proof-source-id') ||
           e.dataTransfer.types.includes('application/x-proof-web-url')
  }

  // Scroll active tab into view on workspace switch
  useEffect(() => {
    const strip = tabStripRef.current
    if (!strip) return
    const active = strip.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeId])

  // Redirect vertical wheel → horizontal scroll
  useEffect(() => {
    const el = tabStripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Hover-to-peek drag events
  useEffect(() => {
    const onActive = (e: Event) => {
      isDragActiveRef.current = true
      setIsDragActive(true)
      originalSessionRef.current = (e as CustomEvent).detail?.originalSessionId ?? activeIdRef.current
    }
    const onDone = (e: Event) => {
      isDragActiveRef.current = false
      setIsDragActive(false)
      setTransferTarget(null)
      setDragOverId(null)
      const { canceled } = (e as CustomEvent).detail
      if (canceled && originalSessionRef.current && originalSessionRef.current !== activeIdRef.current) {
        switchWorkspace(originalSessionRef.current)
      }
      originalSessionRef.current = null
      if (hoverPeekRef.current) { clearTimeout(hoverPeekRef.current.timer); hoverPeekRef.current = null }
      setPeekHoverId(null)
    }
    // Fallback: clear visual drag state when any drag ends/drops anywhere on the page.
    // This handles the case where the drag source unmounts (peek-switch) so dragend never
    // fires on it, leaving proof:drag-done undispatched and transferTarget stuck.
    const clearVisual = () => {
      setTransferTarget(null)
      setDragOverId(null)
      setIsDragActive(false)
      isDragActiveRef.current = false
      if (hoverPeekRef.current) { clearTimeout(hoverPeekRef.current.timer); hoverPeekRef.current = null }
      setPeekHoverId(null)
    }
    window.addEventListener('proof:drag-active', onActive)
    window.addEventListener('proof:drag-done', onDone)
    document.addEventListener('dragend', clearVisual, true)
    document.addEventListener('drop', clearVisual, true)
    return () => {
      window.removeEventListener('proof:drag-active', onActive)
      window.removeEventListener('proof:drag-done', onDone)
      document.removeEventListener('dragend', clearVisual, true)
      document.removeEventListener('drop', clearVisual, true)
    }
  }, [switchWorkspace])

  function startEditing(projId: string, currentName: string) {
    cancelEditRef.current = false
    setNameInput(currentName)
    setEditingProjId(projId)
    if (rmTimerRef.current) { clearTimeout(rmTimerRef.current); rmTimerRef.current = null }
  }

  function nextUntitledName() {
    const used = new Set(projects.map(p => p.name))
    if (!used.has('New Session')) return 'New Session'
    for (let i = 2; i <= projects.length + 2; i++) {
      const candidate = `New Session ${i}`
      if (!used.has(candidate)) return candidate
    }
    return 'New Session'
  }

  function reorderProjects(fromId: string, toId: string) {
    if (fromId === toId) return
    setProjects(ps => {
      const from = ps.findIndex(p => p.id === fromId)
      const to   = ps.findIndex(p => p.id === toId)
      if (from === -1 || to === -1) return ps
      const next = [...ps]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }

  function commitRename(projId: string) {
    const name = nameInput.trim()
    setEditingProjId(null)
    updateProject(projId, { name: name || nextUntitledName() })
  }

  function handleRemoveClick(e: React.MouseEvent, projId: string) {
    e.stopPropagation()
    const proj = projects.find(p => p.id === projId)
    const insertIdx = projects.findIndex(p => p.id === projId)
    if (!proj) return
    removeWorkspaceSoft(projId)
    window.dispatchEvent(new CustomEvent('proof:session-removed', { detail: { proj, insertIdx } }))
  }


  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: '60px', flexShrink: 0,
      borderBottom: `1px solid ${askSiteOpen ? 'rgba(230,226,216,0.4)' : 'rgba(230,226,216,0.1)'}`,
      transition: 'border-color 0.3s ease',
      WebkitAppRegion: 'drag',
      overflow: 'hidden',
    } as React.CSSProperties}>

      {/* ── Left: sidebar toggle + tab strip + new workspace ── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        paddingLeft: '20px',
      }}>

        {/* Tab strip — outer div stays draggable; individual tabs are no-drag */}
        <div
          ref={tabStripRef}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center',
            overflowX: 'auto', overflowY: 'hidden', gap: '2px',
            scrollbarWidth: 'none',
          } as React.CSSProperties}
        >
          {projects.map(p => {
            const isActive  = p.id === activeId
            const isEditing = p.id === editingProjId

            if (isEditing) {
              return (
                <input
                  key={p.id}
                  autoFocus
                  spellCheck={false}
                  value={nameInput}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { commitRename(p.id) }
                    if (e.key === 'Escape') { cancelEditRef.current = true; setEditingProjId(null) }
                  }}
                  onBlur={() => { if (!cancelEditRef.current) commitRename(p.id) }}
                  placeholder="Session name"
                  style={{
                    height: '36px', padding: '0 12px', flexShrink: 0,
                    background: '#151615', border: '1px solid rgba(230,226,216,0.1)',
                    borderRadius: '4px', color: '#E6E2D8',
                    fontSize: '13px', letterSpacing: '0.01em',
                    fontFamily: 'inherit', outline: 'none', width: '140px',
                  }}
                />
              )
            }

            return (
              <WorkspaceTab
                key={p.id}
                name={p.name || 'New Session'}
                active={isActive}
                canRemove={projects.length > 1}
                dragOver={dragOverId === p.id && draggedId !== p.id}
                transferTarget={transferTarget === p.id}
                peeking={peekHoverId === p.id}
                validTarget={isDragActive && !isActive}
                peekPending={peekHoverId === p.id}
                onClick={() => { if (!isActive) switchWorkspace(p.id) }}
                onDoubleClick={() => startEditing(p.id, p.name || '')}
                onRemoveClick={e => handleRemoveClick(e, p.id)}
                onDragStart={() => setDraggedId(p.id)}
                onDragOver={e => {
                  if (isTransferDrag(e) && !isActive) {
                    e.preventDefault()
                    setTransferTarget(p.id)
                    if (isDragActiveRef.current) {
                      if (!hoverPeekRef.current || hoverPeekRef.current.id !== p.id) {
                        if (hoverPeekRef.current) clearTimeout(hoverPeekRef.current.timer)
                        setPeekHoverId(p.id)
                        hoverPeekRef.current = {
                          id: p.id,
                          timer: setTimeout(() => {
                            switchWorkspace(p.id)
                            hoverPeekRef.current = null
                            setPeekHoverId(null)
                          }, 600),
                        }
                      }
                    }
                  } else {
                    setDragOverId(p.id)
                  }
                }}
                onDragLeave={() => {
                  setTransferTarget(null)
                  if (hoverPeekRef.current?.id === p.id) {
                    clearTimeout(hoverPeekRef.current.timer)
                    hoverPeekRef.current = null
                    setPeekHoverId(null)
                  }
                }}
                onDrop={e => {
                  if (isTransferDrag(e)) { handleSessionDrop(e, p.id) }
                  else if (draggedId) { reorderProjects(draggedId, p.id) }
                  setDragOverId(null)
                }}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); setTransferTarget(null) }}
              />
            )
          })}
          {/* New workspace — at end of tab strip */}
          <button
            onClick={() => newWorkspace()}
            title="New session"
            style={{
              width: '24px', height: '24px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none',
              color: 'rgba(230,226,216,0.45)', cursor: 'pointer', padding: 0, outline: 'none',
              transition: 'color 0.15s', marginLeft: '2px',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.45)' }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right: notifications + account ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 14px 0 8px', gap: '0', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <div style={{ width: '1px', height: '14px', background: 'rgba(230,226,216,0.2)', marginRight: '2px', flexShrink: 0 }} />
        <RightBtn onClick={() => window.dispatchEvent(new Event('proof:show-account'))}>
          Account
        </RightBtn>
      </div>
    </div>
  )
}

// ─── Workspace tab ────────────────────────────────────────────────────────────

function WorkspaceTab({ name, active, canRemove, dragOver, transferTarget, peeking, validTarget, peekPending, onClick, onDoubleClick, onRemoveClick, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }: {
  name: string
  active: boolean
  canRemove: boolean
  dragOver: boolean
  transferTarget?: boolean
  peeking?: boolean
  validTarget?: boolean
  peekPending?: boolean
  onClick: () => void
  onDoubleClick: () => void
  onRemoveClick: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [xHovered, setXHovered] = useState(false)
  const [armed,    setArmed]    = useState(false)

  function handleXClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!armed) { setArmed(true); return }
    setArmed(false)
    onRemoveClick(e)
  }

  return (
    <div
      data-active={active}
      draggable
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setArmed(false) }}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={e => { e.preventDefault(); onDragOver(e) }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(e) }}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', alignItems: 'center',
        height: '36px',
        padding: '0 8px 0 12px',
        flexShrink: 0, gap: '4px',
        background: active ? '#151615' : hovered ? '#151615' : 'transparent',
        border: `1px solid ${peeking ? 'rgba(230,226,216,0.65)' : transferTarget ? 'rgba(230,226,216,0.65)' : dragOver ? 'rgba(230,226,216,0.65)' : peekPending && !transferTarget ? 'rgba(230,226,216,0.45)' : validTarget && !transferTarget ? 'rgba(230,226,216,0.1)' : active ? 'rgba(230,226,216,0.1)' : hovered ? 'rgba(230,226,216,0.1)' : 'transparent'}`,
        borderRadius: '4px',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'background 0.1s, border-color 0.1s',
        WebkitAppRegion: 'no-drag',
        maxWidth: '200px',
      } as React.CSSProperties}
    >
      <span style={{
        fontSize: '13px', letterSpacing: '0.01em',
        color: active ? '#E6E2D8' : hovered ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, minWidth: 0,
        transition: 'color 0.1s',
        textDecoration: armed ? 'line-through' : 'none',
        opacity: armed ? 0.5 : 1,
      }}>
        {name}
      </span>

      {canRemove && (
        <button
          onClick={handleXClick}
          onDoubleClick={e => e.stopPropagation()}
          title={armed ? 'Confirm close' : 'Close'}
          onMouseEnter={() => setXHovered(true)}
          onMouseLeave={() => setXHovered(false)}
          style={{
            width: '20px', height: '20px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: '3px',
            color: armed ? '#E6E2D8' : xHovered ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
            cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
            opacity: hovered || active ? 1 : 0,
            pointerEvents: hovered || active ? 'auto' : 'none',
            transition: 'color 0.1s, opacity 0.12s',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1 1L8 8M8 1L1 8" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Right-cluster button ────────────────────────────────────────────────────

function RightBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '32px', padding: '0 9px',
        background: 'none', border: 'none', borderRadius: '3px',
        color: active || hov ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        fontSize: '13px', letterSpacing: '0.02em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
