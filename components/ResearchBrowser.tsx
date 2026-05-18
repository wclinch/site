'use client'
import React, { useEffect, useRef, useState } from 'react'
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
  const { addUrl, sources, pinUrlToView, activeId } = useApp()

  const tabsKey = 'proof-v3-research-tabs'

  const [isElectron, setIsElectron]   = useState(false)
  const [tabs, setTabs]               = useState<TabState[]>([makePlaceholderTab()])
  const [activeTabId, setActiveTabId] = useState<string>('tab-init')
  const [urlInput, setUrlInput]       = useState('')
  const [urlFocused, setUrlFocused]   = useState(false)
  const [actionFeedback, setActionFeedback] = useState<null | 'view1' | 'view2' | 'saved' | 'duplicate'>(null)
  const [homeMode, setHomeMode]       = useState(true)
  const [showQuickOpen, setShowQuickOpen] = useState(() => {
    try { return localStorage.getItem('proof-show-quick-open') !== 'false' } catch { return true }
  })
  const [showSearch, setShowSearch] = useState(() => {
    try { return localStorage.getItem('proof-workspace-search') === 'true' } catch { return false }
  })

  const viewportRef    = useRef<HTMLDivElement>(null)
  const urlInputRef    = useRef<HTMLInputElement>(null)
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef    = useRef(true)
  const activeTabIdRef = useRef<string>('tab-init')
  const tabsRef        = useRef<TabState[]>([makePlaceholderTab()])

  const [tabStatuses, setTabStatuses]   = useState<Record<string, TabStatus>>({})
  const [showFallback, setShowFallback] = useState(false)
  const showFallbackRef     = useRef(false)
  const suppressBoundsRef   = useRef(false)
  const stallTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      requestAnimationFrame(() => {
        // Don't steal focus from another active input (workspace rename, modal field, etc.)
        const el = document.activeElement as HTMLElement | null
        if (el && el !== document.body && el !== urlInputRef.current) {
          const tag = el.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return
        }
        urlInputRef.current?.focus()
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
      if (suppressBoundsRef.current) return
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
      // Floor both start and end so the native view never extends past the
      // viewport element's actual edge — prevents the native layer from
      // covering the 1px CSS border on the right/bottom of the panel.
      const x = Math.floor(r.left)
      const y = Math.floor(r.top)
      const w = Math.max(0, Math.floor(r.right)  - x)
      const h = Math.max(0, Math.floor(r.bottom) - y)
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

  useEffect(() => {
    function onSettingsChanged() {
      try { setShowQuickOpen(localStorage.getItem('proof-show-quick-open') !== 'false') } catch {}
    }
    window.addEventListener('proof:settings-changed', onSettingsChanged)
    return () => window.removeEventListener('proof:settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    try { localStorage.setItem('proof-workspace-search', showSearch ? 'true' : 'false') } catch {}
  }, [showSearch])

  useEffect(() => {
    function onToggle() {
      setShowSearch(v => {
        // If the native view is visible, hide it instantly and suppress bounds
        // updates for the duration of the CSS transition so the animation isn't
        // throttled by per-frame IPC calls to Electron.
        if (!homeModeRef.current && !showFallbackRef.current) {
          suppressBoundsRef.current = true
          window.electronAPI?.research?.setBounds(panelId, {
            x: 0, y: 0, width: 0, height: 0,
            innerWidth: window.innerWidth, innerHeight: window.innerHeight,
          })
          setTimeout(() => {
            suppressBoundsRef.current = false
            window.dispatchEvent(new Event('resize'))
          }, 280)
        }
        return !v
      })
    }
    window.addEventListener('proof:workspace-search', onToggle)
    return () => window.removeEventListener('proof:workspace-search', onToggle)
  }, [])

  // Bypass lastKey dedup when focus mode changes — layout reflows after the state update
  // so the guard fires before the new rect is available.
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const el = viewportRef.current
      if (!el) return
      if (homeModeRef.current || showFallbackRef.current) return
      const iW = window.innerWidth, iH = window.innerHeight
      const r = el.getBoundingClientRect()
      const x = Math.floor(r.left)
      const y = Math.floor(r.top)
      const w = Math.max(0, Math.ceil(r.left + r.width) - x)
      const h = Math.max(0, Math.ceil(r.top + r.height) - y)
      if (w > 0 && h > 0)
        window.electronAPI?.research?.setBounds(panelId, { x, y, width: w, height: h, innerWidth: iW, innerHeight: iH })
      if (Date.now() - start > 600) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, panelId])

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

  function flash(status: NonNullable<typeof actionFeedback>) {
    setActionFeedback(status)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setActionFeedback(null), 2000)
  }

  function handlePin(view: 1 | 2) {
    if (!active?.url) return
    pinUrlToView(view, active.url, active.title || active.url)
    flash(view === 1 ? 'view1' : 'view2')
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

        {/* Workspace search panel — top 50%, pushes browser UI to bottom */}
        <div style={{
          flexGrow: showSearch ? 1 : 0,
          flexShrink: 1, flexBasis: 0,
          minHeight: 0, overflow: 'hidden',
          transition: 'flex-grow 0.22s ease',
          display: 'flex', flexDirection: 'column',
        }}>
          <WorkspaceSearch
            visible={showSearch}
            tabs={tabs}
            panelId={panelId}
            onClose={() => setShowSearch(false)}
            onNavigate={navigateUrl}
            onSwitchTab={id => window.electronAPI?.research?.switchTab(panelId, id)}
          />
        </div>

        {/* Tab bar */}
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
              title={isFocused ? 'Exit expanded Web' : 'Expand Web'}
            >
              {isFocused ? <FocusCollapseIcon /> : <FocusExpandIcon />}
            </TabBarBtn>
          )}
        </div>

        {/* URL / nav toolbar */}
        <div style={{
          height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: '3px', padding: '0 8px', borderBottom: '1px solid #1e1e1e', background: '#060606',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}>
          <NavBtn disabled={!active?.canGoBack}    onClick={() => window.electronAPI?.research?.goBack(panelId)}    title="Back">‹</NavBtn>
          <NavBtn disabled={!active?.canGoForward} onClick={() => window.electronAPI?.research?.goForward(panelId)} title="Forward">›</NavBtn>
          <NavBtn onClick={() => {
            if (!active?.loading && homeMode && urlInput) navigateUrl(urlInput)
            else window.electronAPI?.research?.reload(panelId)
          }} title={active?.loading ? 'Stop' : 'Reload'}>
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
              flex: 1, height: '22px', background: '#111', border: '1px solid #252525',
              borderRadius: '3px', color: '#bbb', fontSize: '11px', padding: '0 8px',
              outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
            }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = '#444' }}
            onBlurCapture={e  => { e.currentTarget.style.borderColor = '#252525' }}
          />
          {(() => {
            const hasUrl = !!active?.url
            return (
              <>
                <ViewPinBtn
                  label={actionFeedback === 'view1' ? 'Opened in View' : '1'}
                  title={hasUrl ? 'Open in View' : 'Open a page first'}
                  onClick={() => handlePin(1)}
                  disabled={!hasUrl}
                />
                <ViewPinBtn
                  label={actionFeedback === 'view2' ? 'Opened in View 2' : '2'}
                  title={hasUrl ? 'Open in View 2' : 'Open a page first'}
                  onClick={() => handlePin(2)}
                  disabled={!hasUrl}
                />
                <button
                  onClick={savePage}
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
              </>
            )
          })()}
        </div>

        {/* Quick open strip — horizontal chips, only in home mode and when enabled */}
        {homeMode && showQuickOpen && !showSearch && <QuickOpenStrip urlInput={urlInput} navigate={navigate} workspaceId={activeId ?? ''} />}

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
                    : 'Check your connection or try again.'}
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
              justifyContent: 'center', flexDirection: 'column', gap: '5px',
              userSelect: 'none', pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '12px', color: '#3a3a3a', letterSpacing: '0.03em' }}>
                Browse for this workspace.
              </span>
              <span style={{ fontSize: '11px', color: '#2e2e2e', letterSpacing: '0.025em' }}>
                Use 1, 2, or Save to keep what matters.
              </span>
              <div style={{ height: '10px' }} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#2a2a2a', fontFamily: 'monospace', letterSpacing: '0.02em' }}>domain.com</span>
                <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.02em' }}>opens directly</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#2a2a2a', fontFamily: 'monospace', letterSpacing: '0.02em' }}>? query</span>
                <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.02em' }}>searches Google</span>
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
        color: disabled ? '#333' : '#666',
        fontSize: '16px', fontFamily: 'inherit', padding: 0, outline: 'none',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#aaa' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#666' }}
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

function ViewPinBtn({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
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

// ─── Quick open ───────────────────────────────────────────────────────────────

type ShortcutSection = { label: string; shortcuts: [string, string][] }

const HOME_SECTIONS: ShortcutSection[] = [
  { label: 'AI', shortcuts: [
    ['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['perplexity', 'Perplexity'],
    ['gemini', 'Gemini'], ['grok', 'Grok'], ['mistral', 'Mistral'],
  ]},
  { label: 'Google', shortcuts: [
    ['gmail', 'Gmail'], ['docs', 'Docs'], ['drive', 'Drive'], ['sheets', 'Sheets'],
    ['slides', 'Slides'], ['calendar', 'Calendar'], ['meet', 'Meet'], ['maps', 'Maps'],
  ]},
  { label: 'Search', shortcuts: [
    ['google', 'Google'], ['wikipedia', 'Wikipedia'], ['reddit', 'Reddit'],
    ['hn', 'HN'], ['scholar', 'Scholar'],
  ]},
  { label: 'Dev', shortcuts: [
    ['github', 'GitHub'], ['stackoverflow', 'Stack Overflow'], ['mdn', 'MDN'],
    ['npm', 'npm'], ['vercel', 'Vercel'], ['linear', 'Linear'],
  ]},
  { label: 'Design', shortcuts: [
    ['figma', 'Figma'], ['canva', 'Canva'], ['framer', 'Framer'],
    ['webflow', 'Webflow'], ['dribbble', 'Dribbble'], ['unsplash', 'Unsplash'],
  ]},
  { label: 'Work', shortcuts: [
    ['notion', 'Notion'], ['airtable', 'Airtable'], ['slack', 'Slack'],
    ['zoom', 'Zoom'], ['loom', 'Loom'], ['dropbox', 'Dropbox'],
  ]},
  { label: 'Social', shortcuts: [
    ['youtube', 'YouTube'], ['x', 'X'], ['linkedin', 'LinkedIn'],
    ['instagram', 'Instagram'], ['discord', 'Discord'], ['spotify', 'Spotify'],
  ]},
  { label: 'News', shortcuts: [
    ['medium', 'Medium'], ['substack', 'Substack'], ['bbc', 'BBC'], ['reuters', 'Reuters'],
  ]},
  { label: 'Other', shortcuts: [
    ['amazon', 'Amazon'], ['stripe', 'Stripe'], ['canvas', 'Canvas'],
  ]},
]

const HOME_SHORTCUTS: [string, string][] = HOME_SECTIONS.flatMap(s => s.shortcuts)

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pinsKey(workspaceId: string) { return `proof-quickopen-pins:${workspaceId}` }
function shuffleKey(workspaceId: string) { return `proof-quickopen-shuffle:${workspaceId}` }

function loadPins(workspaceId: string): string[] {
  try { return JSON.parse(localStorage.getItem(pinsKey(workspaceId)) || '[]') } catch { return [] }
}

function savePins(workspaceId: string, pins: string[]) {
  try { localStorage.setItem(pinsKey(workspaceId), JSON.stringify(pins)) } catch {}
}

function loadShuffleOrder(workspaceId: string): [string, string][] {
  try {
    const saved = JSON.parse(localStorage.getItem(shuffleKey(workspaceId)) || '[]') as string[]
    if (!saved.length) return []
    const map = new Map(HOME_SHORTCUTS)
    const seen = new Set<string>()
    const ordered: [string, string][] = []
    for (const k of saved) {
      if (map.has(k)) { ordered.push([k, map.get(k)!]); seen.add(k) }
    }
    for (const [k, l] of HOME_SHORTCUTS) {
      if (!seen.has(k)) ordered.push([k, l])
    }
    return ordered
  } catch { return [] }
}

function saveShuffleOrder(workspaceId: string, order: [string, string][]) {
  try { localStorage.setItem(shuffleKey(workspaceId), JSON.stringify(order.map(([k]) => k))) } catch {}
}

function getOrCreateShuffle(workspaceId: string): [string, string][] {
  const saved = loadShuffleOrder(workspaceId)
  if (saved.length) return saved
  const fresh = shuffleArray(HOME_SHORTCUTS)
  saveShuffleOrder(workspaceId, fresh)
  return fresh
}

function QuickOpenStrip({ urlInput, navigate, workspaceId }: {
  urlInput: string
  navigate: (s: string) => void
  workspaceId: string
}) {
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() =>
    typeof window !== 'undefined' ? loadPins(workspaceId) : []
  )
  const [shuffled, setShuffled] = useState<[string, string][]>(() =>
    typeof window !== 'undefined' ? getOrCreateShuffle(workspaceId) : shuffleArray(HOME_SHORTCUTS)
  )

  useEffect(() => {
    setPinnedKeys(loadPins(workspaceId))
    setShuffled(getOrCreateShuffle(workspaceId))
  }, [workspaceId])

  function togglePin(key: string) {
    setPinnedKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [key, ...prev]
      savePins(workspaceId, next)
      return next
    })
  }

  const q = urlInput.trim().toLowerCase()
  const isUrl = /^https?:\/\//i.test(q) || /^[?g]\s+/.test(q) || /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/.test(q)
  const isFiltering = !(!q || isUrl)

  // Filtering mode: flat list sorted pinned-first
  if (isFiltering) {
    const matches = shuffled.filter(([k, l]) => k.includes(q) || l.toLowerCase().includes(q))
    if (matches.length === 0) return null
    const sorted = [...matches].sort(([ka], [kb]) =>
      (pinnedKeys.includes(kb) ? 1 : 0) - (pinnedKeys.includes(ka) ? 1 : 0)
    )
    return (
      <div style={stripStyle}>
        {sorted.map(([key, label]) => (
          <ShortcutChip key={key} label={label} pinned={pinnedKeys.includes(key)}
            onClick={() => navigate(key)} onPin={() => togglePin(key)} />
        ))}
      </div>
    )
  }

  const pinnedEntries = shuffled.filter(([k]) => pinnedKeys.includes(k))
  const unpinned      = shuffled.filter(([k]) => !pinnedKeys.includes(k))

  return (
    <div style={stripStyle}>
      {pinnedEntries.map(([key, label]) => (
        <ShortcutChip key={key} label={label} pinned
          onClick={() => navigate(key)} onPin={() => togglePin(key)} />
      ))}
      {pinnedEntries.length > 0 && <SectionDivider />}
      {unpinned.map(([key, label]) => (
        <ShortcutChip key={key} label={label} pinned={false}
          onClick={() => navigate(key)} onPin={() => togglePin(key)} />
      ))}
    </div>
  )
}

const stripStyle = {
  height: '36px', flexShrink: 0,
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '0 8px',
  background: '#060606', borderBottom: '1px solid #1e1e1e',
  overflowX: 'auto' as const, overflowY: 'hidden' as const,
  scrollbarWidth: 'none' as const,
  WebkitAppRegion: 'no-drag' as const,
}

function SectionDivider() {
  return <div style={{ width: '1px', height: '14px', background: '#2e2e2e', flexShrink: 0, margin: '0 6px' }} />
}


function ShortcutChip({ label, pinned, onClick, onPin }: {
  label: string
  pinned: boolean
  onClick: () => void
  onPin: () => void
}) {
  const [hov, setHov] = useState(false)
  const [pinHov, setPinHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPinHov(false) }}
      style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        height: '22px',
        border: `1px solid ${hov ? '#2a2a2a' : pinned ? '#252525' : '#1e1e1e'}`,
        borderRadius: '3px',
        transition: 'border-color 0.1s',
      }}
    >
      <button
        onClick={onClick}
        style={{
          height: '100%', padding: '0 8px 0 10px',
          background: 'none', border: 'none', outline: 'none',
          color: hov ? '#999' : pinned ? '#777' : '#555',
          fontSize: '11px', letterSpacing: '0.02em',
          cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          transition: 'color 0.1s',
        }}
      >{label}</button>

      {/* Pin icon — always in layout to prevent width shift, opacity controls visibility */}
      <button
        onClick={e => { e.stopPropagation(); onPin() }}
        onMouseEnter={() => setPinHov(true)}
        onMouseLeave={() => setPinHov(false)}
        title={pinned ? 'Unpin from this workspace' : 'Pin to this workspace'}
        style={{
          height: '100%', padding: '0 6px 0 2px',
          background: 'none', border: 'none', outline: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          color: pinHov ? (pinned ? '#c44' : '#888') : pinned ? '#555' : '#333',
          opacity: (hov || pinned) ? 1 : 0,
          pointerEvents: (hov || pinned) ? 'auto' : 'none',
          transition: 'color 0.1s, opacity 0.1s',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1h4v1l-1 3h1a1 1 0 010 2H6v3H4V7H3a1 1 0 010-2h1L3 2V1z" />
        </svg>
      </button>
    </div>
  )
}

// ─── Workspace search panel ───────────────────────────────────────────────────

function WorkspaceSearch({ visible, tabs, panelId, onClose, onNavigate, onSwitchTab }: {
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
          placeholder="Search this workspace…"
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

        {/* Empty workspace */}
        {emptyWorkspace && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#555', letterSpacing: '0.04em' }}>
            Nothing in this workspace yet.
          </div>
        )}

        {/* No matches */}
        {!hasResults && q && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#555', letterSpacing: '0.04em' }}>
            No matches.
          </div>
        )}

        {/* DOCUMENTS */}
        {matchedDocs.length > 0 && (
          <>
            <SearchSectionLabel>Documents</SearchSectionLabel>
            {matchedDocs.map(s => (
              <SearchResultRow key={s.id} label={s.label || s.raw}
                onClick={() => act(() => openDocInPane(1, s.id))} />
            ))}
          </>
        )}

        {/* PAGES */}
        {matchedPages.length > 0 && (
          <>
            <SearchSectionLabel>Pages</SearchSectionLabel>
            {matchedPages.map(s => (
              <SearchResultRow key={s.id} label={s.label || s.raw} sub={s.url || s.raw}
                onClick={() => act(() => onNavigate(s.url || s.raw))} />
            ))}
          </>
        )}

        {/* WEB TABS */}
        {matchedTabs.length > 0 && (
          <>
            <SearchSectionLabel>Web Tabs</SearchSectionLabel>
            {matchedTabs.map(t => (
              <SearchResultRow key={t.id} label={t.title || t.url} sub={t.url}
                onClick={() => act(() => onSwitchTab(t.id))} />
            ))}
          </>
        )}

        {/* VIEWS */}
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
        border: `1px solid ${hov ? '#333' : '#252525'}`,
        borderRadius: '3px',
        color: hov ? '#ccc' : '#777',
        fontSize: '11px', letterSpacing: '0.03em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s',
      }}
    >{children}</button>
  )
}
