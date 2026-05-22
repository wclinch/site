'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { resolveCommandToUrl, getShortcutHint } from '@/lib/url'
import type { TabState, TabStatus } from './web/webTypes'
import { isAuthUrl, isAuthBlockedTitle } from './web/webTypes'
import WebTabBar from './web/WebTabBar'
import WebToolbar from './web/WebToolbar'
import WebHomePage, { type WebHomePageHandle } from './web/WebHomePage'

const MAX_TABS = 20

function makePlaceholderTab(): TabState {
  return { id: 'tab-init', url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
}

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
        border: `1px solid ${hov ? '#5E5A54' : '#252725'}`,
        borderRadius: '3px',
        color: hov ? '#8C887F' : '#8C887F',
        fontSize: '11px', letterSpacing: '0.03em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s',
      }}
    >{children}</button>
  )
}

export default function ResearchBrowser({ isFocused = false, onFocusToggle }: {
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  const panelId = 'A'
  const { addUrl, sources, activeId } = useApp()

  const tabsKey = 'proof-v3-research-tabs'

  const [isElectron, setIsElectron]   = useState(false)
  const [tabs, setTabs]               = useState<TabState[]>([makePlaceholderTab()])
  const [activeTabId, setActiveTabId] = useState<string>('tab-init')
  const [urlInput, setUrlInput]       = useState('')
  const [urlFocused, setUrlFocused]   = useState(false)
  const [actionFeedback, setActionFeedback] = useState<null | 'saved' | 'duplicate'>(null)
  const [homeMode, setHomeMode]       = useState(true)


  const viewportRef    = useRef<HTMLDivElement>(null)
  const urlInputRef    = useRef<HTMLInputElement>(null)
  const homePageRef    = useRef<WebHomePageHandle>(null)
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef    = useRef(true)
  const activeTabIdRef = useRef<string>('tab-init')
  const tabsRef        = useRef<TabState[]>([makePlaceholderTab()])

  const [tabStatuses, setTabStatuses]   = useState<Record<string, TabStatus>>({})
  const [showFallback, setShowFallback] = useState(false)
  const showFallbackRef     = useRef(false)
  const stallTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTabIdRef    = useRef<string>('')
  const stallProgressRef = useRef(false)

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

  useEffect(() => {
    homeModeRef.current = homeMode
    if (homeMode) {
      window.electronAPI?.research?.setBounds(panelId, {
        x: 0, y: 0, width: 0, height: 0,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
      requestAnimationFrame(() => {
        const el = document.activeElement as HTMLElement | null
        if (el && el !== document.body && el !== urlInputRef.current) {
          const tag = el.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return
        }
        homePageRef.current?.focus()
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
        if (active?.url) {
          setUrlInput(active.url)
          setHomeMode(false)
          homeModeRef.current = false
        } else {
          try {
            const saved = JSON.parse(localStorage.getItem(tabsKey) || '[]') as Array<{ id: string; url: string }>
            // Try active tab first, then any tab with a URL
            const match = saved.find(t => t.id === aid) ?? saved.find(t => t.url)
            if (match?.url) { setUrlInput(match.url); navigateUrl(match.url) }
          } catch {}
        }
      }
    }).catch(() => {
      api.getState(panelId).then(s => {
        if (s.url) { setUrlInput(s.url); setHomeMode(false); homeModeRef.current = false }
      }).catch(() => {})
    })

    const unUrl = api.onUrlChanged(panelId, (url, back, fwd) => {
      const id = activeTabIdRef.current
      setTabs(ts => ts.map(t => t.id === id ? { ...t, url, canGoBack: back, canGoForward: fwd } : t))
      if (!url || url === 'about:blank') return
      setUrlInput(url)
      setHomeMode(false)
      stallProgressRef.current = true
      setTabStatuses(prev => ({ ...prev, [id]: {} }))
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      stallTabIdRef.current = id
      stallProgressRef.current = false
      if (isAuthUrl(url)) {
        stallTimerRef.current = setTimeout(() => {
          stallTimerRef.current = null
          const currentId = stallTabIdRef.current
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
        homeModeRef.current = true
        try { localStorage.removeItem(tabsKey) } catch {}
      } else {
        const active = newTabs.find(t => t.id === newActiveId)
        if (active?.url) setUrlInput(active.url)
        else setUrlInput('')
        const nextHomeMode = !active?.url
        setHomeMode(nextHomeMode)
        homeModeRef.current = nextHomeMode
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

  useEffect(() => {
    const unsub = window.electronAPI?.research?.onBoundsRecalc?.(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      }))
    })
    return () => unsub?.()
  }, [])

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
      // reserved for future settings
    }
    window.addEventListener('proof:settings-changed', onSettingsChanged)
    return () => window.removeEventListener('proof:settings-changed', onSettingsChanged)
  }, [])


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
        border: '1px solid #252725', borderRadius: '4px', overflow: 'hidden',
      }}>

        <WebTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          panelId={panelId}
          isFocused={isFocused}
          onFocusToggle={onFocusToggle}
          onReorderTabs={(fromId, toId) => {
            setTabs(ts => {
              const from = ts.findIndex(t => t.id === fromId)
              const to   = ts.findIndex(t => t.id === toId)
              if (from === -1 || to === -1 || from === to) return ts
              const next = [...ts]
              next.splice(to, 0, next.splice(from, 1)[0])
              return next
            })
          }}
        />

        <WebToolbar
          active={active}
          panelId={panelId}
          urlInput={urlInput}
          urlInputRef={urlInputRef}
          homeMode={homeMode}
          actionFeedback={actionFeedback}
          onUrlChange={setUrlInput}
          onUrlFocus={e => { e.currentTarget.select(); setUrlFocused(true) }}
          onUrlBlur={() => setUrlFocused(false)}
          onUrlSubmit={() => navigate(urlInput)}
          onGoBack={() => window.electronAPI?.research?.goBack(panelId)}
          onGoForward={() => window.electronAPI?.research?.goForward(panelId)}
          onReload={() => {
            if (!active?.loading && homeMode && urlInput) navigateUrl(urlInput)
            else window.electronAPI?.research?.reload(panelId)
          }}
          onHome={() => setHomeMode(true)}
          onSave={savePage}
        />


        {homeMode && urlFocused && getShortcutHint(urlInput) && (
          <div style={{
            height: '22px', flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            background: '#070807', borderBottom: '1px solid #111211',
            fontSize: '10px', color: '#8C887F', letterSpacing: '0.03em',
            userSelect: 'none',
          }}>
            {getShortcutHint(urlInput)}
          </div>
        )}

        {/* Native browser viewport — outer shell insets the native view 1px from the panel border */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 1px 1px' }}>
        <div
          ref={viewportRef}
          style={{ flex: 1, minHeight: 0, background: '#070807', position: 'relative', overflow: 'hidden', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {showFallback && (() => {
            const st = tabStatuses[activeTabId]
            const url = active?.url ?? ''
            const isBlocked = st?.authBlocked && !st?.failedLoad
            return (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: '#070807',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '32px', userSelect: 'none',
              }}>
                <p style={{ fontSize: '13px', color: '#8C887F', margin: 0, fontWeight: 500, textAlign: 'center' }}>
                  {isBlocked ? 'Sign-in blocked.' : "Page didn't load."}
                </p>
                <p style={{ fontSize: '11px', color: '#8C887F', margin: '4px 0 12px', lineHeight: 1.65, textAlign: 'center', maxWidth: '300px' }}>
                  {isBlocked
                    ? 'Some sites block sign-in here. Try your default browser.'
                    : 'Check the connection or try again.'}
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
          {homeMode && <WebHomePage ref={homePageRef} navigate={navigate} />}
          {!isElectron && !homeMode && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#8C887F', fontSize: '11px',
              letterSpacing: '0.08em', userSelect: 'none',
            }}>Web is only available in the desktop app.</div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
