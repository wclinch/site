'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { resolveCommandToUrl, getShortcutHint, SHORTCUTS, SHORTCUT_LABELS } from '@/lib/url'

type TabState = {
  id: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

declare global {
  interface Window {
    electronAPI?: {
      research: {
        navigate:         (pid: string, url: string) => void
        setBounds:        (pid: string, rect: { x: number; y: number; width: number; height: number; innerWidth: number; innerHeight: number }) => void
        goBack:           (pid: string) => void
        goForward:        (pid: string) => void
        reload:           (pid: string) => void
        newTab:           (pid: string, url?: string) => void
        closeTab:         (pid: string, id: string) => void
        switchTab:        (pid: string, id: string) => void
        getState:         (pid: string) => Promise<{ url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean }>
        getTabs:          (pid: string) => Promise<{ tabs: TabState[]; activeTabId: string }>
        onUrlChanged:     (pid: string, cb: (url: string, back: boolean, fwd: boolean) => void) => () => void
        onTitleChanged:   (pid: string, cb: (title: string) => void) => () => void
        onLoadingChanged: (pid: string, cb: (loading: boolean) => void) => () => void
        onCanNavigate:    (pid: string, cb: (back: boolean, fwd: boolean) => void) => () => void
        onTabUpdated:     (pid: string, cb: (id: string, state: Partial<TabState>) => void) => () => void
        onTabsChanged:    (pid: string, cb: (tabs: TabState[], activeTabId: string) => void) => () => void
        onBoundsRecalc:   (cb: () => void) => () => void
        loadWorkspace:    (tabs: Array<{ url: string; title: string; active?: boolean }>) => void
      }
    }
  }
}

const MAX_TABS = 20

function readSavedHome(key: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = localStorage.getItem(key)
    return v === null ? true : v === 'true'
  } catch { return true }
}

function makePlaceholderTab(): TabState {
  return { id: 'tab-init', url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
}

export default function ResearchBrowser({ isFocused = false, onFocusToggle }: {
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  const panelId = 'A'
  const { addUrl, sources, pinUrlToView } = useApp()

  const homeKey = 'proof-v3-browser-home'
  const tabsKey = 'proof-v3-research-tabs'

  const [isElectron, setIsElectron]   = useState(false)
  const [tabs, setTabs]               = useState<TabState[]>([makePlaceholderTab()])
  const [activeTabId, setActiveTabId] = useState<string>('tab-init')
  const [urlInput, setUrlInput]       = useState('')
  const [urlFocused, setUrlFocused]   = useState(false)
  const [saveStatus, setSaveStatus]   = useState<null | 'saved' | 'duplicate'>(null)
  const [homeMode, setHomeMode]       = useState(() => readSavedHome(homeKey))

  const viewportRef    = useRef<HTMLDivElement>(null)
  const urlInputRef    = useRef<HTMLInputElement>(null)
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef    = useRef(readSavedHome(homeKey))
  const activeTabIdRef = useRef<string>('tab-init')
  const tabsRef        = useRef<TabState[]>([makePlaceholderTab()])

  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { setIsElectron(!!window.electronAPI) }, [])

  // Persist homeMode + focus URL bar on new/blank tab
  useEffect(() => {
    homeModeRef.current = homeMode
    try { localStorage.setItem(homeKey, String(homeMode)) } catch {}
    if (homeMode) {
      window.electronAPI?.research?.setBounds(panelId, {
        x: 0, y: 0, width: 0, height: 0,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
      requestAnimationFrame(() => urlInputRef.current?.focus())
    } else {
      window.dispatchEvent(new Event('resize'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeMode])

  // Bootstrap: load tabs from main
  useEffect(() => {
    const api = window.electronAPI?.research
    if (!api) return

    api.getTabs(panelId).then(({ tabs: initialTabs, activeTabId: aid }) => {
      if (initialTabs.length > 0) {
        setTabs(initialTabs)
        setActiveTabId(aid)
        activeTabIdRef.current = aid
        const active = initialTabs.find(t => t.id === aid)
        if (active?.url) setUrlInput(active.url)
        if (!active?.url) {
          try {
            const saved = JSON.parse(localStorage.getItem(tabsKey) || '[]') as Array<{ id: string; url: string }>
            const match = saved.find(t => t.id === aid) || saved[0]
            if (match?.url) { setUrlInput(match.url); navigateUrl(match.url) }
          } catch {}
        }
      }
    }).catch(() => {
      api.getState(panelId).then(s => {
        if (s.url) setUrlInput(s.url)
      }).catch(() => {})
    })

    const unUrl = api.onUrlChanged(panelId, (url, back, fwd) => {
      setTabs(ts => ts.map(t => t.id === activeTabIdRef.current
        ? { ...t, url, canGoBack: back, canGoForward: fwd } : t))
      // Never treat about:blank or empty as real navigation — doing so would
      // set homeMode=false and cause a white flash for blank/clearing tabs.
      if (!url || url === 'about:blank') return
      setUrlInput(url)
      setHomeMode(false)
      try {
        const saved = JSON.parse(localStorage.getItem(tabsKey) || '[]') as Array<{ id: string; url: string }>
        const idx = saved.findIndex(t => t.id === activeTabIdRef.current)
        if (idx >= 0) saved[idx].url = url; else saved.push({ id: activeTabIdRef.current, url })
        localStorage.setItem(tabsKey, JSON.stringify(saved))
      } catch {}
    })

    const unTitle = api.onTitleChanged(panelId, title => {
      setTabs(ts => ts.map(t => t.id === activeTabIdRef.current ? { ...t, title } : t))
    })

    const unLoading = api.onLoadingChanged(panelId, loading => {
      setTabs(ts => ts.map(t => t.id === activeTabIdRef.current ? { ...t, loading } : t))
    })

    const unNav = api.onCanNavigate(panelId, (back, fwd) => {
      setTabs(ts => ts.map(t => t.id === activeTabIdRef.current
        ? { ...t, canGoBack: back, canGoForward: fwd } : t))
    })

    const unTabUpdated = api.onTabUpdated(panelId, (id, state) => {
      setTabs(ts => ts.map(t => {
        if (t.id !== id) return t
        return { ...t, ...state, title: state.title || t.title }
      }))
    })

    const unTabsChanged = api.onTabsChanged(panelId, (newTabs, newActiveId) => {
      setTabs(prevTabs => newTabs.map(nt => {
        const prev = prevTabs.find(t => t.id === nt.id)
        return (prev?.title && !nt.title) ? { ...nt, title: prev.title } : nt
      }))
      setActiveTabId(newActiveId ?? '')
      activeTabIdRef.current = newActiveId ?? ''
      if (newTabs.length === 0) {
        setUrlInput('')
        setHomeMode(true)
        try { localStorage.removeItem(tabsKey) } catch {}
      } else {
        const active = newTabs.find(t => t.id === newActiveId)
        if (active?.url) setUrlInput(active.url)
        else setUrlInput('')
        // Show home screen whenever the active tab has no URL (new tab, blank workspace, etc).
        setHomeMode(!active?.url)
        // Sync localStorage from authoritative main-process state — includes
        // title and active flag so workspace restore knows which tab to activate.
        try {
          const toSave = newTabs.filter(t => t.url).map(t => ({
            id: t.id, url: t.url, title: t.title || '', active: t.id === newActiveId,
          }))
          if (toSave.length > 0) localStorage.setItem(tabsKey, JSON.stringify(toSave))
          else localStorage.removeItem(tabsKey)
        } catch {}
      }
    })

    return () => {
      unUrl(); unTitle(); unLoading(); unNav()
      unTabUpdated(); unTabsChanged()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId])

  // External navigation events (proof:browser-navigate)
  useEffect(() => {
    function onNav(e: Event) {
      const url = (e as CustomEvent<string>).detail
      if (typeof url !== 'string' || !url) return
      const api = window.electronAPI?.research
      if (!api) return
      if (tabsRef.current.length < MAX_TABS) api.newTab(panelId, url)
      else navigateUrl(url)
    }
    window.addEventListener('proof:browser-navigate', onNav as EventListener)
    return () => window.removeEventListener('proof:browser-navigate', onNav as EventListener)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId])

  // Bounds recalc on fullscreen / minimize restore
  useEffect(() => {
    const unsub = window.electronAPI?.research?.onBoundsRecalc?.(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      }))
    })
    return () => unsub?.()
  }, [])

  // Viewport bounds — ResizeObserver + window resize
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let lastKey = ''

    function sendBounds() {
      const iW = window.innerWidth; const iH = window.innerHeight
      if (homeModeRef.current) {
        if (lastKey !== 'zero') {
          lastKey = 'zero'
          window.electronAPI?.research?.setBounds(panelId, { x:0, y:0, width:0, height:0, innerWidth:iW, innerHeight:iH })
        }
        return
      }
      const r = viewportRef.current?.getBoundingClientRect()
      if (!r) return
      const x = Math.round(r.left) + 1
      const y = Math.round(r.top)
      const w = Math.max(0, Math.round(r.width)  - 2)
      const h = Math.max(0, Math.round(r.height) - 1)
      if (w <= 0 || h <= 0) {
        if (lastKey !== 'zero') {
          lastKey = 'zero'
          window.electronAPI?.research?.setBounds(panelId, { x:0, y:0, width:0, height:0, innerWidth:iW, innerHeight:iH })
        }
        return
      }
      const key = `${x},${y},${w},${h},${iW},${iH}`
      if (key === lastKey) return
      lastKey = key
      window.electronAPI?.research?.setBounds(panelId, { x, y, width: w, height: h, innerWidth: iW, innerHeight: iH })
    }

    const observer = new ResizeObserver(sendBounds)
    observer.observe(el)
    window.addEventListener('resize', sendBounds)
    const intervalId = setInterval(sendBounds, 50)
    const timeoutId  = setTimeout(() => clearInterval(intervalId), 400)

    return () => {
      clearInterval(intervalId); clearTimeout(timeoutId)
      observer.disconnect()
      window.removeEventListener('resize', sendBounds)
      window.electronAPI?.research?.setBounds(panelId, {
        x:0, y:0, width:0, height:0, innerWidth:window.innerWidth, innerHeight:window.innerHeight,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId])

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }, [])

  // Recalculate WebContentsView bounds when focus mode changes
  useEffect(() => {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [isFocused])

  function navigateUrl(url: string) {
    if (!url) return
    setUrlInput(url)
    setHomeMode(false)
    homeModeRef.current = false
    window.electronAPI?.research?.navigate(panelId, url)
  }

  function navigate(raw: string) {
    const url = resolveCommandToUrl(raw)
    if (!url) return
    const id = activeTabIdRef.current
    let label: string
    try {
      const u = new URL(url)
      if (u.hostname === 'www.google.com' && u.pathname === '/search') {
        label = u.searchParams.get('q') ?? u.hostname.replace(/^www\./, '')
      } else {
        label = u.hostname.replace(/^www\./, '')
      }
    } catch { label = raw.trim().slice(0, 60) }
    setTabs(ts => ts.map(t => t.id === id ? { ...t, url, title: label, loading: true } : t))
    navigateUrl(url)
  }

  function flash(status: NonNullable<typeof saveStatus>) {
    setSaveStatus(status)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2000)
  }

  function savePage() {
    const active = tabs.find(t => t.id === activeTabId)
    if (!active?.url) return
    const duplicate = sources.some(s => s.url === active.url || s.raw === active.url)
    if (duplicate) { flash('duplicate'); return }
    const label = active.title.trim()
      || (() => { try { return new URL(active.url).hostname.replace(/^www\./, '') } catch { return active.url } })()
    addUrl(active.url, undefined, label)
    flash('saved')
  }

  const active = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        border: '1px solid #1e1e1e', borderRadius: '4px', overflow: 'hidden',
      }}>

        {/* Tab bar */}
        <div style={{
          height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center',
          background: '#050505', borderBottom: '1px solid #1a1a1a',
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
            {/* New tab — sits right after the last tab */}
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

          {/* Focus toggle — far right of tab bar */}
          {onFocusToggle && (
            <TabBarBtn
              key={String(isFocused)}
              onClick={onFocusToggle}
              title={isFocused ? 'Exit focus' : 'Focus Web'}
            >
              {isFocused ? <FocusCollapseIcon /> : <FocusExpandIcon />}
            </TabBarBtn>
          )}
        </div>

        {/* URL / nav toolbar */}
        <div style={{
          height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: '3px', padding: '0 8px', borderBottom: '1px solid #1a1a1a', background: '#060606',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}>
          <NavBtn disabled={!active?.canGoBack}    onClick={() => window.electronAPI?.research?.goBack(panelId)}    title="Back">‹</NavBtn>
          <NavBtn disabled={!active?.canGoForward} onClick={() => window.electronAPI?.research?.goForward(panelId)} title="Forward">›</NavBtn>
          <NavBtn onClick={() => window.electronAPI?.research?.reload(panelId)} title={active?.loading ? 'Stop' : 'Reload'}>
            {active?.loading ? '×' : '↺'}
          </NavBtn>
          <NavBtn onClick={() => setHomeMode(true)} title="Home">⌂</NavBtn>
          <input
            ref={urlInputRef}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onFocus={e => { e.currentTarget.select(); setUrlFocused(true) }}
            onBlur={() => setUrlFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); navigate(urlInput) } }}
            placeholder="Search or enter URL"
            style={{
              flex: 1, height: '22px', background: '#111', border: '1px solid #222',
              borderRadius: '3px', color: '#bbb', fontSize: '11px', padding: '0 8px',
              outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
            }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = '#444' }}
            onBlurCapture={e  => { e.currentTarget.style.borderColor = '#222' }}
          />
          {active?.url && (
            <>
              <ViewPinBtn label="1" title="Open in View 1" onClick={() => pinUrlToView(1, active.url, active.title || active.url)} />
              <ViewPinBtn label="2" title="Open in View 2" onClick={() => pinUrlToView(2, active.url, active.title || active.url)} />
              <button
                onClick={savePage}
                title="Save to Pages"
                style={{
                  height: '22px', flexShrink: 0, display: 'flex', alignItems: 'center',
                  background: 'none', border: '1px solid #252525', borderRadius: '3px',
                  color: '#555', fontSize: '11px', padding: '0 7px', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
                  minWidth: '78px', justifyContent: 'center',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#999' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.color = '#555' }}
              >
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'duplicate' ? 'Already saved' : 'Save'}
              </button>
            </>
          )}
        </div>

        {/* Shortcut hint — only in homeMode to avoid shifting the native view */}
        {homeMode && urlFocused && getShortcutHint(urlInput) && (
          <div style={{
            height: '22px', flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            background: '#060606', borderBottom: '1px solid #0f0f0f',
            fontSize: '10px', color: '#2e2e2e', letterSpacing: '0.03em',
            userSelect: 'none',
          }}>
            {getShortcutHint(urlInput)}
          </div>
        )}

        {/* Native browser viewport */}
        <div
          ref={viewportRef}
          style={{ flex: 1, minHeight: 0, background: '#060606', position: 'relative', overflow: 'hidden', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {homeMode && <HomeScreen onNavigate={navigate} />}
          {!isElectron && !homeMode && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#2a2a2a', fontSize: '11px',
              letterSpacing: '0.08em', userSelect: 'none',
            }}>Desktop app required</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab bar button ───────────────────────────────────────────────────────────

function TabBarBtn({ children, onClick, title, active, borderLeft = true }: {
  children: React.ReactNode
  onClick?: () => void
  title: string
  active?: boolean
  borderLeft?: boolean
}) {
  const baseColor = active ? '#666' : '#3a3a3a'
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

// ─── Tab chip ─────────────────────────────────────────────────────────────────

function TabChip({ tab, active, onSelect, onClose }: {
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
        fontSize: '10px', color: active ? '#aaa' : '#555',
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
          color: '#3a3a3a', fontSize: '13px', cursor: 'pointer',
          padding: 0, outline: 'none', fontFamily: 'inherit', lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#777' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
      >×</button>
    </div>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({ children, onClick, disabled, title }: {
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
        color: disabled ? '#2a2a2a' : '#555',
        fontSize: '16px', fontFamily: 'inherit', padding: 0, outline: 'none',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#999' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#555' }}
    >{children}</button>
  )
}

// ─── Focus icons ─────────────────────────────────────────────────────────────

function FocusExpandIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3.5V1H3.5M5.5 1H8V3.5M8 5.5V8H5.5M3.5 8H1V5.5" />
    </svg>
  )
}

function FocusCollapseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 1V3.5H1M8 3.5H5.5V1M5.5 8V5.5H8M1 5.5H3.5V8" />
    </svg>
  )
}

// ─── View pin button ─────────────────────────────────────────────────────────

function ViewPinBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: '22px', flexShrink: 0, display: 'flex', alignItems: 'center',
        background: 'none',
        border: `1px solid ${hover ? '#333' : '#252525'}`,
        borderRadius: '3px',
        color: hover ? '#999' : '#555',
        fontSize: '11px', padding: '0 7px', cursor: 'pointer',
        fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────

const HOME_SHORTCUTS = Object.entries(SHORTCUT_LABELS).filter(([key]) => key !== 'google docs')

function HomeScreen({ onNavigate }: { onNavigate: (input: string) => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060606',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '200px' }}>

        <div style={{ paddingBottom: '10px', borderBottom: '1px solid #111' }}>
          <span style={{ fontSize: '10px', color: '#333', letterSpacing: '0.08em', textTransform: 'uppercase', userSelect: 'none' }}>
            Quick open
          </span>
        </div>

        {HOME_SHORTCUTS.map(([key, label]) => (
          <ShortcutRow key={key} keyword={key} label={label} onClick={() => onNavigate(key)} />
        ))}

        <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #111', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '10px', color: '#2e2e2e', fontFamily: 'monospace', letterSpacing: '0.02em', flexShrink: 0 }}>domain.com</span>
            <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.02em' }}>opens directly</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '10px', color: '#2e2e2e', fontFamily: 'monospace', letterSpacing: '0.02em', flexShrink: 0 }}>? query</span>
            <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.02em' }}>forces Google search</span>
          </div>
        </div>

      </div>
    </div>
  )
}

function ShortcutRow({ keyword, label, onClick }: { keyword: string; label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '12px', padding: '5px 0',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', outline: 'none', width: '100%',
        borderRadius: '2px',
      }}
    >
      <span style={{ fontSize: '11px', color: hov ? '#888' : '#555', letterSpacing: '0.02em', transition: 'color 0.1s' }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', color: hov ? '#444' : '#282828', letterSpacing: '0.04em', fontFamily: 'monospace', transition: 'color 0.1s' }}>
        {keyword}
      </span>
    </button>
  )
}
