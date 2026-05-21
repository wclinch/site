'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import StorageBadge from './StorageBadge'

export default function ProjectBar() {
  const {
    projects, activeId,
    user, isPro,
    switchWorkspace, newWorkspace, pinWorkspace, removeWorkspace,
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
    for (let i = 1; i <= projects.length + 1; i++) {
      const candidate = `Untitled-${String(i).padStart(2, '0')}`
      if (!used.has(candidate)) return candidate
    }
    return 'Untitled'
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

  const tierLabel = isPro ? 'Pro' : 'Free'

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: '44px', flexShrink: 0,
      borderBottom: '1px solid #161616',
      WebkitAppRegion: 'drag',
      overflow: 'hidden',
    } as React.CSSProperties}>

      {/* ── Left: tab strip + new workspace ── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        paddingLeft: '8px',
      }}>

        {/* Logo — links back to landing */}
        <a
          href="/"
          aria-label="Site"
          style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            textDecoration: 'none', lineHeight: 1,
            padding: '0 10px 0 4px',
            opacity: 0.5, transition: 'opacity 0.15s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        >
          <svg width="16" height="16" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
          </svg>
        </a>

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
          {(() => {
            const pinned   = projects.filter(p => p.pinned)
            const unpinned = projects.filter(p => !p.pinned)
            const ordered  = [...pinned, ...unpinned]
            const showDivider = pinned.length > 0 && unpinned.length > 0

            return ordered.map((p, idx) => {
              const isActive  = p.id === activeId
              const isEditing = p.id === editingProjId
              const rmArmed   = pendingRmId === p.id
              const isDividerSlot = showDivider && idx === pinned.length

              if (isEditing) {
                return (
                  <input
                    key={p.id}
                    autoFocus
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
                      background: '#111', border: '1px solid #2a2a2a',
                      borderRadius: '4px', color: '#ccc',
                      fontSize: '11px', letterSpacing: '0.03em',
                      fontFamily: 'inherit', outline: 'none', minWidth: '140px',
                    }}
                  />
                )
              }

              return (
                <React.Fragment key={p.id}>
                  {isDividerSlot && (
                    <div style={{ width: '1px', height: '16px', background: '#252525', flexShrink: 0, margin: '0 2px' }} />
                  )}
                  <WorkspaceTab
                    name={p.name || 'Untitled'}
                    active={isActive}
                    pinned={!!p.pinned}
                    rmArmed={rmArmed}
                    canRemove={projects.length > 1}
                    dragOver={dragOverId === p.id && draggedId !== p.id}
                    onClick={() => { if (!isActive) switchWorkspace(p.id) }}
                    onDoubleClick={() => startEditing(p.id, p.name || '')}
                    onRemoveClick={e => handleRemoveClick(e, p.id)}
                    onPin={e => { e.stopPropagation(); pinWorkspace(p.id) }}
                    onDragStart={() => setDraggedId(p.id)}
                    onDragOver={() => setDragOverId(p.id)}
                    onDrop={() => { if (draggedId) reorderProjects(draggedId, p.id) }}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
                  />
                </React.Fragment>
              )
            })
          })()}
          {/* New workspace — at end of tab strip */}
          <button
            onClick={() => newWorkspace()}
            title="New session"
            style={{
              width: '24px', height: '24px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none',
              color: '#333', cursor: 'pointer', padding: 0, outline: 'none',
              transition: 'color 0.15s', marginLeft: '2px',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={e => { e.currentTarget.style.color = '#777' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#333' }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right: tier · storage · actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 18px 0 12px', gap: '4px', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>

        {/* Workspace search trigger */}
        <SearchBtn onClick={() => window.dispatchEvent(new Event('proof:workspace-search'))} />

        {/* Tier label */}
        <span style={{
          fontSize: '11px',
          color: isPro ? '#5c9e6e' : '#555',
          letterSpacing: '0.05em', userSelect: 'none',
          padding: '0 6px',
        }}>
          {tierLabel}
        </span>

        <Dot />

        {/* Storage */}
        <StorageBadge />

        <Separator />

        {/* Auth cluster — isPro takes priority over user presence */}
        {isPro ? (
          // Pro
          <>
            <RightBtn onClick={() => window.dispatchEvent(new Event('proof:show-account'))}>Account</RightBtn>
          </>
        ) : !user ? (
          // Signed out, Free
          <>
            <RightBtn onClick={() => window.dispatchEvent(new Event('proof:show-account'))}>Sign in</RightBtn>
            <Dot />
            <RightBtn accent onClick={() => window.dispatchEvent(new Event('proof:upgrade-needed'))}>Upgrade</RightBtn>
          </>
        ) : (
          // Signed in, Free
          <>
            <RightBtn accent onClick={() => window.dispatchEvent(new Event('proof:upgrade-needed'))}>Upgrade</RightBtn>
            <Dot />
            <RightBtn onClick={() => window.dispatchEvent(new Event('proof:show-account'))}>Account</RightBtn>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Workspace tab ────────────────────────────────────────────────────────────

function WorkspaceTab({ name, active, pinned, rmArmed, canRemove, dragOver, onClick, onDoubleClick, onRemoveClick, onPin, onDragStart, onDragOver, onDrop, onDragEnd }: {
  name: string
  active: boolean
  pinned: boolean
  rmArmed: boolean
  canRemove: boolean
  dragOver: boolean
  onClick: () => void
  onDoubleClick: () => void
  onRemoveClick: (e: React.MouseEvent) => void
  onPin: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hovered,    setHovered]    = useState(false)
  const [xHovered,   setXHovered]   = useState(false)
  const [pinHovered, setPinHovered] = useState(false)

  const xColor   = rmArmed ? (xHovered ? '#e55' : '#b44') : xHovered ? '#666' : '#2e2e2e'
  const pinColor = pinned
    ? (pinHovered ? '#fff' : '#ccc')
    : (pinHovered ? '#777' : '#2e2e2e')

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
        padding: '0 2px 0 10px',
        flexShrink: 0, gap: '1px',
        background: active ? '#141414' : hovered ? '#0f0f0f' : 'transparent',
        border: `1px solid ${dragOver ? '#444' : active ? '#2a2a2a' : 'transparent'}`,
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
        color: active ? '#c2c2c2' : hovered ? '#888' : '#666',
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
            width: '18px', height: '18px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: '3px',
            color: xColor,
            fontSize: '12px', lineHeight: 1,
            cursor: 'pointer', padding: 0, outline: 'none',
            fontFamily: 'inherit', transition: 'color 0.1s',
          }}
        >×</button>
      )}

      {/* Pin */}
      <button
        onClick={onPin}
        onDoubleClick={e => e.stopPropagation()}
        title={pinned ? 'Unpin session' : 'Pin to left'}
        onMouseEnter={() => setPinHovered(true)}
        onMouseLeave={() => setPinHovered(false)}
        style={{
          width: '18px', height: '18px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '3px',
          color: pinColor,
          cursor: 'pointer', padding: 0, outline: 'none',
          transition: 'color 0.1s',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1h4v1l-1 3h1a1 1 0 010 2H6v3H4V7H3a1 1 0 010-2h1L3 2V1z" />
        </svg>
      </button>
    </div>
  )
}

// ─── Right-cluster button ────────────────────────────────────────────────────

function RightBtn({ children, onClick, accent }: { children: React.ReactNode; onClick: () => void; accent?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '28px', padding: '0 7px',
        background: 'none',
        border: accent ? `1px solid ${hov ? '#333' : '#252525'}` : 'none',
        borderRadius: '3px',
        color: hov ? (accent ? '#ccc' : '#999') : (accent ? '#888' : '#555'),
        fontSize: '11px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ─── Search button ───────────────────────────────────────────────────────────

function SearchBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Search session"
      style={{
        width: '22px', height: '22px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: '3px',
        color: hov ? '#777' : '#333',
        cursor: 'pointer', padding: 0, outline: 'none',
        transition: 'color 0.12s',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="5" cy="5" r="3.5" /><line x1="7.5" y1="7.5" x2="11" y2="11" />
      </svg>
    </button>
  )
}

// ─── Separator / dot ─────────────────────────────────────────────────────────

function Separator() {
  return <div style={{ width: '1px', height: '12px', background: '#1e1e1e', margin: '0 4px', flexShrink: 0 }} />
}

function Dot() {
  return <span style={{ fontSize: '11px', color: '#2a2a2a', userSelect: 'none', padding: '0 1px' }}>·</span>
}
