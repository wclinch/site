'use client'
import React, { useState } from 'react'
import type { TabState } from './webTypes'

export function FocusExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,4 1,1 4,1" />
      <polyline points="8,1 11,1 11,4" />
      <polyline points="11,8 11,11 8,11" />
      <polyline points="4,11 1,11 1,8" />
    </svg>
  )
}

export function FocusCollapseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,1 4,4 1,4" />
      <polyline points="8,1 8,4 11,4" />
      <polyline points="11,8 8,8 8,11" />
      <polyline points="1,8 4,8 4,11" />
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
  const baseColor = active ? '#8A8780' : '#8A8780'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '36px', height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#171817' : 'none', border: 'none',
        borderLeft: borderLeft ? '1px solid #111' : 'none',
        color: baseColor,
        cursor: 'pointer',
        fontFamily: 'inherit', padding: 0, outline: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#8A8780' }}
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
      draggable={!!tab.url}
      onDragStart={e => {
        if (!tab.url) return
        e.dataTransfer.setData('application/x-proof-web-url', JSON.stringify({ url: tab.url, title: tab.title || tab.url }))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        height: '29px', maxWidth: '160px', minWidth: '70px',
        padding: '0 8px 0 11px', borderRadius: '4px', flexShrink: 1,
        background: active ? '#171817' : hov ? '#171817' : 'transparent',
        border: active ? '1px solid #232523' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      {tab.loading && (
        <span style={{ fontSize: '8px', color: '#8A8780', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>●</span>
      )}
      <span style={{
        fontSize: '11px', color: active ? '#E6E2D8' : hov ? '#E6E2D8' : '#8A8780',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        flex: 1, letterSpacing: '0.02em', transition: 'color 0.1s',
      }}>
        {label}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{
          width: '20px', height: '20px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '2px',
          color: active ? '#8A8780' : '#8A8780', cursor: 'pointer',
          padding: 0, outline: 'none', lineHeight: 0,
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#8A8780' }}
        onMouseLeave={e => { e.currentTarget.style.color = active ? '#8A8780' : '#8A8780' }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M1 1L8 8M8 1L1 8" />
        </svg>
      </button>
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
      background: '#080909', borderBottom: '1px solid #232523',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>

      {/* Expand/collapse — far left */}
      {onFocusToggle && (
        <TabBarBtn
          key={String(isFocused)}
          onClick={onFocusToggle}
          title={isFocused ? 'Restore' : 'Expand Web'}
          borderLeft={false}
        >
          {isFocused ? <FocusCollapseIcon /> : <FocusExpandIcon />}
        </TabBarBtn>
      )}

      {/* Divider between expand and tabs */}
      {onFocusToggle && (
        <div style={{ width: '1px', height: '14px', background: '#232523', flexShrink: 0 }} />
      )}

      {/* Scrollable tab strip + new tab button directly after last tab */}
      <div
        className="tab-strip"
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden', gap: '3px', padding: '0 8px',
          scrollbarWidth: 'none',
        }}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-proof-web-url')) e.preventDefault() }}
        onDrop={e => {
          const raw = e.dataTransfer.getData('application/x-proof-web-url')
          if (!raw) return
          try { const { url } = JSON.parse(raw); window.electronAPI?.research?.newTab(panelId, url) } catch {}
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
            color: '#8A8780', cursor: 'pointer', padding: 0, outline: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#8A8780' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8A8780' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
