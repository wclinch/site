'use client'
import React, { useState } from 'react'
import type { TabState } from './webTypes'

export function NavBtn({ children, onClick, disabled, title }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        width: '30px', height: '30px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: '4px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#8A8780' : '#8A8780',
        fontFamily: 'inherit', padding: 0, outline: 'none', lineHeight: 0,
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#8A8780' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#8A8780' }}
    >{children}</button>
  )
}

function ActionBtn({ children, title, onClick, disabled, active }: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => { if (!disabled) setHov(true) }}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '28px', height: '26px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#171817' : hov && !disabled ? '#171817' : 'none',
        border: `1px solid ${active ? '#9b9892' : hov && !disabled ? '#232523' : 'transparent'}`,
        borderRadius: '4px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#8A8780' : active ? '#8A8780' : hov ? '#8A8780' : '#8A8780',
        padding: 0, outline: 'none', lineHeight: 0,
        fontFamily: 'inherit', transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function WebToolbar({ active, panelId, urlInput, urlInputRef, homeMode, actionFeedback, onUrlChange, onUrlFocus, onUrlBlur, onUrlSubmit, onGoBack, onGoForward, onReload, onHome, onSave }: {
  active: TabState | undefined
  panelId: string
  urlInput: string
  urlInputRef: React.RefObject<HTMLInputElement | null>
  homeMode: boolean
  actionFeedback: null | 'saved' | 'duplicate'
  onUrlChange: (val: string) => void
  onUrlFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onUrlBlur: () => void
  onUrlSubmit: () => void
  onGoBack: () => void
  onGoForward: () => void
  onReload: () => void
  onHome: () => void
  onSave: () => void
}) {
  const hasUrl = !!active?.url
  return (
    <div style={{
      height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
      gap: '6px', padding: '0 16px 0 12px', borderBottom: '1px solid #232523', background: '#080909',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <NavBtn disabled={!active?.canGoBack}    onClick={onGoBack}    title="Go back">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,1 1,6 6,11" />
        </svg>
      </NavBtn>
      <NavBtn disabled={!active?.canGoForward} onClick={onGoForward} title="Go forward">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1,1 6,6 1,11" />
        </svg>
      </NavBtn>
      <NavBtn onClick={onReload} title={active?.loading ? 'Stop' : 'Reload'}>
        {active?.loading ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 6.5A4.5 4.5 0 1 1 8 2.2" />
            <polyline points="7.5,0.5 9,2 7.5,3.5" />
          </svg>
        )}
      </NavBtn>
      <NavBtn onClick={onHome} title="New tab">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 6.5L7 1.5l5.5 5M3 8v4.5h3V9.5h2v3h3V8" />
        </svg>
      </NavBtn>
      <div style={{ width: '4px', flexShrink: 0 }} />
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: '9px', color: '#8A8780', pointerEvents: 'none', flexShrink: 0 }}>
          <circle cx="6" cy="6" r="4.5" />
          <line x1="9.5" y1="9.5" x2="13" y2="13" />
        </svg>
        <input
          ref={urlInputRef}
          value={urlInput}
          onChange={e => onUrlChange(e.target.value)}
          onFocus={onUrlFocus}
          onBlur={onUrlBlur}
          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); onUrlSubmit() } }}
          placeholder="Search or enter URL"
          style={{
            flex: 1, width: '100%', height: '28px', background: '#171817', border: '1px solid #232523',
            borderRadius: '4px', color: '#E6E2D8', fontSize: '12px', padding: '0 10px 0 28px',
            outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = '#8A8780' }}
          onBlurCapture={e  => { e.currentTarget.style.borderColor = '#232523' }}
        />
      </div>
      {/* Save page to session */}
      <ActionBtn
        title={actionFeedback === 'duplicate' ? 'Already saved' : hasUrl ? 'Save page' : 'Open a page first'}
        onClick={onSave} disabled={!hasUrl} active={actionFeedback === 'saved' || actionFeedback === 'duplicate'}
      >
        {actionFeedback === 'saved' ? (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 3.5,6.5 9,1" />
          </svg>
        ) : (
          <svg width="9" height="12" viewBox="0 0 9 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1h7v10l-3.5-2L1 11V1z" />
          </svg>
        )}
      </ActionBtn>
    </div>
  )
}
