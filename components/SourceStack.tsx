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

const COLLAPSED_HEIGHT = 28      // px, matches the Clock collapsed row
const EXPANDED_MAX_VH  = '35vh'  // ≈ 35% of sidebar height — fixed cap
const EXPANDED_MIN_PX  = 160     // floor so an empty stack still has presence

// `application/x-proof-source-id` is the drag type SourceItem sets when a
// source is dragged from the main list. Reusing it lets users drag any
// source from anywhere in the sidebar straight into the stack.
const DRAG_TYPE = 'application/x-proof-source-id'

export default function SourceStack({ hidden = false }: { hidden?: boolean }) {
  const {
    stackSources, stackLimit, atStackLimit,
    addToStack, removeFromStack, clearStack, reorderStack, openInPane,
    selectedId, selectedImageId, allSources,
  } = useApp()

  const [open, setOpen]         = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [reorderIdx, setReorderIdx] = useState<number | null>(null) // hovered drop slot during in-stack reorder
  const dragSrcIdRef = useRef<string | null>(null)
  const listRef     = useRef<HTMLDivElement>(null)

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

  // Header — visible in both collapsed and expanded states. Click anywhere
  // on it (except the action buttons) toggles open.
  const header = (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        height: `${COLLAPSED_HEIGHT}px`, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0 8px 0 14px',
        borderTop: '1px solid #1a1a1a',
        cursor: 'pointer', userSelect: 'none',
        background: dragOver ? 'rgba(92,168,160,0.05)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <span style={{
        fontSize: '10px', color: open ? '#888' : '#555',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        transition: 'color 0.12s',
      }}>
        Stack
      </span>
      <span style={{
        fontSize: '10px',
        color: atStackLimit ? '#a55' : '#3a3a3a',
        letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
      }}>
        {stackSources.length} / {stackLimit}
      </span>
      <span style={{ flex: 1 }} />
      {open && stackSources.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); clearStack() }}
          title="Empty the stack"
          style={{
            background: 'none', border: 'none', padding: '2px 6px',
            cursor: 'pointer', fontSize: '10px', color: '#444',
            letterSpacing: '0.06em', fontFamily: 'inherit',
            textTransform: 'uppercase', borderRadius: '2px',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >Clear</button>
      )}
      <Chevron open={open} />
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
        background: dragOver ? 'rgba(92,168,160,0.03)' : 'transparent',
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
            color: dragOver ? '#5ca8a0' : '#3a3a3a',
            letterSpacing: '0.03em', lineHeight: 1.6,
            transition: 'color 0.12s',
          }}>
            {dragOver
              ? 'Drop to add to stack'
              : 'Drop sources here to keep them at hand. Click any item to load it into the viewer.'}
          </div>
        ) : (
          stackSources.map((src, i) => {
            const isActiveTop    = src.id === selectedImageId
            const isActiveBottom = src.id === selectedId
            const isActive = isActiveTop || isActiveBottom
            const isDraggingMe = dragSrcIdRef.current === src.id
            const showSlotBefore = reorderIdx === i && !isDraggingMe
            return (
              <div key={src.id}>
                {showSlotBefore && <DropSlot />}
                <StackRow
                  src={src}
                  isActive={isActive}
                  pane={src.fileType === 'image' ? 'top' : 'bottom'}
                  onClick={() => openInPane(src.id)}
                  onRemove={() => removeFromStack(src.id)}
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
  src, isActive, pane, onClick, onRemove,
  onDragStart, onDragEnd, onDragOverRow,
}: {
  src: QueuedSource
  isActive: boolean
  pane: 'top' | 'bottom'
  onClick: () => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOverRow: (e: React.DragEvent) => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverRow}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${src.label || src.raw} — open in ${pane === 'top' ? 'top' : 'bottom'} pane`}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px 6px 14px',
        cursor: 'pointer', userSelect: 'none',
        background: isActive ? '#0f0f0f' : hov ? '#0a0a0a' : 'transparent',
        borderLeft: isActive ? '2px solid #5ca8a0' : '2px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <PaneArrow pane={pane} dim={!isActive} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: '11px', letterSpacing: '0.02em',
        color: isActive ? '#bbb' : hov ? '#888' : '#666',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.1s',
      }}>
        {src.label || src.raw}
      </span>
      <TypeBadge kind={badgeKind(src)} />
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        title="Remove from stack"
        style={{
          background: 'none', border: 'none', padding: '0 2px',
          cursor: 'pointer', lineHeight: 1, color: '#444',
          fontSize: '12px', borderRadius: '2px',
          opacity: hov ? 1 : 0, transition: 'opacity 0.12s, color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#c66')}
        onMouseLeave={e => (e.currentTarget.style.color = '#444')}
      >×</button>
    </div>
  )
}

function DropSlot() {
  return (
    <div style={{
      height: '2px', margin: '2px 14px',
      background: '#5ca8a0', borderRadius: '1px',
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

function TypeBadge({ kind }: { kind: 'IMG' | 'PDF' | 'URL' | 'NOTE' }) {
  return (
    <span style={{
      flexShrink: 0,
      fontSize: '8px', letterSpacing: '0.1em',
      color: '#555', background: '#141414',
      border: '1px solid #1e1e1e', borderRadius: '2px',
      padding: '1px 4px',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {kind}
    </span>
  )
}

function PaneArrow({ pane, dim }: { pane: 'top' | 'bottom'; dim: boolean }) {
  const color = dim ? '#333' : '#5ca8a0'
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'stroke 0.1s' }}
    >
      {pane === 'top'
        ? <><path d="M4.5 7.5v-6" /><path d="M2 4l2.5-2.5L7 4" /></>
        : <><path d="M4.5 1.5v6" /><path d="M2 5l2.5 2.5L7 5" /></>
      }
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="9" height="7" viewBox="0 0 9 7" fill="none"
      stroke="#555" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
      style={{
        transition: 'transform 0.15s',
        transform: open ? 'rotate(0)' : 'rotate(180deg)',
        flexShrink: 0,
      }}
    >
      <path d="M1.5 5l3-3 3 3" />
    </svg>
  )
}
