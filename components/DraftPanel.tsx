'use client'
import { useState, useEffect, useRef } from 'react'
import { useApp } from '@/context/AppContext'

const MENU_BTN: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'none', border: 'none', padding: '9px 14px',
  cursor: 'pointer', fontSize: '12px', color: '#777',
  letterSpacing: '0.04em', fontFamily: 'inherit',
}

export default function DraftPanel() {
  const { activeId, activeProject, updateProject } = useApp()

  const [text, setText]                 = useState('')
  const [ctxMenu, setCtxMenu]           = useState<{ x: number; y: number } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText(activeProject?.projectDraft ?? '')
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(val: string) {
    setText(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (activeId) updateProject(activeId, { projectDraft: val })
    }, 400)
  }

  function handleExport(fmt: 'txt' | 'md') {
    const name = activeProject?.name ?? 'draft'
    const slug = name.replace(/\s+/g, '-').toLowerCase()
    const blob = new Blob([text.trim()], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${slug}.${fmt}`
    a.click()
    URL.revokeObjectURL(a.href)
    setCtxMenu(null)
  }

  const wordCount  = text.split(/\s+/).filter(Boolean).length
  const hasContent = text.trim().length > 0

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '0 8px 0 14px', height: '28px', flexShrink: 0,
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '10px', color: '#888', letterSpacing: '0.04em' }}>
          Draft
        </span>

        {hasContent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#666' }}>{wordCount}w</span>
            <button
              ref={menuBtnRef}
              onClick={() => {
                setConfirmClear(false)
                if (!menuBtnRef.current) return
                const r = menuBtnRef.current.getBoundingClientRect()
                setCtxMenu({ x: window.innerWidth - r.right, y: r.bottom + 4 })
              }}
              style={{
                background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer',
                fontSize: '14px', color: '#666', fontFamily: 'inherit', outline: 'none',
                letterSpacing: '0.1em', lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#bbb')}
              onMouseLeave={e => (e.currentTarget.style.color = '#666')}
            >···</button>
          </div>
        )}
      </div>

      {/* Writing surface */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <textarea
          className="prose-area"
          value={text}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const el    = e.currentTarget
              const start = el.selectionStart
              const end   = el.selectionEnd
              const next  = text.substring(0, start) + '\t' + text.substring(end)
              handleChange(next)
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 1 })
            }
          }}
          placeholder="Draft."
          style={{
            width: '100%', minHeight: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            resize: 'none',
            fontSize: '15px', lineHeight: 1.9, color: '#ccc',
            fontFamily: 'inherit',
            padding: 0,
            tabSize: 4,
          }}
        />
      </div>


      {/* Options menu */}
      {ctxMenu && (
        <>
          <div
            onClick={() => { setCtxMenu(null); setConfirmClear(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          />
          <div style={{
            position: 'fixed', right: ctxMenu.x, top: ctxMenu.y,
            background: '#0d0d0d', border: '1px solid #1a1a1a',
            borderRadius: '4px', zIndex: 200, minWidth: '140px',
            overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            <button onClick={() => handleExport('txt')} style={MENU_BTN}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >Export</button>
            <div style={{ height: '1px', background: '#1a1a1a' }} />
            <button
              onClick={() => {
                if (confirmClear) { handleChange(''); setCtxMenu(null) }
                else setConfirmClear(true)
              }}
              style={{ ...MENU_BTN, color: confirmClear ? '#e55' : '#c55' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {confirmClear ? 'Confirm' : 'Clear draft'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

