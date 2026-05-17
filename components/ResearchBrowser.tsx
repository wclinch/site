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

type TabStatus = { failedLoad?: boolean; authBlocked?: boolean }

function isAuthUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    const p = u.pathname.toLowerCase()
    return h === 'accounts.google.com' ||
      p.includes('/oauth') || p.includes('/login') || p.includes('/signin') ||
      p.includes('/auth/') || p.includes('/callback') || p.includes('/sso/')
  } catch { return false }
}

const AUTH_BLOCKED_TITLE_PATTERNS = [
  "couldn't sign you in",
  "this browser or app may not be secure",
  "access blocked",
  "authentication failed",
  "sign in blocked",
]
function isAuthBlockedTitle(title: string): boolean {
  const t = title.toLowerCase()
  return AUTH_BLOCKED_TITLE_PATTERNS.some(p => t.includes(p))
}

declare global {
  interface Window {
    electronAPI?: {
      openExternal?: (url: string) => Promise<void>
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
        onFailLoad?:      (pid: string, cb: (id: string, code: number) => void) => () => void
        loadWorkspace:    (tabs: Array<{ url: string; title: string; active?: boolean; zoom?: number }>) => void
      }
    }
  }
}

const MAX_TABS = 20


function makePlaceholderTab(): TabState {
  return { id: 'tab-init', url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
}

export default function ResearchBrowser({ isFocused = false, onFocusToggle }: {
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  const panelId = 'A'
  const { addUrl, sources, pinUrlToView } = useApp()

  const tabsKey = 'proof-v3-research-tabs'

  const [isElectron, setIsElectron]   = useState(false)
  const [tabs, setTabs]               = useState<TabState[]>([makePlaceholderTab()])
  const [activeTabId, setActiveTabId] = useState<string>('tab-init')
  const [urlInput, setUrlInput]       = useState('')
  const [urlFocused, setUrlFocused]   = useState(false)
  const [saveStatus, setSaveStatus]   = useState<null | 'saved' | 'duplicate'>(null)
  const [homeMode, setHomeMode]       = useState(true)

  const viewportRef    = useRef<HTMLDivElement>(null)
  const urlInputRef    = useRef<HTMLInputElement>(null)
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef    = useRef(true)
  const activeTabIdRef = useRef<string>('tab-init')
  const tabsRef        = useRef<TabState[]>([makePlaceholderTab()])

  const [tabStatuses, setTabStatuses]   = useState<Record<string, TabStatus>>({})
  const [showFallback, setShowFallback] = useState(false)
  const showFallbackRef  = useRef(false)
  const stallTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTabIdRef    = useRef<string>('')
  const stallProgressRef = useRef(false) // true if URL or title changed since stall timer started

  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { setIsElectron(!!window.electronAPI) }, [])

  useEffect(() => {
    const st = tabStatuses[activeTabId]
    const should = !homeMode && !!(st?.authBlocked || st?.failedLoad)
    if (should !== showFallbackRef.current) {
      showFallbackRef.current = should
      setShowFallback(should)
      window.dispatchEvent(new Event('resize'))
    }
  }, [tabStatuses, activeTabId, homeMode])

  // Sync ref + hide native view / focus URL bar when in home mode
  useEffect(() => {
    homeModeRef.current = homeMode
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
      const id = activeTabIdRef.current
      setTabs(ts => ts.map(t => t.id === id ? { ...t, url, canGoBack: back, canGoForward: fwd } : t))
      if (!url || url === 'about:blank') return
      setUrlInput(url)
      setHomeMode(false)
      // Mark navigation progress (resets stall detection for pending timer)
      stallProgressRef.current = true
      // Clear any fallback status from the previous page (auto-dismisses fallback on redirect)
      setTabStatuses(prev => ({ ...prev, [id]: {} }))
      // Stall detection: if an auth page starts loading but shows zero progress
      // (no URL change or title) after 20s, show the fallback.
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      stallTabIdRef.current = id
      stallProgressRef.current = false // arm: next url/title change marks progress
      if (isAuthUrl(url)) {
        stallTimerRef.current = setTimeout(() => {
          stallTimerRef.current = null
          const currentId = stallTabIdRef.current
          // Fire if no URL change was seen since this timer started — catches both
          // "still loading" stalls and "loaded but blank" OAuth popup pages.
          if (!stallProgressRef.current) {
            setTabStatuses(prev => ({ ...prev, [currentId]: { ...prev[currentId], authBlocked: true } }))
          }
        }, 20000)
      }
      try {
        const saved = JSON.parse(localStorage.getItem(tabsKey) || '[]') as Array<{ id: string; url: string }>
        const idx = saved.findIndex(t => t.id === id)
        if (idx >= 0) saved[idx].url = url; else saved.push({ id, url })
        localStorage.setItem(tabsKey, JSON.stringify(saved))
      } catch {}
    })

    const unTitle = api.onTitleChanged(panelId, title => {
      const id = activeTabIdRef.current
      setTabs(ts => ts.map(t => t.id === id ? { ...t, title } : t))
      if (isAuthBlockedTitle(title)) {
        setTabStatuses(prev => ({ ...prev, [id]: { ...prev[id], authBlocked: true } }))
      }
    })

    const unLoading = api.onLoadingChanged(panelId, loading => {
      setTabs(ts => ts.map(t => t.id === activeTabIdRef.current ? { ...t, loading } : t))
      if (!loading && stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
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
      if (state.title && isAuthBlockedTitle(state.title)) {
        setTabStatuses(prev => ({ ...prev, [id]: { ...prev[id], authBlocked: true } }))
      }
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

    const unFailLoad = api.onFailLoad?.(panelId, (id, _code) => {
      setTabStatuses(prev => ({ ...prev, [id]: { ...prev[id], failedLoad: true } }))
    }) ?? (() => {})

    return () => {
      unUrl(); unTitle(); unLoading(); unNav()
      unTabUpdated(); unTabsChanged(); unFailLoad()
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
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
      if (homeModeRef.current || showFallbackRef.current) {
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

  function openExternal(url: string) {
    window.electronAPI?.openExternal?.(url)
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
                  minWidth: '54px', justifyContent: 'center',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#999' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.color = '#555' }}
              >
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'duplicate' ? 'Saved' : 'Save'}
              </button>
            </>
          )}
        </div>

        {/* Quick open strip — horizontal chips, only in home mode */}
        {homeMode && (
          <div style={{
            height: '36px', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '0 8px',
            background: '#060606', borderBottom: '1px solid #1a1a1a',
            overflowX: 'auto', overflowY: 'hidden',
            scrollbarWidth: 'none',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}>
            {HOME_SHORTCUTS.map(([key, label]) => (
              <ShortcutChip key={key} label={label} onClick={() => navigate(key)} />
            ))}
          </div>
        )}

        {/* Shortcut hint — only when typing a known shortcut */}
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
          {/* Auth / load fallback — overlays native view when login is blocked or page fails */}
          {showFallback && (() => {
            const st = tabStatuses[activeTabId]
            const url = active?.url ?? ''
            const isBlocked = st?.authBlocked && !st?.failedLoad
            return (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: '#060606',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '32px', userSelect: 'none',
              }}>
                <p style={{ fontSize: '13px', color: '#bbb', margin: 0, fontWeight: 500, textAlign: 'center' }}>
                  {isBlocked ? 'This sign-in may need your browser.' : "Couldn't load this page."}
                </p>
                <p style={{ fontSize: '11px', color: '#555', margin: '4px 0 12px', lineHeight: 1.65, textAlign: 'center', maxWidth: '300px' }}>
                  {isBlocked
                    ? 'Some websites block embedded sign-in.'
                    : 'The page failed to load. Check your connection or try again.'}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <FallbackBtn onClick={() => openExternal(url)}>Open in browser</FallbackBtn>
                  <FallbackBtn onClick={() => {
                    setTabStatuses(prev => ({ ...prev, [activeTabId]: {} }))
                    window.electronAPI?.research?.reload(panelId)
                  }}>Retry</FallbackBtn>
                  <FallbackBtn onClick={() => { try { navigator.clipboard.writeText(url) } catch {} }}>Copy link</FallbackBtn>
                  <FallbackBtn onClick={() => setTabStatuses(prev => ({ ...prev, [activeTabId]: {} }))}>Dismiss</FallbackBtn>
                </div>
              </div>
            )
          })()}
          {homeMode && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: '6px',
              userSelect: 'none', pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#222', fontFamily: 'monospace', letterSpacing: '0.02em' }}>domain.com</span>
                <span style={{ fontSize: '10px', color: '#1a1a1a', letterSpacing: '0.02em' }}>opens directly</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#222', fontFamily: 'monospace', letterSpacing: '0.02em' }}>? query</span>
                <span style={{ fontSize: '10px', color: '#1a1a1a', letterSpacing: '0.02em' }}>forces Google search</span>
              </div>
            </div>
          )}
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

// ─── Quick open ───────────────────────────────────────────────────────────────

const HOME_SHORTCUTS = Object.entries(SHORTCUT_LABELS).filter(([key]) => key !== 'google docs')

function ShortcutChip({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '22px', padding: '0 10px', flexShrink: 0,
        background: 'none',
        border: `1px solid ${hov ? '#2e2e2e' : '#1a1a1a'}`,
        borderRadius: '3px',
        color: hov ? '#777' : '#444',
        fontSize: '11px', letterSpacing: '0.02em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        whiteSpace: 'nowrap',
        transition: 'color 0.1s, border-color 0.1s',
      }}
    >{label}</button>
  )
}

// ─── Fallback button ──────────────────────────────────────────────────────────

function FallbackBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '26px', padding: '0 12px', flexShrink: 0,
        background: 'none',
        border: `1px solid ${hov ? '#333' : '#222'}`,
        borderRadius: '3px',
        color: hov ? '#ccc' : '#666',
        fontSize: '11px', letterSpacing: '0.03em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s',
      }}
    >{children}</button>
  )
}
