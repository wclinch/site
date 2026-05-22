'use client'
import React, { useState, useRef } from 'react'
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
  const baseColor = active ? '#8C887F' : '#8C887F'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '36px', height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#111211' : 'none', border: 'none',
        borderLeft: borderLeft ? '1px solid #252725' : 'none',
        color: baseColor,
        cursor: 'pointer',
        fontFamily: 'inherit', padding: 0, outline: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#8C887F' }}
      onMouseLeave={e => { e.currentTarget.style.color = baseColor }}
    >
      {children}
    </button>
  )
}

export function TabChip({ tab, active, onSelect, onClose, onDragOver, onDragStartCapture, dragBefore }: {
  tab: TabState
  active: boolean
  onSelect: () => void
  onClose: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragStartCapture?: () => void
  dragBefore?: boolean
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
        onDragStartCapture?.()
        e.dataTransfer.setData('application/x-proof-tab-id', tab.id)
        e.dataTransfer.setData('application/x-proof-web-url', JSON.stringify({ url: tab.url, title: tab.title || tab.url }))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragOver={onDragOver}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        height: '29px', maxWidth: '160px', minWidth: '70px',
        padding: '0 8px 0 11px', borderRadius: '4px', flexShrink: 1,
        background: active ? '#111211' : hov ? '#111211' : 'transparent',
        borderTop: active ? '1px solid #252725' : '1px solid transparent',
        borderRight: active ? '1px solid #252725' : '1px solid transparent',
        borderBottom: active ? '1px solid #252725' : '1px solid transparent',
        borderLeft: dragBefore ? '2px solid #8C887F' : active ? '1px solid #252725' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      {tab.loading && (
        <span style={{ fontSize: '8px', color: '#8C887F', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>●</span>
      )}
      <span style={{
        fontSize: '11px', color: active ? '#E6E2D8' : hov ? '#E6E2D8' : '#8C887F',
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
          color: active ? '#8C887F' : '#8C887F', cursor: 'pointer',
          padding: 0, outline: 'none', lineHeight: 0,
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#8C887F' }}
        onMouseLeave={e => { e.currentTarget.style.color = active ? '#8C887F' : '#8C887F' }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M1 1L8 8M8 1L1 8" />
        </svg>
      </button>
    </div>
  )
}

export default function WebTabBar({ tabs, activeTabId, panelId, isFocused, onFocusToggle, onReorderTabs }: {
  tabs: TabState[]
  activeTabId: string
  panelId: string
  isFocused?: boolean
  onFocusToggle?: () => void
  onReorderTabs?: (fromId: string, toId: string) => void
}) {
  const [dropVisualId, setDropVisualId] = useState<string | null>(null)
  const dragTabIdRef   = useRef<string | null>(null)
  const dropTargetIdRef = useRef<string | null>(null)

  return (
    <div style={{
      height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center',
      background: '#070807', borderBottom: '1px solid #252725',
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
        <div style={{ width: '1px', height: '14px', background: '#252725', flexShrink: 0 }} />
      )}

      {/* Scrollable tab strip + new tab button directly after last tab */}
      <div
        className="tab-strip"
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'hidden', gap: '3px', padding: '0 8px',
          scrollbarWidth: 'none',
        }}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('application/x-proof-tab-id') ||
              e.dataTransfer.types.includes('application/x-proof-web-url')) e.preventDefault()
        }}
        onDragLeave={e => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            dropTargetIdRef.current = null; setDropVisualId(null)
          }
        }}
        onDrop={e => {
          const fromId = dragTabIdRef.current
          const toId   = dropTargetIdRef.current
          const isTabReorder = e.dataTransfer.types.includes('application/x-proof-tab-id')
          if (isTabReorder) {
            const tabId = e.dataTransfer.getData('application/x-proof-tab-id')
            if (tabId && toId && tabId !== toId && onReorderTabs) onReorderTabs(tabId, toId)
          } else {
            const raw = e.dataTransfer.getData('application/x-proof-web-url')
            if (!raw) return
            try { const { url } = JSON.parse(raw); window.electronAPI?.research?.newTab(panelId, url) } catch {}
          }
          dragTabIdRef.current = null; dropTargetIdRef.current = null; setDropVisualId(null)
        }}
      >
        {tabs.map((tab, i) => (
          <TabChip
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            dragBefore={dropVisualId === tab.id && dragTabIdRef.current !== tab.id}
            onSelect={() => window.electronAPI?.research?.switchTab(panelId, tab.id)}
            onClose={() => window.electronAPI?.research?.closeTab(panelId, tab.id)}
            onDragStartCapture={() => { dragTabIdRef.current = tab.id }}
            onDragOver={e => {
              if (!e.dataTransfer.types.includes('application/x-proof-tab-id')) return
              e.preventDefault(); e.stopPropagation()
              if (dropTargetIdRef.current !== tab.id) {
                dropTargetIdRef.current = tab.id; setDropVisualId(tab.id)
              }
            }}
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
            color: '#8C887F', cursor: 'pointer', padding: 0, outline: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#8C887F' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8C887F' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
