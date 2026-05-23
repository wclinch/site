'use client'
import React, { useState, useRef } from 'react'
import type { TabState } from './webTypes'
import { notify } from '../NotificationsPanel'

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
  const baseColor = active ? 'rgba(230,226,216,0.65)' : 'rgba(230,226,216,0.65)'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '44px', height: '44px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#151615' : 'none', border: 'none',
        borderLeft: borderLeft ? '1px solid rgba(230,226,216,0.1)' : 'none',
        color: baseColor,
        cursor: 'pointer',
        fontFamily: 'inherit', padding: 0, outline: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#E6E2D8' }}
      onMouseLeave={e => { e.currentTarget.style.color = baseColor }}
    >
      {children}
    </button>
  )
}

export function TabChip({ tab, active, onSelect, onClose, onDragOver, onDragStartCapture, onDragEnd, dragBefore }: {
  tab: TabState
  active: boolean
  onSelect: () => void
  onClose?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragStartCapture?: () => void
  onDragEnd?: (e: React.DragEvent) => void
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
        const ghostLabel = tab.title || (() => { try { return new URL(tab.url).hostname } catch { return tab.url } })()
        const ghost = document.createElement('div')
        ghost.textContent = ghostLabel.slice(0, 40)
        Object.assign(ghost.style, {
          position: 'fixed', top: '-1000px', left: '-1000px',
          background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '4px',
          padding: '5px 12px', fontSize: '12px', color: '#E6E2D8',
          fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        })
        document.body.appendChild(ghost)
        e.dataTransfer.setDragImage(ghost, 14, 14)
        setTimeout(() => ghost.remove(), 0)
        onDragStartCapture?.()
        e.dataTransfer.setData('application/x-proof-tab-id', tab.id)
        e.dataTransfer.setData('application/x-proof-web-url', JSON.stringify({ url: tab.url, title: tab.title || tab.url }))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragOver={onDragOver}
      onDragEnd={e => onDragEnd?.(e)}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        height: '34px', maxWidth: '180px', minWidth: '80px',
        padding: '0 10px 0 13px', borderRadius: '4px', flexShrink: 1,
        background: active ? '#151615' : hov ? '#151615' : 'transparent',
        borderTop: active ? '1px solid rgba(230,226,216,0.1)' : '1px solid transparent',
        borderRight: active ? '1px solid rgba(230,226,216,0.1)' : '1px solid transparent',
        borderBottom: active ? '1px solid rgba(230,226,216,0.1)' : '1px solid transparent',
        borderLeft: dragBefore ? '2px solid rgba(230,226,216,0.65)' : active ? '1px solid rgba(230,226,216,0.1)' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      {tab.loading && (
        <span style={{ fontSize: '8px', color: 'rgba(230,226,216,0.65)', flexShrink: 0, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>●</span>
      )}
      <span style={{
        fontSize: '13px', color: active ? '#E6E2D8' : hov ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        flex: 1, letterSpacing: '0.02em', transition: 'color 0.1s',
      }}>
        {label}
      </span>
      {onClose && <button
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{
          width: '20px', height: '20px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '2px',
          color: 'rgba(230,226,216,0.65)', cursor: 'pointer',
          padding: 0, outline: 'none', lineHeight: 0,
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#E6E2D8' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.65)' }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M1 1L8 8M8 1L1 8" />
        </svg>
      </button>}
    </div>
  )
}

function AskSiteBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={active ? 'Close Ask Site' : 'Open Ask Site'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '44px', padding: '0 14px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '6px',
        background: active ? '#151615' : 'none',
        border: 'none',
        borderLeft: '1px solid rgba(230,226,216,0.1)',
        color: active || hov ? '#E6E2D8' : 'rgba(230,226,216,0.5)',
        fontSize: '12px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.15s, background 0.15s',
      }}
    >
      {active && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8fb87a', flexShrink: 0 }} />
      )}
      Ask Site
    </button>
  )
}

export default function WebTabBar({ tabs, activeTabId, panelId, isFocused, onFocusToggle, onReorderTabs, onTabDragStart, askSiteOpen }: {
  tabs: TabState[]
  activeTabId: string
  panelId: string
  isFocused?: boolean
  onFocusToggle?: () => void
  onReorderTabs?: (fromId: string, toId: string) => void
  onTabDragStart?: () => void
  askSiteOpen?: boolean
}) {
  const [dropVisualId, setDropVisualId] = useState<string | null>(null)
  const dragTabIdRef   = useRef<string | null>(null)
  const dropTargetIdRef = useRef<string | null>(null)

  return (
    <div style={{
      height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
      background: '#070807', borderBottom: '1px solid rgba(230,226,216,0.1)',
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
        <div style={{ width: '1px', height: '14px', background: 'rgba(230,226,216,0.2)', flexShrink: 0 }} />
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
            try { const { url } = JSON.parse(raw); window.electronAPI?.research?.newTab(panelId, url); notify('Opened in Web') } catch {}
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
            onClose={tabs.length > 1 ? () => window.electronAPI?.research?.closeTab(panelId, tab.id) : undefined}
            onDragStartCapture={() => { dragTabIdRef.current = tab.id; onTabDragStart?.() }}
            onDragEnd={e => {
              dragTabIdRef.current = null; setDropVisualId(null)
              window.dispatchEvent(new CustomEvent('proof:drag-done', { detail: { canceled: e.dataTransfer.dropEffect === 'none' } }))
            }}
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
            color: 'rgba(230,226,216,0.65)', cursor: 'pointer', padding: 0, outline: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#E6E2D8' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.65)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        </button>
      </div>

      {/* Ask Site toggle — far right */}
      <AskSiteBtn active={!!askSiteOpen} onClick={() => window.dispatchEvent(new Event('proof:ask-site-toggle'))} />
    </div>
  )
}
