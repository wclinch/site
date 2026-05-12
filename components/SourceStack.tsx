'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { QueuedSource } from '@/lib/types'

// Bottom-of-sidebar "ingestion queue" — a pinned, ordered list of sources
// the user wants quick access to. Drop a source on it to stage; click an
// item to load it into the right viewer pane (image → top, PDF/URL → bottom).
//
// State lives in AppContext (`stackIds`, `addToStack`, etc.) so removals and
// project deletes flow through automatically. This component is purely a
// view + drop target.

const COLLAPSED_HEIGHT = 28      // px, matches the standard panel header
const EXPANDED_MAX_VH  = '65vh'  // expanded stack is the primary working
                                 // surface but leaves ~35vh for the source
                                 // list above so it stays usable, not just
                                 // a thin header.
const EXPANDED_MIN_PX  = 380     // floor — drop target reads as a real
                                 // surface without crowding the list

// `application/x-proof-source-id` is the drag type SourceItem sets when a
// source is dragged from the main list. Reusing it lets users drag any
// source from anywhere in the sidebar straight into the stack.
const DRAG_TYPE = 'application/x-proof-source-id'

export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, stackLimit, atStackLimit,
    addToStack, reorderStack,
    setSelectedId, setSelectedImageId, setContextMenu,
    selectedId, selectedImageId, allSources, patchSource,
    activeId,
  } = useApp()

  // Open by default — the stack is part of the primary working surface,
  // not a hidden tray. The user can collapse it via the header chevron.
  const [open, setOpen]         = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [reorderIdx, setReorderIdx] = useState<number | null>(null) // hovered drop slot during in-stack reorder
  // Per-item pane override. By default a source loads into its natural
  // pane (image → top, PDF/URL/note → bottom); clicking the row's arrow
  // flips the preference so the next row-click loads it into the other
  // pane. Persisted only for the session — collapses on reload.
  const [paneOverrides, setPaneOverrides] = useState<Record<string, 'top' | 'bottom'>>({})
  // In-place rename state. Set by the `proof:rename-source` custom event
  // dispatched from SourceContextMenu when the user chooses Rename.
  // Cleared by Enter (commit) or Escape / blur (cancel).
  const [renameId,    setRenameId]    = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dragSrcIdRef = useRef<string | null>(null)
  const listRef     = useRef<HTMLDivElement>(null)

  // SourceContextMenu fires this when the user clicks Rename — we toggle
  // the matching row into edit mode. The previous SourceItem-based
  // source list owned this listener; with sources rendered only in the
  // stack now, the stack owns it.
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
  function cancelRename() {
    setRenameId(null)
    setRenameValue('')
  }

  // A source "looks like an image" if its fileType says so OR its
  // filename ends in a known image extension. The filename check covers
  // (a) legacy sources written before the fileType field existed, and
  // (b) any source whose fileType somehow got mislabeled. Images can
  // only render in the top pane — never togglable, never sent down to
  // the PDF viewer (which would crash on a PNG).
  const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp|heic|avif)$/
  function looksLikeImage(src: QueuedSource): boolean {
    if (src.fileType === 'image') return true
    const name = (src.label ?? src.raw ?? '').toLowerCase()
    return IMG_EXT.test(name)
  }
  function defaultPaneFor(src: QueuedSource): 'top' | 'bottom' {
    return looksLikeImage(src) ? 'top' : 'bottom'
  }
  function effectivePane(src: QueuedSource): 'top' | 'bottom' {
    return paneOverrides[src.id] ?? defaultPaneFor(src)
  }
  function togglePane(src: QueuedSource) {
    const next = effectivePane(src) === 'top' ? 'bottom' : 'top'
    setPaneOverrides(o => {
      // If the new value matches the natural default, drop the override
      // entirely so we don't pile up dead entries.
      if (next === defaultPaneFor(src)) {
        const { [src.id]: _, ...rest } = o
        return rest
      }
      return { ...o, [src.id]: next }
    })
  }
  function openSrcInEffectivePane(src: QueuedSource) {
    if (effectivePane(src) === 'top') setSelectedImageId(src.id)
    else setSelectedId(src.id)
  }

  // Auto-open the stack the first time something is added, so the user
  // sees the result of their drop. We don't auto-collapse — that's manual.
  useEffect(() => {
    if (stackSources.length > 0 && !open) setOpen(true)
    // intentionally only react to growth: if the user collapses after
    // adding, we leave them alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackSources.length === 0 ? 0 : 1])

  if (hidden) return null

  function onContainerDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    if (!open) setOpen(true)
    setDragOver(true)
  }

  function onContainerDragLeave(e: React.DragEvent) {
    // Only clear when leaving the wrapper entirely (not when crossing
    // between inner children).
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver(false)
      setReorderIdx(null)
    }
  }

  function onContainerDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setReorderIdx(null)
    const srcId = e.dataTransfer.getData(DRAG_TYPE)
    if (!srcId) return
    const fromIdx = stackSources.findIndex(s => s.id === srcId)
    if (fromIdx === -1) {
      // New item — append.
      addToStack(srcId)
    } else if (reorderIdx !== null) {
      reorderStack(fromIdx, reorderIdx)
    }
  }

  // Header — visible in both collapsed and expanded states. Matches the
  // standard 28px / borderBottom panel-header style used by the Reference
  // and Pdf/Website pane headers in ReaderPanel, so the Stack reads as
  // peer with them visually rather than a special floating tray.
  //
  // Only the expand/collapse icon is the toggle target — the header
  // surface itself doesn't react to clicks, so accidental clicks on the
  // label or count don't fire a collapse the user didn't intend.
  const header = (
    <div
      style={{
        height: `${COLLAPSED_HEIGHT}px`, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0 8px 0 14px',
        borderBottom: '1px solid #1a1a1a',
        borderTop: '1px solid #1a1a1a',
        userSelect: 'none',
        background: dragOver ? '#0d0d0d' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <span style={{
        fontSize: '10px', color: '#888',
        letterSpacing: '0.04em', userSelect: 'none',
      }}>
        Stack
      </span>
      <span style={{
        fontSize: '10px',
        color: atStackLimit ? '#a55' : '#555',
        letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
      }}>
        {stackSources.length} / {stackLimit}
      </span>
      <span style={{ flex: 1 }} />
      <HeaderIconBtn onClick={() => setOpen(o => !o)} title={open ? 'Collapse stack' : 'Expand stack'}>
        {open ? <CollapseIcon /> : <ExpandIcon />}
      </HeaderIconBtn>
    </div>
  )

  if (!open) {
    return (
      <div
        onDragOver={onContainerDragOver}
        onDragLeave={onContainerDragLeave}
        onDrop={onContainerDrop}
        style={{ flexShrink: 0 }}
      >
        {header}
      </div>
    )
  }

  return (
    <div
      onDragOver={onContainerDragOver}
      onDragLeave={onContainerDragLeave}
      onDrop={onContainerDrop}
      style={{
        flexShrink: 0,
        maxHeight: EXPANDED_MAX_VH,
        minHeight: `${EXPANDED_MIN_PX}px`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        background: dragOver ? '#0a0a0a' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {header}

      {/* Scrollable item list */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '4px 0 6px',
          display: 'flex', flexDirection: 'column', gap: '1px',
        }}
      >
        {stackSources.length === 0 ? (
          <div style={{
            padding: '14px 16px', fontSize: '11px',
            color: dragOver ? '#888' : '#3a3a3a',
            letterSpacing: '0.03em', lineHeight: 1.6,
            transition: 'color 0.12s',
          }}>
            {dragOver
              ? 'Release to add to project'
              : activeId
                ? 'This project has no sources.'
                : 'No active project.'}
          </div>
        ) : (
          stackSources.map((src, i) => {
            const isActiveTop    = src.id === selectedImageId
            const isActiveBottom = src.id === selectedId
            const isActive = isActiveTop || isActiveBottom
            const isDraggingMe = dragSrcIdRef.current === src.id
            const showSlotBefore = reorderIdx === i && !isDraggingMe
            const pane = effectivePane(src)
            // Both panes accept every source type now (SourceContent
            // routes by fileType internally), so the arrow toggles for
            // any source. Defaults stay sensible — images land top,
            // PDFs / URLs / notes land bottom — but the user can flip
            // any row to the other pane.
            const canToggle = true
            return (
              <div key={src.id}>
                {showSlotBefore && <DropSlot />}
                <StackRow
                  src={src}
                  isActive={isActive}
                  pane={pane}
                  canToggle={canToggle}
                  renaming={renameId === src.id}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameCommit={commitRename}
                  onRenameCancel={cancelRename}
                  onClick={() => openSrcInEffectivePane(src)}
                  onToggleArrow={() => togglePane(src)}
                  // Right-click opens SourceContextMenu (mounted in
                  // app/app/page.tsx). The menu's "Remove" item is the
                  // only path to delete a source from the stack now —
                  // no more × button.
                  onContextMenu={e => {
                    e.preventDefault(); e.stopPropagation()
                    setContextMenu({ srcId: src.id, x: e.clientX, y: e.clientY })
                  }}
                  onDragStart={e => {
                    dragSrcIdRef.current = src.id
                    e.dataTransfer.setData(DRAG_TYPE, src.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    dragSrcIdRef.current = null
                    setReorderIdx(null)
                  }}
                  onDragOverRow={e => {
                    // Only react to reorder drags (existing stack items).
                    const srcId = dragSrcIdRef.current
                    if (!srcId || !stackSources.some(s => s.id === srcId)) return
                    e.preventDefault()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const above = e.clientY < rect.top + rect.height / 2
                    const idx = above ? i : i + 1
                    if (idx !== reorderIdx) setReorderIdx(idx)
                  }}
                />
              </div>
            )
          })
        )}
        {/* Tail slot — reorder past the end */}
        {stackSources.length > 0 && reorderIdx === stackSources.length && <DropSlot />}
      </div>
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

function StackRow({
  src, isActive, pane, canToggle,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  onClick, onToggleArrow, onContextMenu,
  onDragStart, onDragEnd, onDragOverRow,
}: {
  src: QueuedSource
  isActive: boolean
  pane: 'top' | 'bottom'
  canToggle: boolean
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onClick: () => void
  onToggleArrow: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOverRow: (e: React.DragEvent) => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <div
      draggable={!renaming}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverRow}
      onClick={() => { if (!renaming) onClick() }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={renaming ? undefined : `${src.label || src.raw} — loads into ${pane === 'top' ? 'top' : 'bottom'} pane`}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px 6px 14px',
        cursor: renaming ? 'text' : 'pointer', userSelect: 'none',
        background: isActive ? '#111' : hov ? '#0d0d0d' : 'transparent',
        borderLeft: isActive ? '2px solid #444' : '2px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <PaneArrow
        pane={pane} dim={!isActive} interactive={canToggle && !renaming}
        onClick={e => { e.stopPropagation(); if (canToggle && !renaming) onToggleArrow() }}
        title={canToggle
          ? `Loads into ${pane === 'top' ? 'top' : 'bottom'} pane — click to flip`
          : `Loads into ${pane === 'top' ? 'top' : 'bottom'} pane`}
      />
      {renaming ? (
        <input
          autoFocus
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
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '11px', color: '#ccc', fontFamily: 'inherit',
            padding: 0, letterSpacing: '0.02em',
          }}
        />
      ) : (
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: '11px', letterSpacing: '0.02em',
          color: '#ccc',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {src.label || src.raw}
        </span>
      )}
      <TypeBadge kind={badgeKind(src)} />
    </div>
  )
}

function DropSlot() {
  return (
    <div style={{
      height: '2px', margin: '2px 14px',
      background: '#666', borderRadius: '1px',
      opacity: 0.7,
    }} />
  )
}

function badgeKind(src: QueuedSource): 'IMG' | 'PDF' | 'URL' | 'NOTE' {
  if (src.fileType === 'image') return 'IMG'
  if (src.fileType === 'url')   return 'URL'
  if (src.fileType === 'note')  return 'NOTE'
  return 'PDF'
}

// Per-type palette mirrors the file-type dot in SourceItem so a stacked
// item reads as the same "kind" of thing as it does in the main source
// list — color + glyph carry the same meaning across both surfaces.
const KIND_COLOR: Record<'IMG' | 'PDF' | 'URL' | 'NOTE', string> = {
  IMG:  '#5c9e6e',
  PDF:  '#5c7eb8',
  URL:  '#5ca8a0',
  NOTE: '#b8935c',
}

function TypeBadge({ kind }: { kind: 'IMG' | 'PDF' | 'URL' | 'NOTE' }) {
  const color = KIND_COLOR[kind]
  return (
    <span style={{
      flexShrink: 0,
      fontSize: '8px', letterSpacing: '0.1em',
      color, background: '#141414',
      border: '1px solid #1e1e1e', borderRadius: '2px',
      padding: '1px 4px',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {kind}
    </span>
  )
}

// Clickable only when `interactive` (i.e. the source can render in either
// pane — PDFs and URLs). For image/note rows the arrow is just a static
// indicator of which pane the source will land in, no hover state, no
// pointer cursor — same glyph but no implied affordance to flip it.
function PaneArrow({
  pane, dim, interactive, onClick, title,
}: {
  pane: 'top' | 'bottom'
  dim: boolean
  interactive: boolean
  onClick: (e: React.MouseEvent) => void
  title: string
}) {
  const [hov, setHov] = useState(false)
  const color = (interactive && hov) ? '#aaa' : (dim ? '#444' : '#888')
  return (
    <button
      onClick={onClick}
      title={title}
      // Bubble drag events through the host row instead of having the
      // button swallow them — otherwise grabbing the arrow to drag the
      // row would fail silently.
      draggable={false}
      onMouseEnter={() => interactive && setHov(true)}
      onMouseLeave={() => interactive && setHov(false)}
      tabIndex={interactive ? 0 : -1}
      style={{
        background: 'none', border: 'none',
        cursor: interactive ? 'pointer' : 'default',
        padding: '2px', lineHeight: 0, borderRadius: '2px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.1s' }}
      >
        {pane === 'top'
          ? <><path d="M4.5 7.5v-6" /><path d="M2 4l2.5-2.5L7 4" /></>
          : <><path d="M4.5 1.5v6" /><path d="M2 5l2.5 2.5L7 5" /></>
        }
      </svg>
    </button>
  )
}

// Bracket-style expand/collapse icons matching the Reference and Pdf/Website
// pane headers in ReaderPanel — so all three panel-header glyphs read as the
// same family.
function ExpandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4V1H4" /><path d="M7 1H10V4" />
      <path d="M10 7V10H7" /><path d="M4 10H1V7" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1V4H1" /><path d="M10 4H7V1" />
      <path d="M7 10V7H10" /><path d="M1 7H4V10" />
    </svg>
  )
}

// Sidebar palette is more muted than the center column — the bracket
// glyphs on ReaderPanel use #777/#bbb but in the sidebar that reads as
// too bright next to the #444-#555 text of the "+ New project" button and
// the rest of the action chrome. Step down one notch so the icon sits at
// the same weight as those neighbors.
function HeaderIconBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      // Clear hover state on click — the icon glyph swaps (expand ↔
      // collapse) but the button itself stays mounted under a stationary
      // cursor, so without this the post-click icon keeps the brighter
      // hover color until the user moves the mouse.
      onClick={() => { setHov(false); onClick() }}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px', lineHeight: 0, borderRadius: '2px',
        color: hov ? '#888' : '#555',
        transition: 'color 0.12s',
      }}
    >
      {children}
    </button>
  )
}
