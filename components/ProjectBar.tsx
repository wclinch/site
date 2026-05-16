'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import StorageBadge from './StorageBadge'

export default function ProjectBar() {
  const {
    projects, activeId,
    switchWorkspace, newWorkspace, saveWorkspace, removeWorkspace,
    updateProject,
  } = useApp()

  const [editingProjId,  setEditingProjId]  = useState<string | null>(null)
  const [fromSaveBtn,    setFromSaveBtn]     = useState(false)
  const [nameInput,      setNameInput]       = useState('')
  const [flashSaved,     setFlashSaved]      = useState(false)
  const [pendingRmId,    setPendingRmId]     = useState<string | null>(null)

  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rmTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabStripRef    = useRef<HTMLDivElement>(null)
  const cancelEditRef  = useRef(false)

  const activeProject = projects.find(p => p.id === activeId) ?? null
  const isUntitled    = !activeProject?.name

  // Scroll active tab into view on workspace switch
  useEffect(() => {
    const strip = tabStripRef.current
    if (!strip) return
    const active = strip.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeId])

  // Redirect vertical wheel to horizontal scroll on the strip
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

  function startEditing(projId: string, currentName: string, isSaveBtn: boolean) {
    cancelEditRef.current = false
    setNameInput(currentName)
    setEditingProjId(projId)
    setFromSaveBtn(isSaveBtn)
    setPendingRmId(null)
    if (rmTimerRef.current) { clearTimeout(rmTimerRef.current); rmTimerRef.current = null }
  }

  function commitRename(projId: string) {
    const name = nameInput.trim()
    setEditingProjId(null)
    if (!name) return
    if (fromSaveBtn && projId === activeId) {
      saveWorkspace(name)
    } else {
      updateProject(projId, { name })
    }
  }

  function handleSave() {
    if (!activeId) return
    if (isUntitled) {
      startEditing(activeId, '', true)
    } else {
      saveWorkspace()
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      setFlashSaved(true)
      savedTimerRef.current = setTimeout(() => setFlashSaved(false), 1200)
    }
  }

  function handleNew() {
    newWorkspace()
  }

  function handleRemoveClick(e: React.MouseEvent, projId: string) {
    e.stopPropagation()
    if (pendingRmId !== projId) {
      // First click — arm the confirm
      setPendingRmId(projId)
      if (rmTimerRef.current) clearTimeout(rmTimerRef.current)
      rmTimerRef.current = setTimeout(() => setPendingRmId(null), 1800)
    } else {
      // Second click — execute
      if (rmTimerRef.current) { clearTimeout(rmTimerRef.current); rmTimerRef.current = null }
      setPendingRmId(null)
      removeWorkspace(projId)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: '44px', flexShrink: 0,
      borderBottom: '1px solid #1a1a1a',
      WebkitAppRegion: 'drag',
      overflow: 'hidden',
    } as React.CSSProperties}>

      {/* Logo */}
      <a href="/" aria-label="Site" style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        textDecoration: 'none', lineHeight: 1,
        opacity: 0.85, transition: 'opacity 0.15s',
        padding: '0 0 0 20px', marginRight: '10px',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
        </svg>
      </a>

      {/* Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <NavBtn onClick={handleNew}>
          New
        </NavBtn>
        <NavBtn onClick={handleSave} disabled={!activeId}>
          {flashSaved ? 'Saved' : isUntitled ? 'Save As' : 'Save'}
        </NavBtn>
        <div style={{ width: '1px', height: '12px', background: '#1e1e1e', margin: '0 6px' }} />
      </div>

      {/* Workspace tab strip */}
      <div
        ref={tabStripRef}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden', gap: '2px',
          scrollbarWidth: 'none',
          WebkitAppRegion: 'no-drag',
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
                  height: '24px', padding: '0 10px', flexShrink: 0,
                  background: '#151515', border: '1px solid #333',
                  borderRadius: '3px', color: '#bbb',
                  fontSize: '11px', letterSpacing: '0.03em',
                  fontFamily: 'inherit', outline: 'none', minWidth: '150px',
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
              onClick={() => { if (!isActive) switchWorkspace(p.id) }}
              onDoubleClick={() => startEditing(p.id, p.name || '', false)}
              onRemoveClick={e => handleRemoveClick(e, p.id)}
            />
          )
        })}
      </div>

      {/* Right — storage + support */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '0 20px 0 12px', flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <StorageBadge />
        <span style={{ width: '1px', height: '12px', background: '#222' }} />
        <a
          href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support"
          title="Email support"
          style={{
            fontSize: '11px', color: '#555', letterSpacing: '0.04em',
            textDecoration: 'none', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >
          Support
        </a>
      </div>
    </div>
  )
}

// ─── Workspace tab chip ───────────────────────────────────────────────────────

function WorkspaceTab({ name, active, rmArmed, onClick, onDoubleClick, onRemoveClick }: {
  name: string
  active: boolean
  rmArmed: boolean
  onClick: () => void
  onDoubleClick: () => void
  onRemoveClick: (e: React.MouseEvent) => void
}) {
  return (
    <div
      data-active={active}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '3px',
        height: '24px', padding: '0 5px 0 10px', flexShrink: 0,
        background: active ? '#111' : 'none',
        border: `1px solid ${active ? '#222' : 'transparent'}`,
        borderRadius: '3px',
        cursor: active ? 'default' : 'pointer',
        userSelect: 'none',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <span style={{
        fontSize: '11px', letterSpacing: '0.03em', whiteSpace: 'nowrap',
        color: active ? '#aaa' : '#555',
      }}>
        {name}
      </span>
      <button
        onClick={onRemoveClick}
        onDoubleClick={e => e.stopPropagation()}
        title={rmArmed ? 'Click again to remove' : 'Remove'}
        style={{
          width: '14px', height: '14px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '2px',
          color: rmArmed ? '#c44' : '#333',
          fontSize: '13px', lineHeight: 1,
          cursor: 'pointer', padding: 0, outline: 'none',
          fontFamily: 'inherit', transition: 'color 0.1s',
        }}
        onMouseEnter={e => { if (!rmArmed) e.currentTarget.style.color = '#777' }}
        onMouseLeave={e => { if (!rmArmed) e.currentTarget.style.color = '#333' }}
      >×</button>
    </div>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({ children, onClick, danger, disabled }: {
  children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean
}) {
  const base  = disabled ? '#333' : danger ? '#c44' : '#555'
  const hover = disabled ? '#333' : danger ? '#e55' : '#999'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: '22px', padding: '0 7px',
        background: 'none', border: 'none', borderRadius: '3px',
        color: base, fontSize: '11px', letterSpacing: '0.04em',
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      onMouseEnter={e => { e.currentTarget.style.color = hover }}
      onMouseLeave={e => { e.currentTarget.style.color = base }}
    >
      {children}
    </button>
  )
}
