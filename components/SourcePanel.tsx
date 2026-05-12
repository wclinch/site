'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import SourceStack from './SourceStack'

// Project-scoped sidebar.
//
// Top: new-project input + add-source / add-URL actions.
// Middle: flat list of projects. Clicking one switches the active
//         project; the Stack section at the bottom then mirrors that
//         project's sources. There is no separate "floating sources"
//         tier — every source lives inside exactly one project.
// Bottom: SourceStack (active project's sources) + Clock.

const SOURCE_DRAG_TYPE  = 'application/x-proof-source-id'
const PROJECT_DRAG_TYPE = 'application/x-proof-project-id'

export default function SourcePanel({ width }: { width: number | string }) {
  const {
    projects, activeId, allSources,
    uploadFiles, moveSourceToProject, moveProject, addUrl,
    createProject, switchProject, updateProject, deleteProject,
    namedProjectCount,
  } = useApp()

  // ── New-project input + inline dup error ─────────────────────────────────
  const [creatingProj, setCreatingProj]     = useState(false)
  const [newProjName,  setNewProjName]      = useState('')
  const [newProjDupErr, setNewProjDupErr]   = useState<string | null>(null)
  const newProjRef = useRef<HTMLInputElement>(null)

  // ── Project row state ────────────────────────────────────────────────────
  const [editingProjId, setEditingProjId]   = useState<string | null>(null)
  const [projNameInput, setProjNameInput]   = useState('')
  const [menuProjId,    setMenuProjId]      = useState<string | null>(null)
  const [menuPos,       setMenuPos]         = useState<{ top: number; left: number } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dropTargetId,  setDropTargetId]    = useState<string | null>(null) // project being hovered during a source drag
  const [draggingProjId, setDraggingProjId] = useState<string | null>(null)
  const [projLiveOrder,  setProjLiveOrder]  = useState<string[] | null>(null)

  useEffect(() => {
    if (!menuProjId) return
    function onDown(e: MouseEvent) {
      const menu = document.getElementById('proj-ctx-menu')
      if (menu && !menu.contains(e.target as Node)) {
        setMenuProjId(null); setMenuPos(null); setConfirmDeleteId(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuProjId])

  // ── Action-row state ─────────────────────────────────────────────────────
  const [addHover, setAddHover]   = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput,  setUrlInput]  = useState('')
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [dupMsg, setDupMsg]       = useState(false)
  const [clockOpen, setClockOpen] = useState(false)

  const fileRef  = useRef<HTMLInputElement>(null)
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (dupTimer.current) clearTimeout(dupTimer.current) }, [])

  const hasActive = activeId !== null

  function handleUpload(files: FileList | File[]) {
    if (!hasActive) return
    const list = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
    )
    const hasDup = list.some(f => allSources.some(s => s.label === f.name))
    if (hasDup) {
      setDupMsg(true)
      if (dupTimer.current) clearTimeout(dupTimer.current)
      dupTimer.current = setTimeout(() => setDupMsg(false), 3000)
    }
    uploadFiles(files)
  }

  // ── New-project commit ───────────────────────────────────────────────────
  function handleCreateProject() {
    const name = newProjName.trim()
    if (!name) {
      setCreatingProj(false); setNewProjName(''); setNewProjDupErr(null); return
    }
    const dup = projects.some(p => p.name.trim().toLowerCase() === name.toLowerCase())
    if (dup) {
      setNewProjDupErr(`"${name}" already exists.`)
      setTimeout(() => newProjRef.current?.select(), 0)
      setTimeout(() => setNewProjDupErr(null), 2500)
      return
    }
    const ok = createProject(name)
    if (ok) { setCreatingProj(false); setNewProjName(''); setNewProjDupErr(null) }
  }

  function commitRename(projId: string, fallback: string) {
    updateProject(projId, { name: projNameInput.trim() || fallback })
    setEditingProjId(null)
  }

  // ── Project drag (reorder) ───────────────────────────────────────────────
  function handleProjDragStart(projId: string, e: React.DragEvent) {
    e.stopPropagation()
    e.dataTransfer.setData(PROJECT_DRAG_TYPE, projId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingProjId(projId)
    setProjLiveOrder(projects.map(p => p.id))
  }

  function handleProjDragOverHeader(targetProjId: string, e: React.DragEvent) {
    if (!draggingProjId || !projLiveOrder) return
    if (targetProjId === draggingProjId) return
    if (!e.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    const without = projLiveOrder.filter(id => id !== draggingProjId)
    const targetIdx = without.indexOf(targetProjId)
    if (targetIdx === -1) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = e.clientY < rect.top + rect.height / 2
    const insertAt = above ? targetIdx : targetIdx + 1
    const next = [...without]
    next.splice(insertAt, 0, draggingProjId)
    if (next.join() !== projLiveOrder.join()) setProjLiveOrder(next)
  }

  function handleProjDragEnd() {
    if (draggingProjId && projLiveOrder) {
      const toIndex = projLiveOrder.indexOf(draggingProjId)
      if (toIndex !== -1) moveProject(draggingProjId, toIndex)
    }
    setDraggingProjId(null)
    setProjLiveOrder(null)
  }

  // ── Project as drop target for source move ───────────────────────────────
  function handleProjSourceDragOver(projId: string, e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(SOURCE_DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTargetId(projId)
  }
  function handleProjSourceDrop(projId: string, e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(SOURCE_DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    const srcId = e.dataTransfer.getData(SOURCE_DRAG_TYPE)
    if (srcId) moveSourceToProject(srcId, projId)
    setDropTargetId(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const visibleProjects = (draggingProjId && projLiveOrder
    ? projLiveOrder.map(id => projects.find(p => p.id === id)).filter(Boolean) as typeof projects
    : projects
  )

  return (
    <div style={{ width, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* + New project row */}
      {!clockOpen && (
        <div style={{ height: '36px', flexShrink: 0, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '6px' }}>
          {creatingProj ? (
            <input
              ref={newProjRef}
              autoFocus
              value={newProjName}
              onChange={e => { setNewProjName(e.target.value); if (newProjDupErr) setNewProjDupErr(null) }}
              placeholder="Project name"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setCreatingProj(false); setNewProjName(''); setNewProjDupErr(null) }
              }}
              onBlur={() => { if (!newProjDupErr) handleCreateProject() }}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12px', color: '#ccc', fontFamily: 'inherit', letterSpacing: '0.02em',
              }}
            />
          ) : (
            <button
              onClick={() => setCreatingProj(true)}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer',
                fontSize: '12px', color: '#444',
                fontFamily: 'inherit', letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#888')}
              onMouseLeave={e => (e.currentTarget.style.color = '#444')}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
              <span>New project</span>
            </button>
          )}
          <span style={{
            marginLeft: 'auto', fontSize: '10px',
            color: '#3a3a3a',
            letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums',
          }}>
            {namedProjectCount}
          </span>
        </div>
      )}

      {/* Inline dup-project warning */}
      {!clockOpen && newProjDupErr && (
        <div style={{
          padding: '16px 14px 6px', fontSize: '11px', color: '#666',
          letterSpacing: '0.02em', lineHeight: 1,
        }}>
          {newProjDupErr}
        </div>
      )}

      {!clockOpen && (
        <>
          {/* Add source */}
          <div
            onDragOver={e => { if (hasActive && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              if (!hasActive) return
              const valid = Array.from(e.dataTransfer.files).filter(f =>
                f.type === 'application/pdf' || f.name.endsWith('.pdf') ||
                f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name))
              if (valid.length) handleUpload(valid)
            }}
            onClick={() => { if (hasActive) fileRef.current?.click() }}
            onMouseEnter={() => setAddHover(true)}
            onMouseLeave={() => setAddHover(false)}
            style={{
              margin: '10px 10px 0', padding: '11px 14px',
              background: !hasActive ? '#0b0b0b' : dragOver ? '#141414' : addHover ? '#111' : '#0d0d0d',
              border: `1px solid ${!hasActive ? '#161616' : dragOver ? '#333' : addHover ? '#252525' : '#1a1a1a'}`,
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              cursor: hasActive ? 'pointer' : 'not-allowed',
              transition: 'border-color 0.15s, background 0.15s',
              opacity: hasActive ? 1 : 0.55,
            }}
          >
            <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.04em', flex: 1 }}>
              {!hasActive ? 'Add source' : dragOver ? 'Release to add' : 'Add source'}
            </span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) { handleUpload(e.target.files); e.target.value = '' } }}
          />

          {/* Add URL */}
          {addingUrl ? (
            <div style={{
              margin: '8px 10px 0', padding: '11px 14px',
              background: '#0d0d0d', border: '1px solid #333', borderRadius: '4px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}>
              <input
                ref={urlInputRef}
                autoFocus
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="URL"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const raw = urlInput.trim()
                    if (!raw) { setAddingUrl(false); setUrlInput(''); return }
                    const url = raw.startsWith('http') ? raw : `https://${raw}`
                    addUrl(url)
                    setAddingUrl(false); setUrlInput('')
                  }
                  if (e.key === 'Escape') { setAddingUrl(false); setUrlInput('') }
                }}
                onBlur={() => { if (!urlInput.trim()) { setAddingUrl(false); setUrlInput('') } }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '11px', color: '#bbb', fontFamily: 'inherit', letterSpacing: '0.02em',
                }}
              />
            </div>
          ) : (
            <UrlBtn
              disabled={!hasActive}
              onClick={() => { if (hasActive) { setAddingUrl(true); setTimeout(() => urlInputRef.current?.focus(), 0) } }}
            />
          )}

          {dupMsg && (
            <div style={{ margin: '6px 10px 0', fontSize: '11px', color: '#666', letterSpacing: '0.02em', padding: '0 2px' }}>
              Already added.
            </div>
          )}

          {/* Project list — flat, clickable, draggable */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, marginTop: '16px' }}>
            <div style={{ height: '1px', background: '#1a1a1a', margin: '0 10px 10px' }} />

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {projects.length === 0 ? (
                <div style={{ padding: '6px 16px', fontSize: '11px', color: '#555', lineHeight: 1.7 }}>
                  Create a project to begin.
                </div>
              ) : (
                visibleProjects.map(proj => {
                  const isActive     = proj.id === activeId
                  const isDropTarget = dropTargetId === proj.id
                  const isDraggingMe = draggingProjId === proj.id
                  const srcCount     = proj.sources.length
                  return (
                    <div
                      key={proj.id}
                      draggable={editingProjId !== proj.id}
                      onDragStart={e => handleProjDragStart(proj.id, e)}
                      onDragEnd={handleProjDragEnd}
                      onDragOver={e => {
                        if (e.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) {
                          handleProjDragOverHeader(proj.id, e)
                        } else if (e.dataTransfer.types.includes(SOURCE_DRAG_TYPE)) {
                          handleProjSourceDragOver(proj.id, e)
                        }
                      }}
                      onDragLeave={() => setDropTargetId(null)}
                      onDrop={e => handleProjSourceDrop(proj.id, e)}
                      onClick={() => { if (draggingProjId) return; if (editingProjId !== proj.id) switchProject(proj.id) }}
                      onContextMenu={e => {
                        e.preventDefault(); e.stopPropagation()
                        setConfirmDeleteId(null)
                        setMenuProjId(proj.id)
                        setMenuPos({ top: e.clientY, left: e.clientX })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 16px 7px 14px',
                        cursor: editingProjId === proj.id ? 'text' : 'pointer',
                        userSelect: 'none',
                        background:
                          isDropTarget ? '#0f1414'
                          : isActive   ? '#0f0f0f'
                          : 'transparent',
                        borderLeft: isActive ? '2px solid #444' : '2px solid transparent',
                        opacity: isDraggingMe ? 0.35 : 1,
                        transition: 'background 0.1s, border-color 0.1s, opacity 0.1s',
                      }}
                    >
                      {editingProjId === proj.id ? (
                        <input
                          autoFocus
                          value={projNameInput}
                          onChange={e => setProjNameInput(e.target.value)}
                          onFocus={e => e.target.select()}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => commitRename(proj.id, proj.name)}
                          onKeyDown={e => {
                            e.stopPropagation()
                            if (e.key === 'Enter') commitRename(proj.id, proj.name)
                            if (e.key === 'Escape') setEditingProjId(null)
                          }}
                          style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            fontSize: '12px', color: '#ccc', fontFamily: 'inherit',
                            padding: 0, letterSpacing: '0.04em',
                          }}
                        />
                      ) : (
                        <>
                          <span style={{
                            flex: 1, minWidth: 0,
                            fontSize: '12px', letterSpacing: '0.04em',
                            color: isActive ? '#ccc' : '#777',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            transition: 'color 0.1s',
                          }}>
                            {proj.name}
                          </span>
                          <span style={{
                            fontSize: '10px', color: '#3a3a3a',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '0.04em',
                          }}>
                            {srcCount}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Project context menu */}
      {menuProjId && menuPos && (() => {
        const proj = projects.find(p => p.id === menuProjId)
        if (!proj) return null
        return (
          <div
            id="proj-ctx-menu"
            style={{
              position: 'fixed', left: menuPos.left, top: menuPos.top,
              background: '#0d0d0d', border: '1px solid #1a1a1a',
              borderRadius: '4px', zIndex: 300, minWidth: '130px',
              overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <button
              onClick={() => { setEditingProjId(proj.id); setProjNameInput(proj.name); setMenuProjId(null); setMenuPos(null) }}
              style={ROW_STYLE}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >Rename</button>
            <div style={{ height: '1px', background: '#1a1a1a' }} />
            <button
              onClick={() => {
                if (confirmDeleteId === proj.id) {
                  deleteProject(proj.id); setConfirmDeleteId(null); setMenuProjId(null); setMenuPos(null)
                } else setConfirmDeleteId(proj.id)
              }}
              style={{ ...ROW_STYLE, color: confirmDeleteId === proj.id ? '#e55' : '#c55' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {confirmDeleteId === proj.id ? 'Confirm' : 'Delete'}
            </button>
          </div>
        )
      })()}

      {/* Stack — active project's sources. Hidden while the clock fills the
          sidebar. */}
      <SourceStack hidden={clockOpen} />

      <Clock open={clockOpen} onToggle={() => setClockOpen(o => !o)} />
    </div>
  )
}

const ROW_STYLE: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'none', border: 'none', padding: '9px 14px',
  cursor: 'pointer', fontSize: '12px', color: '#777',
  letterSpacing: '0.02em', fontFamily: 'inherit',
}

// ─── Clock + helpers (unchanged from prior version) ──────────────────────

function Clock({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [now, setNow]   = useState(new Date())
  const containerRef    = useRef<HTMLDivElement>(null)
  const timeRef         = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [timeBounds, setTimeBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!open || !containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    if (!open || !dims || !timeRef.current || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const timeRect = timeRef.current.getBoundingClientRect()
    setTimeBounds({
      x: timeRect.left - containerRect.left,
      y: timeRect.top - containerRect.top,
      w: timeRect.width,
      h: timeRect.height,
    })
  }, [open, dims])

  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const ss   = now.toLocaleTimeString([], { second: '2-digit' }).slice(-2)
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  const hr = now.getHours()
  const mn = now.getMinutes()
  const sc = now.getSeconds()
  const is427 = (hr === 4 || hr === 16) && mn === 27
  const is428close = (hr === 4 || hr === 16) && mn === 28 && sc === 0
  const showTrack = open && (is427 || is428close)
  const trackProgress = is428close ? 1 : sc / 60

  if (open) {
    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, borderTop: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {showTrack && timeBounds && <TrackOverlay bounds={timeBounds} progress={trackProgress} />}
        <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px' }}>
          <ClockIconBtn onClick={onToggle} title="Collapse"><ClockCollapseIcon /></ClockIconBtn>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div ref={timeRef} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: '32px', color: '#555', letterSpacing: '0.06em', fontWeight: 300 }}>{hhmm}</span>
            <span style={{ fontSize: '14px', color: '#333', letterSpacing: '0.04em' }}>{ss}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#383838', letterSpacing: '0.1em' }}>{date.toUpperCase()}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', height: '28px', padding: '0 8px 0 14px', gap: '4px' }}>
      <span style={{ flex: 1, fontSize: '10px', letterSpacing: '0.04em', userSelect: 'none', color: '#888', fontVariantNumeric: 'tabular-nums' }}>
        {hhmm}
      </span>
      <ClockIconBtn onClick={onToggle} title="Expand"><ClockExpandIcon /></ClockIconBtn>
    </div>
  )
}

function TrackOverlay({ bounds, progress }: { bounds: { x: number; y: number; w: number; h: number }; progress: number }) {
  const pad = 48
  const rx  = 12
  const x   = bounds.x - pad
  const y   = bounds.y - pad
  const w   = bounds.w + pad * 2
  const h   = bounds.h + pad * 2
  const cx  = x + w / 2

  const perim = 2 * (w - 2 * rx) + 2 * (h - 2 * rx) + 2 * Math.PI * rx

  const d = [
    `M ${cx} ${y}`,
    `L ${x + w - rx} ${y}`,
    `A ${rx} ${rx} 0 0 1 ${x + w} ${y + rx}`,
    `L ${x + w} ${y + h - rx}`,
    `A ${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h}`,
    `L ${x + rx} ${y + h}`,
    `A ${rx} ${rx} 0 0 1 ${x} ${y + h - rx}`,
    `L ${x} ${y + rx}`,
    `A ${rx} ${rx} 0 0 1 ${x + rx} ${y}`,
    `L ${cx} ${y}`,
  ].join(' ')

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <path
        d={d}
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="1"
        strokeLinecap="butt"
        strokeDasharray={perim}
        strokeDashoffset={perim * (1 - progress)}
      />
    </svg>
  )
}

function ClockIconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0, color: hov ? '#bbb' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', flexShrink: 0 }}
    >{children}</button>
  )
}
function ClockExpandIcon() {
  return <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4V1H4" /><path d="M7 1H10V4" /><path d="M10 7V10H7" /><path d="M4 10H1V7" /></svg>
}
function ClockCollapseIcon() {
  return <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 1V4H1" /><path d="M10 4H7V1" /><path d="M7 10V7H10" /><path d="M1 7H4V10" /></svg>
}

function UrlBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={() => { if (!disabled) onClick() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        margin: '8px 10px 0', padding: '11px 14px',
        background: disabled ? '#0b0b0b' : hov ? '#111' : '#0d0d0d',
        border: `1px solid ${disabled ? '#161616' : hov ? '#252525' : '#1a1a1a'}`,
        borderRadius: '4px', display: 'flex', alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.15s, border-color 0.15s', flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.04em', flex: 1 }}>Add URL</span>
    </div>
  )
}
