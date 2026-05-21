'use client'
import React, { useState } from 'react'
import type { TabState } from './webTypes'

export function FocusExpandIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,1 1,1 1,3" /><polyline points="7,1 9,1 9,3" />
      <polyline points="3,9 1,9 1,7" /><polyline points="7,9 9,9 9,7" />
    </svg>
  )
}

export function FocusCollapseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,3 3,3 3,1" /><polyline points="9,3 7,3 7,1" />
      <polyline points="1,7 3,7 3,9" /><polyline points="9,7 7,7 7,9" />
    </svg>
  )
}

export function TabBarBtn({ children, onClick, title, active, borderLeft = true }: {
  children: React.ReactNode
  onClick?: () => void
  title: string
  active?: boolean
  borderLeft?: boolean
}) {
  const baseColor = active ? '#777' : '#444'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '36px', height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#141414' : 'none', border: 'none',
        borderLeft: borderLeft ? '1px solid #111' : 'none',
        color: baseColor,
        cursor: 'pointer',
        fontFamily: 'inherit', padding: 0, outline: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
      onMouseLeave={e => { e.currentTarget.style.color = baseColor }}
    >
      {children}
    </button>
  )
}

export function TabChip({ tab, active, onSelect, onClose }: {
  tab: TabState
  active: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const [hov, setHov] = useState(false)
  const label = tab.title
    || (tab.url ? (() => { try { return new URL(tab.url).hostname.replace(/^www\./, '') } catch { return tab.url } })() : 'New tab')

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        height: '29px', maxWidth: '160px', minWidth: '70px',
        padding: '0 8px 0 11px', borderRadius: '4px', flexShrink: 1,
        background: active ? '#141414' : hov ? '#0d0d0d' : 'transparent',
        border: active ? '1px solid #2a2a2a' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      {tab.loading && (
        <span style={{ fontSize: '8px', color: '#555', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>●</span>
      )}
      <span style={{
        fontSize: '11px', color: active ? '#c8c8c8' : hov ? '#888' : '#666',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        flex: 1, letterSpacing: '0.02em', transition: 'color 0.1s',
      }}>
        {label}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{
          width: '16px', height: '16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '2px',
          color: active ? '#555' : '#333', fontSize: '14px', cursor: 'pointer',
          padding: 0, outline: 'none', fontFamily: 'inherit', lineHeight: 1,
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
        onMouseLeave={e => { e.currentTarget.style.color = active ? '#555' : '#333' }}
      >×</button>
    </div>
  )
}

export default function WebTabBar({ tabs, activeTabId, panelId, isFocused, onFocusToggle }: {
  tabs: TabState[]
  activeTabId: string
  panelId: string
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  return (
    <div style={{
      height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center',
      background: '#050505', borderBottom: '1px solid #1e1e1e',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>

      {/* Expand/collapse — far left */}
      {onFocusToggle && (
        <TabBarBtn
          key={String(isFocused)}
          onClick={onFocusToggle}
          title={isFocused ? 'Exit expanded Web' : 'Expand Web'}
          borderLeft={false}
        >
          {isFocused ? <FocusCollapseIcon /> : <FocusExpandIcon />}
        </TabBarBtn>
      )}

      {/* Divider between expand and tabs */}
      {onFocusToggle && (
        <div style={{ width: '1px', height: '14px', background: '#1c1c1c', flexShrink: 0 }} />
      )}

      {/* Scrollable tab strip + new tab button directly after last tab */}
      <div
        className="tab-strip"
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden', gap: '3px', padding: '0 8px',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map(tab => (
          <TabChip
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => window.electronAPI?.research?.switchTab(panelId, tab.id)}
            onClose={() => window.electronAPI?.research?.closeTab(panelId, tab.id)}
          />
        ))}
        {/* + sits directly after the last tab */}
        <button
          onClick={() => window.electronAPI?.research?.newTab(panelId)}
          title="New tab"
          style={{
            width: '30px', height: '30px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            color: '#444', cursor: 'pointer', padding: 0, outline: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
