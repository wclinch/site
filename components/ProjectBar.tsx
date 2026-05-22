'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'

export default function ProjectBar() {
  const {
    projects, activeId,
    switchWorkspace, newWorkspace, removeWorkspace,
    updateProject, setProjects,
  } = useApp()

  const [editingProjId, setEditingProjId] = useState<string | null>(null)
  const [nameInput,     setNameInput]     = useState('')
  const [pendingRmId,   setPendingRmId]   = useState<string | null>(null)
  const [draggedId,     setDraggedId]     = useState<string | null>(null)
  const [dragOverId,    setDragOverId]    = useState<string | null>(null)

  const rmTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabStripRef   = useRef<HTMLDivElement>(null)
  const cancelEditRef = useRef(false)

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

  // Cancel pending × confirm when clicking elsewhere
  useEffect(() => {
    if (!pendingRmId) return
    const handler = () => setPendingRmId(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [pendingRmId])

  function startEditing(projId: string, currentName: string) {
    cancelEditRef.current = false
    setNameInput(currentName)
    setEditingProjId(projId)
    setPendingRmId(null)
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
    if (pendingRmId !== projId) {
      setPendingRmId(projId)
      if (rmTimerRef.current) clearTimeout(rmTimerRef.current)
      rmTimerRef.current = setTimeout(() => setPendingRmId(null), 1800)
    } else {
      if (rmTimerRef.current) { clearTimeout(rmTimerRef.current); rmTimerRef.current = null }
      setPendingRmId(null)
      removeWorkspace(projId)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: '52px', flexShrink: 0,
      borderBottom: '1px solid #1e1e1e',
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
            const rmArmed   = pendingRmId === p.id

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
                    height: '26px', padding: '0 10px', flexShrink: 0,
                    background: '#171817', border: '1px solid #232523',
                    borderRadius: '4px', color: '#8A8780',
                    fontSize: '11px', letterSpacing: '0.03em',
                    fontFamily: 'inherit', outline: 'none', minWidth: '140px',
                  }}
                />
              )
            }

            return (
              <WorkspaceTab
                key={p.id}
                name={p.name || 'New Session'}
                active={isActive}
                rmArmed={rmArmed}
                canRemove={projects.length > 1}
                dragOver={dragOverId === p.id && draggedId !== p.id}
                onClick={() => { if (!isActive) switchWorkspace(p.id) }}
                onDoubleClick={() => startEditing(p.id, p.name || '')}
                onRemoveClick={e => handleRemoveClick(e, p.id)}
                onDragStart={() => setDraggedId(p.id)}
                onDragOver={() => setDragOverId(p.id)}
                onDrop={() => { if (draggedId) reorderProjects(draggedId, p.id) }}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
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
              color: '#8A8780', cursor: 'pointer', padding: 0, outline: 'none',
              transition: 'color 0.15s', marginLeft: '2px',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={e => { e.currentTarget.style.color = '#8A8780' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8A8780' }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right: account ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 14px 0 8px', gap: '0', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <div style={{ width: '1px', height: '14px', background: '#232523', marginRight: '2px', flexShrink: 0 }} />
        <RightBtn onClick={() => window.dispatchEvent(new Event('proof:show-account'))}>
          Account
        </RightBtn>
      </div>
    </div>
  )
}

// ─── Workspace tab ────────────────────────────────────────────────────────────

function WorkspaceTab({ name, active, rmArmed, canRemove, dragOver, onClick, onDoubleClick, onRemoveClick, onDragStart, onDragOver, onDrop, onDragEnd }: {
  name: string
  active: boolean
  rmArmed: boolean
  canRemove: boolean
  dragOver: boolean
  onClick: () => void
  onDoubleClick: () => void
  onRemoveClick: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [xHovered, setXHovered] = useState(false)

  const xColor = rmArmed ? (xHovered ? '#d27b6a' : '#c46b5a') : xHovered ? '#8A8780' : '#8A8780'

  return (
    <div
      data-active={active}
      draggable
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', alignItems: 'center',
        height: '30px',
        padding: '0 6px 0 10px',
        flexShrink: 0, gap: '4px',
        background: rmArmed ? 'rgba(196,107,90,0.05)' : active ? '#171817' : hovered ? '#171817' : 'transparent',
        border: `1px solid ${rmArmed ? 'rgba(196,107,90,0.18)' : dragOver ? '#8A8780' : active ? '#9b9892' : 'transparent'}`,
        borderRadius: '4px',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'background 0.1s, border-color 0.1s',
        WebkitAppRegion: 'no-drag',
        maxWidth: '200px',
      } as React.CSSProperties}
    >
      <span style={{
        fontSize: '11px', letterSpacing: '0.03em',
        color: active ? '#E6E2D8' : hovered ? '#E6E2D8' : '#8A8780',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, minWidth: 0,
        transition: 'color 0.1s',
      }}>
        {name}
      </span>

      {canRemove && (
        <button
            onClick={onRemoveClick}
            onDoubleClick={e => e.stopPropagation()}
            title={rmArmed ? 'Click again to remove' : 'Close'}
            onMouseEnter={() => setXHovered(true)}
            onMouseLeave={() => setXHovered(false)}
            style={{
              width: '20px', height: '20px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: '3px',
              color: xColor,
              cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
              transition: 'color 0.1s',
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

function RightBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '28px', padding: '0 7px',
        background: 'none', border: 'none', borderRadius: '3px',
        color: hov ? '#E6E2D8' : '#8A8780',
        fontSize: '11px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
