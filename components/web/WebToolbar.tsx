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
        width: '24px', height: '24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: '3px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#333' : '#666',
        fontSize: '16px', fontFamily: 'inherit', padding: 0, outline: 'none',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#aaa' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#666' }}
    >{children}</button>
  )
}

export function ViewPinBtn({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => { if (!disabled) setHover(true) }}
      onMouseLeave={() => setHover(false)}
      style={{
        height: '22px', flexShrink: 0, display: 'flex', alignItems: 'center',
        background: 'none',
        border: `1px solid ${disabled ? '#1e1e1e' : hover ? '#333' : '#252525'}`,
        borderRadius: '3px',
        color: disabled ? '#333' : hover ? '#aaa' : '#666',
        fontSize: '11px', padding: '0 7px', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {label}
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
      height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
      gap: '3px', padding: '0 8px', borderBottom: '1px solid #1e1e1e', background: '#060606',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <NavBtn disabled={!active?.canGoBack}    onClick={onGoBack}    title="Back">‹</NavBtn>
      <NavBtn disabled={!active?.canGoForward} onClick={onGoForward} title="Forward">›</NavBtn>
      <NavBtn onClick={onReload} title={active?.loading ? 'Stop' : 'Reload'}>
        {active?.loading ? '×' : '↺'}
      </NavBtn>
      <NavBtn onClick={onHome} title="Home">⌂</NavBtn>
      <input
        ref={urlInputRef}
        value={urlInput}
        onChange={e => onUrlChange(e.target.value)}
        onFocus={onUrlFocus}
        onBlur={onUrlBlur}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); onUrlSubmit() } }}
        placeholder="Search or enter URL"
        style={{
          flex: 1, height: '22px', background: '#111', border: '1px solid #252525',
          borderRadius: '3px', color: '#bbb', fontSize: '11px', padding: '0 8px',
          outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
        }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#444' }}
        onBlurCapture={e  => { e.currentTarget.style.borderColor = '#252525' }}
      />
      <ViewPinBtn
        label={actionFeedback === 'view1' ? 'Opened in View' : '1'}
        title={hasUrl ? 'Open in View' : 'Open a page first'}
        onClick={() => onPin(1)}
        disabled={!hasUrl}
      />
      <ViewPinBtn
        label={actionFeedback === 'view2' ? 'Opened in View 2' : '2'}
        title={hasUrl ? 'Open in View 2' : 'Open a page first'}
        onClick={() => onPin(2)}
        disabled={!hasUrl}
      />
      <button
        onClick={onSave}
        title={hasUrl ? 'Save to Pages' : 'Open a page first'}
        disabled={!hasUrl}
        style={{
          height: '22px', flexShrink: 0, display: 'flex', alignItems: 'center',
          background: 'none', border: `1px solid ${hasUrl ? '#252525' : '#1e1e1e'}`, borderRadius: '3px',
          color: hasUrl ? '#666' : '#333', fontSize: '11px', padding: '0 7px',
          cursor: hasUrl ? 'pointer' : 'default',
          fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
          transition: 'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { if (hasUrl) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#aaa' } }}
        onMouseLeave={e => { if (hasUrl) { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.color = '#666' } }}
      >
        {actionFeedback === 'saved' ? 'Saved to Pages' : actionFeedback === 'duplicate' ? 'Already saved' : 'Save'}
      </button>
    </div>
  )
}
