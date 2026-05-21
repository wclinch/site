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
        color: disabled ? '#2e2e2e' : '#666',
        fontSize: '17px', fontFamily: 'inherit', padding: 0, outline: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#aaa' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#666' }}
    >{children}</button>
  )
}

function ToolbarIconBtn({ children, title, onClick, disabled, active }: {
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
        width: '32px', height: '30px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#1c1c1c' : hov && !disabled ? '#141414' : 'none',
        border: `1px solid ${active ? '#333' : hov && !disabled ? '#2a2a2a' : disabled ? '#181818' : '#222'}`,
        borderRadius: '4px',
        color: disabled ? '#2a2a2a' : active ? '#c8c8c8' : hov ? '#999' : '#555',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0, outline: 'none', lineHeight: 0,
        fontFamily: 'inherit',
        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function WebToolbar({ active, panelId, urlInput, urlInputRef, homeMode, actionFeedback, onUrlChange, onUrlFocus, onUrlBlur, onUrlSubmit, onGoBack, onGoForward, onReload, onHome, onPin, onSave }: {
  active: TabState | undefined
  panelId: string
  urlInput: string
  urlInputRef: React.RefObject<HTMLInputElement | null>
  homeMode: boolean
  actionFeedback: null | 'view1' | 'view2' | 'saved' | 'duplicate'
  onUrlChange: (val: string) => void
  onUrlFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onUrlBlur: () => void
  onUrlSubmit: () => void
  onGoBack: () => void
  onGoForward: () => void
  onReload: () => void
  onHome: () => void
  onPin: (view: 1 | 2) => void
  onSave: () => void
}) {
  const hasUrl = !!active?.url
  return (
    <div style={{
      height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
      gap: '6px', padding: '0 16px 0 12px', borderBottom: '1px solid #1e1e1e', background: '#060606',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <NavBtn disabled={!active?.canGoBack}    onClick={onGoBack}    title="Back">‹</NavBtn>
      <NavBtn disabled={!active?.canGoForward} onClick={onGoForward} title="Forward">›</NavBtn>
      <NavBtn onClick={onReload} title={active?.loading ? 'Stop' : 'Reload'}>
        {active?.loading ? '×' : '↺'}
      </NavBtn>
      <NavBtn onClick={onHome} title="Home">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 6.5L7 1.5l5.5 5M3 8v4.5h3V9.5h2v3h3V8" />
        </svg>
      </NavBtn>
      <div style={{ width: '4px', flexShrink: 0 }} />
      <input
        ref={urlInputRef}
        value={urlInput}
        onChange={e => onUrlChange(e.target.value)}
        onFocus={onUrlFocus}
        onBlur={onUrlBlur}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); onUrlSubmit() } }}
        placeholder="Search or enter URL"
        style={{
          flex: 1, height: '28px', background: '#111', border: '1px solid #252525',
          borderRadius: '4px', color: '#bbb', fontSize: '12px', padding: '0 10px',
          outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#444' }}
        onBlurCapture={e  => { e.currentTarget.style.borderColor = '#252525' }}
      />
      <div style={{ width: '6px', flexShrink: 0 }} />

      {/* Open in View 1 */}
      <ToolbarIconBtn
        title={hasUrl ? 'Open in View 1' : 'Open a page first'}
        onClick={() => onPin(1)}
        disabled={!hasUrl}
        active={actionFeedback === 'view1'}
      >
        <span style={{ fontSize: '11px', letterSpacing: '0.02em', lineHeight: 1 }}>1</span>
      </ToolbarIconBtn>

      {/* Open in View 2 */}
      <ToolbarIconBtn
        title={hasUrl ? 'Open in View 2' : 'Open a page first'}
        onClick={() => onPin(2)}
        disabled={!hasUrl}
        active={actionFeedback === 'view2'}
      >
        <span style={{ fontSize: '11px', letterSpacing: '0.02em', lineHeight: 1 }}>2</span>
      </ToolbarIconBtn>

      {/* Save page to session */}
      <ToolbarIconBtn
        title={hasUrl ? 'Save page to session' : 'Open a page first'}
        onClick={onSave}
        disabled={!hasUrl}
        active={actionFeedback === 'saved' || actionFeedback === 'duplicate'}
      >
        <svg width="10" height="13" viewBox="0 0 10 13"
          fill={actionFeedback === 'saved' || actionFeedback === 'duplicate' ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 1.5h7v10l-3.5-2-3.5 2V1.5z" />
        </svg>
      </ToolbarIconBtn>
    </div>
  )
}
