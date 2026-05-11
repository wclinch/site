'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { INBOX_ID } from '@/context/AppContext'
import SourceItem from './SourceItem'
import SourceStack from './SourceStack'

export default function SourcePanel({ width }: { width: number | string }) {
  const {
    projects, activeId, allSources,
    uploadFiles, moveSource, moveSourceToProject, moveProject, addUrl,
    createProject, switchProject, updateProject, deleteProject,
    namedProjectCount, atProjectLimit,
  } = useApp()

  // ── New project input ──────────────────────────────────────────────────────
  const [creatingProj, setCreatingProj] = useState(false)
  const [newProjName, setNewProjName]   = useState('')
  // Inline duplicate-name error rendered right under the input — matches
  // the "Already added" pattern used for file/URL drops, instead of a
  // disconnected top-bar toast.
  const [newProjDupErr, setNewProjDupErr] = useState<string | null>(null)
  const newProjRef = useRef<HTMLInputElement>(null)

  // ── Project folder state ───────────────────────────────────────────────────
  const [expanded, setExpanded]           = useState<Set<string>>(new Set())
  const [editingProjId, setEditingProjId] = useState<string | null>(null)
  const [projNameInput, setProjNameInput] = useState('')
  const [menuProjId, setMenuProjId]       = useState<string | null>(null)
  const [menuPos, setMenuPos]             = useState<{ top: number; left: number } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId]   = useState<string | null>(null) // folder being hovered during drag

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

  // ── Source panel state ─────────────────────────────────────────────────────
  const [dragOver, setDragOver]   = useState(false)
  const [addHover, setAddHover]   = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput, setUrlInput]   = useState('')
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [filterInput, setFilterInput] = useState('')
  const [filter, setFilter]           = useState('')
  const [dupMsg, setDupMsg]           = useState(false)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [liveOrder, setLiveOrder]     = useState<string[] | null>(null)
  // Project reorder is a parallel system to source reorder — separate
  // dataTransfer type, separate live-order so dragging one doesn't
  // interfere with the other.
  const [draggingProjId, setDraggingProjId] = useState<string | null>(null)
  const [projLiveOrder,  setProjLiveOrder]  = useState<string[] | null>(null)
  const [clockOpen, setClockOpen]     = useState(false)
  const folderDropHandled             = useRef(false)

  const fileRef   = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const dupTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleUpload(files: FileList | File[]) {
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

  useEffect(() => {
    const t = setTimeout(() => setFilter(filterInput), 150)
    return () => clearTimeout(t)
  }, [filterInput])

  useEffect(() => () => { if (dupTimer.current) clearTimeout(dupTimer.current) }, [])

  function handleItemDragStart(id: string) {
    setDraggingId(id)
    // Build liveOrder from the source's home project
    const homeProjSources = projects.find(p => p.sources.some(s => s.id === id))?.sources ?? []
    setLiveOrder(homeProjSources.map(s => s.id))
  }

  function handleItemDragEnd() {
    if (!folderDropHandled.current && draggingId && liveOrder) {
      const toIndex = liveOrder.indexOf(draggingId)
      if (toIndex !== -1) moveSource(draggingId, toIndex)
    }
    folderDropHandled.current = false
    setDraggingId(null)
    setLiveOrder(null)
    setDropTargetId(null)
  }

  function handleListDragOver(e: React.DragEvent) {
    if (!draggingId || !liveOrder || !listRef.current) return
    if (e.dataTransfer.types.includes('Files')) return
    if (dropTargetId) return  // hovering a folder — don't reorder
    e.preventDefault()
    // Skip the dragging item itself when picking the insert slot —
    // otherwise insertIdx is in liveOrder-space (which still includes the
    // dragging item) while the splice is against `without` (which doesn't),
    // and the off-by-one makes drags past a neighbour feel sticky.
    const items = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-src-id]'))
      .filter(el => el.dataset.srcId !== draggingId)
    const without = liveOrder.filter(id => id !== draggingId)
    let insertIdx = without.length
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height * 0.5) { insertIdx = i; break }
    }
    const next = [...without]
    next.splice(insertIdx, 0, draggingId)
    if (next.join() !== liveOrder.join()) setLiveOrder(next)
  }

  function handleListDrop(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) return
    e.stopPropagation()
  }

  // ── Project (folder) reorder ───────────────────────────────────────────────
  //
  // Uses a separate dataTransfer type from source drags so a folder being
  // reordered never gets misread as "drop source into folder" and vice
  // versa. Live order updates as the user hovers over other folder
  // headers; commit on drag end via moveProject.
  const PROJ_DRAG_TYPE = 'application/x-proof-project-id'

  function handleProjDragStart(projId: string, e: React.DragEvent) {
    e.stopPropagation()
    e.dataTransfer.setData(PROJ_DRAG_TYPE, projId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingProjId(projId)
    setProjLiveOrder(namedProjects.map(p => p.id))
  }

  function handleProjDragOverHeader(targetProjId: string, e: React.DragEvent) {
    if (!draggingProjId || !projLiveOrder) return
    if (targetProjId === draggingProjId) return
    if (!e.dataTransfer.types.includes(PROJ_DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    // Work entirely in `without`-space so the splice index matches the
    // array we're splicing into. Computing targetIdx against projLiveOrder
    // (which still contains the dragging item) caused an off-by-one when
    // dragging downward past a neighbour — items wouldn't swap until the
    // cursor crossed deep past their midpoint.
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

  function handleFolderDragOver(projId: string, e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('application/x-proof-source-id')) return
    e.preventDefault()
    e.stopPropagation()
    setDropTargetId(projId)
  }

  function handleFolderDrop(projId: string, e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const srcId = e.dataTransfer.getData('application/x-proof-source-id')
    if (srcId) {
      moveSourceToProject(srcId, projId)
      folderDropHandled.current = true
    }
    setDropTargetId(null)
  }

  function handleInboxDrop(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    const srcId = e.dataTransfer.getData('application/x-proof-source-id')
    if (srcId) {
      moveSourceToProject(srcId, INBOX_ID)
      folderDropHandled.current = true
    }
    setDropTargetId(null)
  }

  function commitRename(projId: string, fallback: string) {
    updateProject(projId, { name: projNameInput.trim() || fallback })
    setEditingProjId(null)
  }

  function handleCreateProject() {
    const name = newProjName.trim()
    if (!name) {
      setCreatingProj(false)
      setNewProjName('')
      setNewProjDupErr(null)
      return
    }
    // Pre-check duplicate ourselves so we can render an inline error;
    // createProject also guards silently in case it's called elsewhere.
    // At-cap rejection still uses the top-bar warn() because there's no
    // input to attach an inline message to.
    const dup = projects.some(p =>
      p.id !== INBOX_ID && p.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (dup) {
      setNewProjDupErr(`"${name}" already exists.`)
      setTimeout(() => newProjRef.current?.select(), 0)
      // Auto-clear so the message reads as transient feedback, not a
      // persistent banner sitting under the input.
      setTimeout(() => setNewProjDupErr(null), 2500)
      return
    }
    const ok = createProject(name)
    if (ok) {
      setCreatingProj(false)
      setNewProjName('')
      setNewProjDupErr(null)
    }
  }

  const q = filter.trim().toLowerCase()
  const namedProjects = projects.filter(p => p.id !== INBOX_ID)
  const inboxProject  = projects.find(p => p.id === INBOX_ID)
  const inboxSources  = inboxProject?.sources ?? []

  function filterSources(srcs: typeof allSources) {
    if (!q) return srcs
    return srcs.filter(s => (s.label || s.raw).toLowerCase().includes(q))
  }

  const visibleInbox = filterSources(
    liveOrder && draggingId && inboxProject?.sources.some(s => s.id === draggingId)
      ? liveOrder.map(id => inboxSources.find(s => s.id === id)).filter(Boolean) as typeof inboxSources
      : inboxSources
  )

  const hasAnySources = allSources.length > 0

  const shell: React.CSSProperties = {
    marginTop: '10px', marginRight: '10px', marginBottom: '0', marginLeft: '10px',
    padding: '11px 14px',
    background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '4px',
    display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'border-color 0.15s',
  }

  const ROW_STYLE: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 14px',
    cursor: 'pointer', fontSize: '12px', color: '#777',
    letterSpacing: '0.02em', fontFamily: 'inherit',
  }

  return (
    <div style={{ width, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Create project row */}
      {!clockOpen && (
        <div style={{ height: '36px', flexShrink: 0, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '6px' }}>
          {creatingProj ? (
            <input
              ref={newProjRef}
              autoFocus
              value={newProjName}
              onChange={e => { setNewProjName(e.target.value); if (newProjDupErr) setNewProjDupErr(null) }}
              placeholder="Project name..."
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setCreatingProj(false); setNewProjName(''); setNewProjDupErr(null) }
              }}
              // Skip auto-commit on blur while the dup error is showing —
              // otherwise tabbing away closes the input and loses the
              // message before the user reads it.
              onBlur={() => { if (!newProjDupErr) handleCreateProject() }}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12px', color: '#ccc', fontFamily: 'inherit',
                letterSpacing: '0.02em',
              }}
            />
          ) : (
            <button
              onClick={() => { if (!atProjectLimit) setCreatingProj(true) }}
              disabled={atProjectLimit}
              title={atProjectLimit ? 'Project limit reached (3/3). Delete a project to add more.' : undefined}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: atProjectLimit ? 'not-allowed' : 'pointer',
                fontSize: '12px', color: atProjectLimit ? '#2a2a2a' : '#444',
                fontFamily: 'inherit',
                letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '5px',
              }}
              onMouseEnter={e => { if (!atProjectLimit) e.currentTarget.style.color = '#888' }}
              onMouseLeave={e => { if (!atProjectLimit) e.currentTarget.style.color = '#444' }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
              <span>New project</span>
            </button>
          )}
          <span style={{
            marginLeft: 'auto', fontSize: '10px',
            color: atProjectLimit ? '#a55' : '#3a3a3a',
            letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums',
          }}>
            {namedProjectCount} / 3
          </span>
        </div>
      )}

      {/* Inline duplicate-name validation — bare muted text, no surface
          or divider, auto-dismisses after a couple seconds (timer wired
          where the error is set). Matches the unobtrusive inline copy
          used elsewhere for transient validation. */}
      {!clockOpen && newProjDupErr && (
        <div style={{
          // padding-top is bigger than padding-bottom because the "Add
          // file" box below has its own marginTop:10 (from `shell`). The
          // visible gap below the message = padding-bottom + 10, so we
          // give padding-top an extra 10 to match — making the text sit
          // visually centered between the divider above and the Add file
          // box below rather than biased toward the divider.
          padding: '16px 14px 6px', fontSize: '11px', color: '#666',
          letterSpacing: '0.02em', lineHeight: 1,
        }}>
          {newProjDupErr}
        </div>
      )}

      {!clockOpen && (
        <>
          {/* Add file */}
          <div
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const valid = Array.from(e.dataTransfer.files).filter(f =>
                f.type === 'application/pdf' || f.name.endsWith('.pdf') ||
                f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name))
              if (valid.length) handleUpload(valid)
            }}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={() => setAddHover(true)}
            onMouseLeave={() => setAddHover(false)}
            style={{ ...shell, background: dragOver ? '#141414' : addHover ? '#111' : '#0d0d0d', borderColor: dragOver ? '#333' : addHover ? '#252525' : '#1a1a1a', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.04em', flex: 1 }}>
              {dragOver ? 'Drop to add file' : 'Add file'}
            </span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) { handleUpload(e.target.files); e.target.value = '' } }}
          />

          {addingUrl ? (
            <div style={{
              margin: '8px 10px 0', padding: '11px 14px',
              background: '#0d0d0d', border: '1px solid #333', borderRadius: '4px',
              display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
            }}>
              <input
                ref={urlInputRef}
                autoFocus
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="Paste a URL..."
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
            <UrlBtn onClick={() => { setAddingUrl(true); setTimeout(() => urlInputRef.current?.focus(), 0) }} />
          )}

          {dupMsg && (
            <div style={{ margin: '6px 10px 0', fontSize: '11px', color: '#666', letterSpacing: '0.02em', padding: '0 2px' }}>
              Already added.
            </div>
          )}

          {/* Source list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ ...shell, cursor: 'text', padding: '11px 14px', marginTop: '16px' }} onClick={() => filterRef.current?.focus()}>
              <input
                ref={filterRef} className="sp-input"
                value={filterInput} onChange={e => setFilterInput(e.target.value)}
                placeholder="Filter..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontFamily: 'inherit', letterSpacing: '0.02em', color: '#555' }}
              />
              {filterInput && (
                <button onClick={e => { e.stopPropagation(); setFilterInput(''); setFilter('') }}
                  style={{ background: 'none', border: 'none', padding: '0 0 0 6px', cursor: 'pointer', color: '#666', fontSize: '13px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                >×</button>
              )}
            </div>

            {/* Divider between filter and the source/project list */}
            <div style={{ height: '1px', background: '#1a1a1a', margin: '14px 10px 0' }} />

            <div
              ref={listRef}
              style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}
              onDragOver={e => {
                if (draggingId && !e.dataTransfer.types.includes('Files')) {
                  handleListDragOver(e)
                }
              }}
              onDrop={handleListDrop}
            >
              {/* Inbox / floating area */}
              {visibleInbox.length === 0 && namedProjects.length === 0 ? (
                <div style={{ padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#555', lineHeight: 1.7 }}>Select a file or paste a URL to begin.</span>
                </div>
              ) : (
                <div
                  onDragOver={e => {
                    if (!e.dataTransfer.types.includes('application/x-proof-source-id')) return
                    e.preventDefault(); e.stopPropagation()
                    setDropTargetId(INBOX_ID)
                  }}
                  onDragLeave={e => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropTargetId(null)
                  }}
                  onDrop={e => { handleInboxDrop(e); setDropTargetId(null) }}
                  style={{
                    minHeight: dropTargetId === INBOX_ID ? '32px' : '0',
                    background: dropTargetId === INBOX_ID ? 'rgba(92,168,160,0.05)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  {visibleInbox.map(src => (
                    <div key={src.id} style={{ opacity: src.id === draggingId ? 0.35 : 1, transition: 'opacity 0.1s' }}>
                      <SourceItem
                        src={src}
                        onDragStart={handleItemDragStart}
                        onDragEnd={handleItemDragEnd}
                      />
                    </div>
                  ))}
                  {visibleInbox.length === 0 && namedProjects.length > 0 && draggingId && dropTargetId === INBOX_ID && (
                    <div style={{ padding: '8px 16px', fontSize: '11px', color: '#5ca8a0', letterSpacing: '0.03em' }}>
                      Drop to make floating
                    </div>
                  )}
                </div>
              )}

              {q && inboxSources.length > 0 && visibleInbox.length === 0 && (
                <div style={{ padding: '6px 16px', fontSize: '12px', color: '#555' }}>No results</div>
              )}

              {/* Named project folders — render in liveOrder while a folder
                  is being dragged so the user sees the new position before
                  release. */}
              {(draggingProjId && projLiveOrder
                ? projLiveOrder.map(id => namedProjects.find(p => p.id === id)).filter(Boolean) as typeof namedProjects
                : namedProjects
              ).map(proj => {
                const isActive    = proj.id === activeId
                const isCollapsed = !expanded.has(proj.id)
                const projSrcs    = proj.sources
                const visibleSrcs = liveOrder && draggingId && projSrcs.some(s => s.id === draggingId)
                  ? liveOrder.map(id => projSrcs.find(s => s.id === id)).filter(Boolean) as typeof projSrcs
                  : filterSources(projSrcs)
                const isDropTarget = dropTargetId === proj.id
                const isDraggingMe = draggingProjId === proj.id

                return (
                  <div key={proj.id} style={{ opacity: isDraggingMe ? 0.35 : 1, transition: 'opacity 0.1s' }}>
                    {/* Folder header */}
                    <div
                      draggable
                      onDragStart={e => handleProjDragStart(proj.id, e)}
                      onDragEnd={handleProjDragEnd}
                      onClick={e => {
                        // Suppress the click toggle when finishing a drag —
                        // browsers fire onClick after onDragEnd in some cases.
                        if (draggingProjId) return
                        e.stopPropagation()
                        switchProject(proj.id)
                        setExpanded(s => { const n = new Set(s); isCollapsed ? n.add(proj.id) : n.delete(proj.id); return n })
                      }}
                      onDragOver={e => {
                        // Project drag → reorder. Source drag → drop-into-folder.
                        if (e.dataTransfer.types.includes(PROJ_DRAG_TYPE)) {
                          handleProjDragOverHeader(proj.id, e)
                        } else {
                          handleFolderDragOver(proj.id, e)
                        }
                      }}
                      onDragLeave={() => setDropTargetId(null)}
                      onDrop={e => handleFolderDrop(proj.id, e)}
                      onContextMenu={e => {
                        e.preventDefault(); e.stopPropagation()
                        setConfirmDeleteId(null)
                        setMenuProjId(proj.id)
                        setMenuPos({ top: e.clientY, left: e.clientX })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 16px 7px 14px',
                        background: isDropTarget ? 'rgba(92,168,160,0.06)' : isActive ? '#0f0f0f' : 'transparent',
                        borderBottom: isDropTarget ? '1px solid rgba(92,168,160,0.15)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                        userSelect: 'none',
                        marginTop: '2px',
                      }}
                      onMouseEnter={e => { if (!isActive && !isDropTarget) e.currentTarget.style.background = '#0a0a0a' }}
                      onMouseLeave={e => { if (!isActive && !isDropTarget) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Chevron */}
                      <button
                        onClick={e => { e.stopPropagation(); setExpanded(s => { const n = new Set(s); isCollapsed ? n.add(proj.id) : n.delete(proj.id); return n }) }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}
                      >
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none"
                          stroke={isActive ? '#888' : '#444'} strokeWidth="1.2"
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}
                        >
                          <path d="M1 1.5l3 3 3-3" />
                        </svg>
                      </button>

                      {/* Name / rename input */}
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
                            fontSize: '11px', color: '#ccc', fontFamily: 'inherit',
                            padding: 0, letterSpacing: '0.04em',
                          }}
                        />
                      ) : (
                        <span
                          onClick={() => switchProject(proj.id)}
                          style={{
                            flex: 1, fontSize: '11px', letterSpacing: '0.04em',
                            color: isActive ? '#bbb' : '#555',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            transition: 'color 0.12s',
                          }}
                        >
                          {proj.name}
                        </span>
                      )}
                    </div>

                    {/* Folder contents */}
                    {!isCollapsed && (
                      <div style={{ paddingLeft: '8px' }}>
                        {visibleSrcs.length === 0 && !q && (
                          <div style={{ padding: '6px 16px 8px', fontSize: '11px', color: '#3a3a3a', letterSpacing: '0.02em' }}>
                            Drop files here
                          </div>
                        )}
                        {visibleSrcs.map(src => (
                          <div key={src.id} style={{ opacity: src.id === draggingId ? 0.35 : 1, transition: 'opacity 0.1s' }}>
                            <SourceItem
                              src={src}
                              onDragStart={handleItemDragStart}
                              onDragEnd={handleItemDragEnd}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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
              {confirmDeleteId === proj.id ? 'Confirm?' : 'Delete'}
            </button>
          </div>
        )
      })()}

      {/* Source Stack — pinned ingestion queue. Sits at the bottom of the
          sidebar, above the Clock, so a quick drop-from-anywhere lands in
          a predictable place. Hidden while the clock fills the sidebar. */}
      <SourceStack hidden={clockOpen} />

      <Clock open={clockOpen} onToggle={() => setClockOpen(o => !o)} />
    </div>
  )
}

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

function UrlBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        margin: '8px 10px 0', padding: '11px 14px',
        background: hov ? '#111' : '#0d0d0d',
        border: `1px solid ${hov ? '#252525' : '#1a1a1a'}`,
        borderRadius: '4px', display: 'flex', alignItems: 'center',
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.04em', flex: 1 }}>Add URL</span>
    </div>
  )
}
