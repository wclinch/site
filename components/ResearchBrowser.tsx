'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { resolveCommandToUrl } from '@/lib/url'

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

export default function ResearchBrowser() {
  const panelId = 'A'
  const { addUrl, sources } = useApp()

  const homeKey = 'proof-v3-browser-home'
  const tabsKey = 'proof-v3-research-tabs'

  const [isElectron, setIsElectron]   = useState(false)
  const [tabs, setTabs]               = useState<TabState[]>([makePlaceholderTab()])
  const [activeTabId, setActiveTabId] = useState<string>('tab-init')
  const [urlInput, setUrlInput]       = useState('')
  const [saveStatus, setSaveStatus]   = useState<null | 'saved' | 'duplicate'>(null)
  const [homeMode, setHomeMode]       = useState(() => readSavedHome(homeKey))

  const viewportRef    = useRef<HTMLDivElement>(null)
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef    = useRef(readSavedHome(homeKey))
  const activeTabIdRef = useRef<string>('tab-init')
  const tabsRef        = useRef<TabState[]>([makePlaceholderTab()])

  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { setIsElectron(!!window.electronAPI) }, [])

  // Persist homeMode
  useEffect(() => {
    homeModeRef.current = homeMode
    try { localStorage.setItem(homeKey, String(homeMode)) } catch {}
    if (homeMode) {
      window.electronAPI?.research?.setBounds(panelId, {
        x: 0, y: 0, width: 0, height: 0,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
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
      setUrlInput(url)
      setHomeMode(false)
      try {
        if (url) {
          const saved = JSON.parse(localStorage.getItem(tabsKey) || '[]') as Array<{ id: string; url: string }>
          const idx = saved.findIndex(t => t.id === activeTabIdRef.current)
          if (idx >= 0) saved[idx].url = url; else saved.push({ id: activeTabIdRef.current, url })
          localStorage.setItem(tabsKey, JSON.stringify(saved))
        }
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
        // If no tab has a URL yet (fresh workspace), show home screen.
        if (newTabs.every(t => !t.url)) setHomeMode(true)
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
        }}>
          <div
            className="tab-strip"
            style={{
              flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
              overflowX: 'auto', overflowY: 'hidden', gap: '1px', padding: '0 4px',
              scrollbarWidth: 'none',
            }}
          >
            {tabs.length === 0 && (
              <span style={{ fontSize: '10px', color: '#2a2a2a', letterSpacing: '0.04em', padding: '0 4px', flexShrink: 0 }}>No tabs</span>
            )}
            {tabs.map(tab => (
              <TabChip
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onSelect={() => window.electronAPI?.research?.switchTab(panelId, tab.id)}
                onClose={() => window.electronAPI?.research?.closeTab(panelId, tab.id)}
              />
            ))}
          </div>

          {/* New tab */}
          <TabBarBtn
            onClick={() => window.electronAPI?.research?.newTab(panelId)}
            title="New tab"
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
          </TabBarBtn>
        </div>

        {/* URL / nav toolbar */}
        <div style={{
          height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: '3px', padding: '0 8px', borderBottom: '1px solid #1a1a1a', background: '#060606',
        }}>
          <NavBtn disabled={!active?.canGoBack}    onClick={() => window.electronAPI?.research?.goBack(panelId)}    title="Back">‹</NavBtn>
          <NavBtn disabled={!active?.canGoForward} onClick={() => window.electronAPI?.research?.goForward(panelId)} title="Forward">›</NavBtn>
          <NavBtn onClick={() => window.electronAPI?.research?.reload(panelId)} title={active?.loading ? 'Stop' : 'Reload'}>
            {active?.loading ? '×' : '↺'}
          </NavBtn>
          <NavBtn onClick={() => setHomeMode(true)} title="Home">⌂</NavBtn>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onFocus={e => e.currentTarget.select()}
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
            <button
              onClick={savePage}
              title="Save page to Sites"
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
          )}
        </div>

        {/* Native browser viewport */}
        <div
          ref={viewportRef}
          style={{ flex: 1, minHeight: 0, background: '#060606', position: 'relative', overflow: 'hidden' }}
        >
          {homeMode && <HomeScreen />}
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

function TabBarBtn({ children, onClick, title, active }: {
  children: React.ReactNode
  onClick?: () => void
  title: string
  active?: boolean
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
        borderLeft: '1px solid #111',
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

// ─── Home screen ──────────────────────────────────────────────────────────────

function HomeScreen() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060606',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
        <span style={{ fontSize: '12px', color: '#555', fontWeight: 500, letterSpacing: '0.03em' }}>Start researching</span>
        <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.02em' }}>Search the web or enter a URL.</span>
      </div>
    </div>
  )
}
