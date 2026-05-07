'use client'
import { useState, useEffect, useRef } from 'react'
import type { Sentence } from '@/lib/types'

function buildPageLabel(sents: Sentence[]): string {
  const pages = Array.from(
    new Set(sents.map(s => s.page).filter(Boolean) as number[])
  ).sort((a, b) => a - b)
  if (!pages.length) return ''
  return pages.length === 1 ? `p. ${pages[0]}` : `p. ${pages[0]}–${pages[pages.length - 1]}`
}

interface Props {
  sentences:        Sentence[]
  centreId:         number
  sourceLabel:      string
  anchorRect:       DOMRect
  onDismiss:        () => void
  onDragStateChange: (dragging: boolean) => void
}

export default function ExtractionComposer({
  sentences, centreId, sourceLabel, anchorRect, onDismiss, onDragStateChange,
}: Props) {
  const composerRef = useRef<HTMLDivElement>(null)

  const W  = 340
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900

  function initPos() {
    const estimatedH = sentences.length * 54 + 80
    const rawLeft    = anchorRect.left + anchorRect.width / 2 - W / 2
    const left       = Math.max(12, Math.min(vw - W - 12, rawLeft))
    const below      = vh - anchorRect.bottom - 16
    const above      = below < estimatedH && anchorRect.top > below
    const top        = above ? Math.max(12, anchorRect.top - estimatedH - 8) : anchorRect.bottom + 8
    return { top, left }
  }

  const [pos, setPos] = useState(initPos)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  function handleGripMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    const sl = pos.left,  st = pos.top
    function onMove(ev: MouseEvent) {
      setPos({
        left: Math.max(8, Math.min(vw - W - 8, sl + ev.clientX - sx)),
        top:  Math.max(8, Math.min(vh - 120,   st + ev.clientY - sy)),
      })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }

  const label = buildPageLabel(sentences)

  return (
    <div
      ref={composerRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 999,
        background: '#111', border: '1px solid #252525',
        borderRadius: '6px', boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        overflow: 'hidden',
      }}
    >
      {/* Grip + × */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #1c1c1c', userSelect: 'none' }}>
        <div
          onMouseDown={handleGripMouseDown}
          style={{ flex: 1, padding: '8px 0 5px', cursor: 'grab', display: 'flex', justifyContent: 'center' }}
        >
          <span style={{ fontSize: '11px', color: '#444', letterSpacing: '0.18em' }}>⠿ ⠿ ⠿</span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', padding: '0 10px 0 4px',
            cursor: 'pointer', fontSize: '14px', color: '#555',
            fontFamily: 'inherit', outline: 'none', lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >×</button>
      </div>

      {/* Sentence rows — drag left to save, drag right to insert into draft */}
      <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '52vh', overflowY: 'auto' }}>
        {sentences.map(s => {
          const isCentre = s.i === centreId
          return (
            <div
              key={s.i}
              draggable
              onDragStart={e => {
                onDragStateChange(true)
                e.dataTransfer.setData('application/x-proof-highlight', s.text)
                e.dataTransfer.setData('text/plain', s.text)
                e.dataTransfer.setData('application/x-proof-sentence-id', String(s.i))
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onDragEnd={() => {
                // Small delay so any spurious click events after drag end are also blocked
                setTimeout(() => onDragStateChange(false), 100)
              }}
              style={{
                padding: '5px 8px', borderRadius: '3px', cursor: 'grab',
                fontSize: '12px', lineHeight: 1.6,
                color: isCentre ? '#ddd' : '#aaa',
                background: isCentre ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
                userSelect: 'none',
              }}
            >
              {s.text}
            </div>
          )
        })}
      </div>

      {/* Source label */}
      {(label || sourceLabel) && (
        <div style={{
          padding: '0 14px 10px',
          fontSize: '9px', color: '#555', letterSpacing: '0.07em',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          {label && <span>{label}</span>}
          {label && sourceLabel && <span>·</span>}
          {sourceLabel && (
            <span style={{ wordBreak: 'break-word', minWidth: 0, flex: 1 }}>{sourceLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
