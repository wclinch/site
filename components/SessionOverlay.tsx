'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'

export default function SessionOverlay() {
  const { projects, createProject, resumeSession, lastActiveId } = useApp()
  const [showSaved, setShowSaved] = useState(false)

  const hasSessions  = projects.length > 0
  const lastSession  = projects.find(p => p.id === lastActiveId) ?? projects[projects.length - 1] ?? null

  // The native WebContentsView persists across renders. Zero its bounds
  // immediately so it doesn't sit on top of this overlay.
  useEffect(() => {
    window.electronAPI?.research?.setBounds({
      x: 0, y: 0, width: 0, height: 0,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    })
  }, [])

  function generateName(): string {
    const d    = new Date()
    const mon  = d.toLocaleString('default', { month: 'short' })
    const day  = d.getDate()
    const base = `Session – ${mon} ${day}`
    if (!projects.some(p => p.name === base)) return base
    let n = 2
    while (projects.some(p => p.name === `${base} (${n})`)) n++
    return `${base} (${n})`
  }

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#080808',
      padding: '0 24px',
    }}>
      <div style={{ width: '100%', maxWidth: '300px' }}>

        {/* Title */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '15px', color: '#bbb', letterSpacing: '0.02em', marginBottom: '10px' }}>
            Start a session
          </div>
          <div style={{ fontSize: '11px', color: '#3a3a3a', letterSpacing: '0.04em', lineHeight: 1.8 }}>
            Save sources, open references,<br />and work in the browser.
          </div>
        </div>

        {/* Primary actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

          {hasSessions && lastSession && (
            <button
              onClick={() => resumeSession(lastSession.id)}
              style={BTN_PRIMARY}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#444'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#2a2a2a'
                e.currentTarget.style.color = '#ccc'
              }}
            >
              <span>Resume last session</span>
              <span style={{
                fontSize: '10px', color: '#555',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '120px', flexShrink: 0,
              }}>
                {lastSession.name}
              </span>
            </button>
          )}

          <button
            onClick={() => createProject(generateName())}
            style={hasSessions ? BTN_SECONDARY : BTN_PRIMARY}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = hasSessions ? '#333' : '#444'
              e.currentTarget.style.color = hasSessions ? '#bbb' : '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = hasSessions ? '#1e1e1e' : '#2a2a2a'
              e.currentTarget.style.color = hasSessions ? '#666' : '#ccc'
            }}
          >
            Start new session
          </button>

          {hasSessions && (
            <button
              onClick={() => setShowSaved(o => !o)}
              style={{
                ...BTN_GHOST,
                color: showSaved ? '#555' : '#2a2a2a',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#777')}
              onMouseLeave={e => (e.currentTarget.style.color = showSaved ? '#555' : '#2a2a2a')}
            >
              {showSaved ? 'Hide sessions' : 'Open saved session'}
            </button>
          )}
        </div>

        {/* Saved sessions list */}
        {showSaved && hasSessions && (
          <div style={{
            marginTop: '10px',
            border: '1px solid #1a1a1a',
            borderRadius: '4px',
            overflow: 'hidden',
            maxHeight: '220px',
            overflowY: 'auto',
          }}>
            {projects.map((proj, i) => (
              <button
                key={proj.id}
                onClick={() => resumeSession(proj.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none',
                  borderBottom: i < projects.length - 1 ? '1px solid #141414' : 'none',
                  padding: '9px 14px', cursor: 'pointer',
                  fontFamily: 'inherit', outline: 'none',
                  gap: '12px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0d0d0d')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{
                  fontSize: '11px', color: proj.id === lastActiveId ? '#bbb' : '#777',
                  letterSpacing: '0.03em', textAlign: 'left',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                }}>
                  {proj.name}
                </span>
                <span style={{ fontSize: '10px', color: '#2a2a2a', letterSpacing: '0.03em', flexShrink: 0 }}>
                  {proj.sources.length}
                </span>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Button styles ────────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
  width: '100%', background: 'none', border: '1px solid',
  borderRadius: '4px', padding: '10px 16px',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
  letterSpacing: '0.03em', textAlign: 'left', outline: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  transition: 'border-color 0.12s, color 0.12s',
}

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_BASE,
  borderColor: '#2a2a2a',
  color: '#ccc',
}

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_BASE,
  borderColor: '#1e1e1e',
  color: '#666',
}

const BTN_GHOST: React.CSSProperties = {
  background: 'none', border: 'none',
  fontSize: '11px', padding: '7px 0',
  cursor: 'pointer', fontFamily: 'inherit',
  letterSpacing: '0.04em', textAlign: 'left', outline: 'none',
  transition: 'color 0.12s',
}
