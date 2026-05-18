'use client'
import React, { useState } from 'react'
import type { TabState } from './webTypes'

export function FocusExpandIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3.5V1H3.5M5.5 1H8V3.5M8 5.5V8H5.5M3.5 8H1V5.5" />
    </svg>
  )
}

export function FocusCollapseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 1V3.5H1M8 3.5H5.5V1M5.5 8V5.5H8M1 5.5H3.5V8" />
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
        width: '28px', height: '28px', flexShrink: 0,
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
  const label = tab.title
    || (tab.url ? (() => { try { return new URL(tab.url).hostname.replace(/^www\./, '') } catch { return tab.url } })() : 'New tab')

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        height: '20px', maxWidth: '140px', minWidth: '40px',
        padding: '0 5px 0 7px', borderRadius: '3px', flexShrink: 1,
        background: active ? '#111' : 'transparent',
        border: active ? '1px solid #2a2a2a' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {tab.loading && (
        <span style={{ fontSize: '8px', color: '#444', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>●</span>
      )}
      <span style={{
        fontSize: '10px', color: active ? '#c2c2c2' : '#666',
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
          color: '#444', fontSize: '13px', cursor: 'pointer',
          padding: 0, outline: 'none', fontFamily: 'inherit', lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#777' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
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
      height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center',
      background: '#050505', borderBottom: '1px solid #1e1e1e',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <div
        className="tab-strip"
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden', gap: '1px', padding: '0 4px',
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
        <TabBarBtn
          onClick={() => window.electronAPI?.research?.newTab(panelId)}
          title="New tab"
          borderLeft={false}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </TabBarBtn>
      </div>

      {onFocusToggle && (
        <TabBarBtn
          key={String(isFocused)}
          onClick={onFocusToggle}
          title={isFocused ? 'Exit expanded Web' : 'Expand Web'}
        >
          {isFocused ? <FocusCollapseIcon /> : <FocusExpandIcon />}
        </TabBarBtn>
      )}
    </div>
  )
}
