'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import type { TabState } from './webTypes'

function SearchSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', color: '#555', letterSpacing: '0.08em',
      textTransform: 'uppercase', padding: '8px 10px 3px', userSelect: 'none',
    }}>{children}</div>
  )
}

function SearchResultRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: hov ? '#0d0d0d' : 'none', border: 'none', outline: 'none',
        padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        fontSize: '12px', color: hov ? '#ccc' : '#888',
        letterSpacing: '0.01em', transition: 'color 0.1s',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</div>
      {sub && sub !== label && (
        <div style={{
          fontSize: '10px', color: '#555', letterSpacing: '0.02em', marginTop: '1px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub}</div>
      )}
    </button>
  )
}

export default function WorkspaceSearchPanel({ visible, tabs, panelId, onClose, onNavigate, onSwitchTab }: {
  visible: boolean
  tabs: TabState[]
  panelId: string
  onClose: () => void
  onNavigate: (url: string) => void
  onSwitchTab: (id: string) => void
}) {
  const { sources, view1Page, view2Page, openDocInPane } = useApp()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) requestAnimationFrame(() => inputRef.current?.focus())
    else setQuery('')
  }, [visible])

  const q = query.trim().toLowerCase()

  const isPage = (s: { fileType?: string; url?: string; raw: string }) =>
    s.fileType === 'url' || !!s.url || /^https?:\/\//i.test(s.raw || '')

  const docs  = sources.filter(s => !isPage(s))
  const pages = sources.filter(s =>  isPage(s))

  const matchSrc = (s: { label?: string; url?: string; raw: string }) => {
    const label = (s.label || s.raw || '').toLowerCase()
    const url   = (s.url   || s.raw || '').toLowerCase()
    return label.includes(q) || url.includes(q)
  }

  const liveTabs = tabs.filter(t => t.url)

  const matchedDocs  = (!q ? docs  : docs.filter(matchSrc)).slice(0, 8)
  const matchedPages = (!q ? pages : pages.filter(matchSrc)).slice(0, 8)
  const matchedTabs  = (!q ? liveTabs : liveTabs.filter(t =>
    (t.title || '').toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
  )).slice(0, 6)

  const viewItems: Array<{ pane: 1 | 2; url: string; title: string }> = []
  if (view1Page) viewItems.push({ pane: 1, url: view1Page.url, title: view1Page.title || view1Page.url })
  if (view2Page) viewItems.push({ pane: 2, url: view2Page.url, title: view2Page.title || view2Page.url })
  const matchedViews = (!q ? viewItems : viewItems.filter(v =>
    v.title.toLowerCase().includes(q) || v.url.toLowerCase().includes(q)
  ))

  const hasResults = matchedDocs.length > 0 || matchedPages.length > 0 ||
    matchedTabs.length > 0 || matchedViews.length > 0
  const emptyWorkspace = !q && sources.length === 0 && liveTabs.length === 0 && viewItems.length === 0

  function act(fn: () => void) { fn(); onClose() }

  // panelId is accepted but not used here — kept in props for caller symmetry
  void panelId

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      borderBottom: '1px solid #1e1e1e', background: '#060606',
    }}>
      {/* Input row */}
      <div style={{
        height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 10px', borderBottom: '1px solid #1e1e1e',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5" cy="5" r="3.5" /><line x1="7.5" y1="7.5" x2="11" y2="11" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="Search this session…"
          spellCheck={false}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: '12px', color: '#c2c2c2', fontFamily: 'inherit', letterSpacing: '0.02em',
          }}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', padding: '0 2px',
            color: '#333', cursor: 'pointer', fontSize: '16px',
            lineHeight: 1, outline: 'none', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#777')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        >×</button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>

        {emptyWorkspace && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#555', letterSpacing: '0.04em' }}>
            Nothing in this session yet.
          </div>
        )}

        {!hasResults && q && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#555', letterSpacing: '0.04em' }}>
            No matches.
          </div>
        )}

        {matchedDocs.length > 0 && (
          <>
            <SearchSectionLabel>Documents</SearchSectionLabel>
            {matchedDocs.map(s => (
              <SearchResultRow key={s.id} label={s.label || s.raw}
                onClick={() => act(() => openDocInPane(1, s.id))} />
            ))}
          </>
        )}

        {matchedPages.length > 0 && (
          <>
            <SearchSectionLabel>Pages</SearchSectionLabel>
            {matchedPages.map(s => (
              <SearchResultRow key={s.id} label={s.label || s.raw} sub={s.url || s.raw}
                onClick={() => act(() => onNavigate(s.url || s.raw))} />
            ))}
          </>
        )}

        {matchedTabs.length > 0 && (
          <>
            <SearchSectionLabel>Web Tabs</SearchSectionLabel>
            {matchedTabs.map(t => (
              <SearchResultRow key={t.id} label={t.title || t.url} sub={t.url}
                onClick={() => act(() => onSwitchTab(t.id))} />
            ))}
          </>
        )}

        {matchedViews.length > 0 && (
          <>
            <SearchSectionLabel>Views</SearchSectionLabel>
            {matchedViews.map(v => (
              <SearchResultRow key={v.pane} label={v.title} sub={`View ${v.pane} — ${v.url}`}
                onClick={() => act(() => onNavigate(v.url))} />
            ))}
          </>
        )}

      </div>
    </div>
  )
}
