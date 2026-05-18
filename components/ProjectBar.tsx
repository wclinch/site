'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import StorageBadge from './StorageBadge'

export default function ProjectBar() {
  const {
    projects, activeId,
    user, isPro,
    switchWorkspace, newWorkspace, removeWorkspace,
    updateProject,
  } = useApp()

  const [editingProjId, setEditingProjId] = useState<string | null>(null)
  const [nameInput,     setNameInput]     = useState('')
  const [pendingRmId,   setPendingRmId]   = useState<string | null>(null)

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
      height: '40px', flexShrink: 0,
      borderBottom: '1px solid #161616',
      WebkitAppRegion: 'drag',
      overflow: 'hidden',
    } as React.CSSProperties}>

      {/* ── Left: logo + new workspace + tab strip ── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <a
          href="/"
          aria-label="Site"
          style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            textDecoration: 'none', lineHeight: 1,
            padding: '0 12px 0 18px',
            opacity: 0.6, transition: 'opacity 0.15s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          <svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
          </svg>
        </a>

        {/* New workspace + */}
        <button
          onClick={() => newWorkspace()}
          title="New workspace"
          style={{
            width: '26px', height: '26px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            color: '#3a3a3a', cursor: 'pointer', padding: 0, outline: 'none',
            transition: 'color 0.15s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          onMouseEnter={e => { e.currentTarget.style.color = '#777' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#363636' }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '12px', background: '#1a1a1a', flexShrink: 0, margin: '0 8px 0 6px' }} />

        {/* Tab strip — outer div stays draggable; individual tabs are no-drag */}
        <div
          ref={tabStripRef}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center',
            overflowX: 'auto', overflowY: 'hidden', gap: '1px',
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
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { commitRename(p.id) }
                    if (e.key === 'Escape') { cancelEditRef.current = true; setEditingProjId(null) }
                  }}
                  onBlur={() => { if (!cancelEditRef.current) commitRename(p.id) }}
                  placeholder="Workspace name"
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
              <WorkspaceTab
                key={p.id}
                name={p.name || 'Untitled'}
                active={isActive}
                rmArmed={rmArmed}
                canRemove={projects.length > 1}
                onClick={() => { if (!isActive) switchWorkspace(p.id) }}
                onDoubleClick={() => startEditing(p.id, p.name || '')}
                onRemoveClick={e => handleRemoveClick(e, p.id)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Right: tier · storage · actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 18px 0 12px', gap: '2px', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>

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

function WorkspaceTab({ name, active, rmArmed, canRemove, onClick, onDoubleClick, onRemoveClick }: {
  name: string
  active: boolean
  rmArmed: boolean
  canRemove: boolean
  onClick: () => void
  onDoubleClick: () => void
  onRemoveClick: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered]   = useState(false)
  const [xHovered, setXHovered] = useState(false)

  const xColor = rmArmed ? (xHovered ? '#e55' : '#b44') : xHovered ? '#666' : hovered ? '#3a3a3a' : '#1e1e1e'

  return (
    <div
      data-active={active}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center',
        height: '28px',
        padding: canRemove ? '0 2px 0 10px' : '0 10px',
        flexShrink: 0, gap: '1px',
        background: active ? '#111' : hovered ? '#0d0d0d' : 'transparent',
        border: `1px solid ${active ? '#1e1e1e' : 'transparent'}`,
        borderRadius: '4px',
        cursor: active ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'background 0.1s',
        WebkitAppRegion: 'no-drag',
        maxWidth: '180px',
      } as React.CSSProperties}
    >
      <span style={{
        fontSize: '11px', letterSpacing: '0.03em',
        color: active ? '#999' : hovered ? '#555' : '#444',
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
        color: hov ? (accent ? '#bbb' : '#888') : (accent ? '#777' : '#3a3a3a'),
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

// ─── Separator / dot ─────────────────────────────────────────────────────────

function Separator() {
  return <div style={{ width: '1px', height: '12px', background: '#1a1a1a', margin: '0 4px', flexShrink: 0 }} />
}

function Dot() {
  return <span style={{ fontSize: '11px', color: '#252525', userSelect: 'none', padding: '0 1px' }}>·</span>
}
