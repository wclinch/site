'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { resolveCommandToUrl } from '@/lib/url'

type BrowserState = {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

type BoundsPayload = {
  x: number; y: number; width: number; height: number
  innerWidth: number; innerHeight: number
}

declare global {
  interface Window {
    electronAPI?: {
      research: {
        navigate:         (url: string) => void
        setBounds:        (rect: BoundsPayload) => void
        goBack:           () => void
        goForward:        () => void
        reload:           () => void
        getState:         () => Promise<BrowserState>
        onUrlChanged:     (cb: (url: string, back: boolean, fwd: boolean) => void) => () => void
        onTitleChanged:   (cb: (title: string) => void) => () => void
        onLoadingChanged: (cb: (loading: boolean) => void) => () => void
        onCanNavigate:    (cb: (back: boolean, fwd: boolean) => void) => () => void
      }
    }
  }
}

// Browser persistence keys. The main process keeps researchState in
// memory for as long as the BrowserWindow is alive — that covers Cmd-R
// (renderer reload). For full quits/restarts we also stash the URL +
// home flag in localStorage so the user lands back on whatever page
// they were on (or the home overlay if that's how they left it).
const BROWSER_URL_KEY  = 'proof-v3-browser-url'
const BROWSER_HOME_KEY = 'proof-v3-browser-home'

function readSavedHome(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(BROWSER_HOME_KEY) === 'true' } catch { return false }
}
function readSavedUrl(): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(BROWSER_URL_KEY) ?? '' } catch { return '' }
}


export default function RightPanel() {
  const { addUrl, sources } = useApp()
  const [isElectron, setIsElectron] = useState(false)
  const [state, setState]           = useState<BrowserState>({ url: '', title: '', loading: false, canGoBack: false, canGoForward: false })
  const [urlInput, setUrlInput]     = useState('')
  const [saveStatus, setSaveStatus] = useState<null | 'saved' | 'duplicate'>(null)
  // Lazy initializers so the very first render already reflects the
  // user's last session — avoids a flash of "home" before restoration.
  const [homeMode, setHomeMode]     = useState(readSavedHome)
  const viewportRef   = useRef<HTMLDivElement>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const homeModeRef   = useRef(readSavedHome())

  useEffect(() => { setIsElectron(!!window.electronAPI) }, [])

  useEffect(() => {
    homeModeRef.current = homeMode
    // Persist so a full app restart lands the user back on the same
    // mode they left in.
    try { localStorage.setItem(BROWSER_HOME_KEY, String(homeMode)) } catch {}
    if (homeMode) {
      // Zero bounds immediately when entering home mode so the native
      // view doesn't sit on top of the home screen.
      window.electronAPI?.research?.setBounds({
        x: 0, y: 0, width: 0, height: 0,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
    } else {
      // Leaving home mode — nudge the bounds-watcher (mounted with
      // [] deps) so sendBounds re-evaluates with the new homeModeRef
      // and the WebContentsView gets non-zero bounds. Without this,
      // ResizeObserver wouldn't fire (the element didn't actually
      // change size) and the page would load behind a hidden view.
      window.dispatchEvent(new Event('resize'))
    }
  }, [homeMode])

  useEffect(() => {
    const api = window.electronAPI?.research
    if (!api) return
    api.getState().then(s => {
      setState(s); setUrlInput(s.url)
      // Two restoration cases:
      //   • Cmd-R (renderer reload): main still has the URL in
      //     researchState — s.url is non-empty, view is already loaded.
      //     Nothing to do here.
      //   • Full quit + relaunch: main is fresh, s.url is empty. Pull
      //     the last URL from localStorage and re-navigate so the user
      //     comes back to wherever they were. If they were on home
      //     mode, the homeModeRef-aware bounds path keeps the view
      //     invisible and the page loads in the background until they
      //     leave home.
      if (!s.url) {
        const savedUrl = readSavedUrl()
        if (savedUrl) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[RightPanel] restoring URL from localStorage →', savedUrl)
          }
          setUrlInput(savedUrl)
          // Use the shared pipeline so bounds-before-navigate ordering
          // is preserved on cold start too.
          navigateUrl(savedUrl, { clearHome: false })
        }
      }
    }).catch(() => {})
    const unUrl     = api.onUrlChanged((url, back, fwd) => {
      setState(s => ({ ...s, url, canGoBack: back, canGoForward: fwd }))
      setUrlInput(url)
      // Any navigation in the WebContentsView clears home mode so the
      // view is actually visible. Covers paths that don't go through
      // RightPanel.navigate (e.g. a Sites click in the Stack calling
      // research.navigate directly via openInPane).
      setHomeMode(false)
      // Persist for restoration on full restart.
      try { if (url) localStorage.setItem(BROWSER_URL_KEY, url) } catch {}
    })
    const unTitle   = api.onTitleChanged(title => setState(s => ({ ...s, title })))
    const unLoading = api.onLoadingChanged(loading => setState(s => ({ ...s, loading })))
    const unNav     = api.onCanNavigate((back, fwd) => setState(s => ({ ...s, canGoBack: back, canGoForward: fwd })))
    return () => { unUrl(); unTitle(); unLoading(); unNav() }
  }, [])

  // Proactive sync from AppContext.openInPane → when a Sites row is
  // clicked, the URL bar updates, home mode clears, and the
  // WebContentsView is pre-positioned before loadURL fires. Without
  // pre-positioning, the page starts loading at zero bounds (the old
  // home-mode bounds) and never repaints until a hard reload — which
  // is exactly the "page only appears after Ctrl-R" symptom.
  useEffect(() => {
    function onNav(e: Event) {
      const url = (e as CustomEvent<string>).detail
      if (typeof url !== 'string' || !url) return
      if (process.env.NODE_ENV === 'development') {
        console.log('[RightPanel] proof:browser-navigate →', url)
      }
      navigateUrl(url)
    }
    window.addEventListener('proof:browser-navigate', onNav as EventListener)
    return () => window.removeEventListener('proof:browser-navigate', onNav as EventListener)
    // navigateUrl only touches refs/setters/global APIs, so the
    // first-render closure stays correct across re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    let lastKey = ''

    function sendBounds() {
      // While in home mode, keep the native view zeroed — our React
      // home screen is rendered in this div instead.
      if (homeModeRef.current) {
        const iW = window.innerWidth
        const iH = window.innerHeight
        if (lastKey !== 'zero') {
          lastKey = 'zero'
          window.electronAPI?.research?.setBounds({ x: 0, y: 0, width: 0, height: 0, innerWidth: iW, innerHeight: iH })
        }
        return
      }

      const r = viewportRef.current?.getBoundingClientRect()
      if (!r) return

      // Inset the native view 1px on left, right, and bottom so the
      // bordered viewport's frame is always visible — subpixel rounding
      // (flex + content-box + DPR) otherwise lets the WebContentsView
      // paint over the 1px border on those edges. Top is untouched: it
      // sits flush against the toolbar's own borderBottom, so adding a
      // gap there would expose a dark stripe below the toolbar.
      const x  = Math.round(r.left)   + 1
      const y  = Math.round(r.top)
      const w  = Math.max(0, Math.round(r.width)  - 2)
      const h  = Math.max(0, Math.round(r.height) - 1)
      const iW = window.innerWidth
      const iH = window.innerHeight

      if (w <= 0 || h <= 0) {
        if (lastKey !== 'zero') {
          lastKey = 'zero'
          window.electronAPI?.research?.setBounds({ x: 0, y: 0, width: 0, height: 0, innerWidth: iW, innerHeight: iH })
        }
        return
      }

      const key = `${x},${y},${w},${h},${iW},${iH}`
      if (key === lastKey) return
      lastKey = key

      if (process.env.NODE_ENV === 'development') {
        console.log('[RightPanel] viewport rect →', { x, y, w, h, iW, iH })
      }

      window.electronAPI?.research?.setBounds({ x, y, width: w, height: h, innerWidth: iW, innerHeight: iH })
    }

    const observer = new ResizeObserver(sendBounds)
    observer.observe(el)
    window.addEventListener('resize', sendBounds)

    const intervalId = setInterval(sendBounds, 50)
    const timeoutId  = setTimeout(() => clearInterval(intervalId), 400)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
      observer.disconnect()
      window.removeEventListener('resize', sendBounds)
      window.electronAPI?.research?.setBounds({
        x: 0, y: 0, width: 0, height: 0,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
    }
  }, [])

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }, [])

  // Single navigation pipeline. Every entry path — URL bar Enter,
  // starter chip click in HomeScreen, Sites click in the Stack, and
  // localStorage restoration on app startup — funnels through here so
  // the IPC order is always:
  //   1. set-bounds  → view.setBounds(realRect)
  //   2. navigate    → wc.loadURL(url)
  // Reversing those two on the main process causes the page to load
  // at zero bounds and never repaint until a manual reload.
  //
  // `clearHome` defaults to true for user-initiated navigation. The
  // restore-on-mount path passes false so a user who left in home
  // mode comes back to home mode (with the page already loading in
  // the background, ready to appear the moment they leave home).
  function navigateUrl(url: string, opts: { clearHome?: boolean } = {}) {
    if (!url) return
    const clearHome = opts.clearHome !== false
    const dev = process.env.NODE_ENV === 'development'
    if (dev) console.log('[RightPanel.navigateUrl]', url, { clearHome })

    setUrlInput(url)
    if (clearHome) {
      setHomeMode(false)
      // Pre-flip the ref so the bounds-send below isn't skipped by the
      // still-pending state update.
      homeModeRef.current = false
    }

    const api = window.electronAPI?.research
    const el  = viewportRef.current
    if (!api) return

    // Pre-send real bounds (skip when home mode is keeping the view
    // hidden — the page can still load in the background and will
    // paint as soon as homeMode clears and bounds become non-zero).
    if (el && !homeModeRef.current) {
      const r  = el.getBoundingClientRect()
      const iW = window.innerWidth
      const iH = window.innerHeight
      const x  = Math.round(r.left)   + 1
      const y  = Math.round(r.top)
      const w  = Math.max(0, Math.round(r.width)  - 2)
      const h  = Math.max(0, Math.round(r.height) - 1)
      if (w > 0 && h > 0) {
        if (dev) console.log('[RightPanel.navigateUrl] set-bounds →', { x, y, w, h })
        api.setBounds({ x, y, width: w, height: h, innerWidth: iW, innerHeight: iH })
      }
    }

    if (dev) console.log('[RightPanel.navigateUrl] navigate →', url)
    api.navigate(url)
  }

  function navigate(raw: string) {
    const url = resolveCommandToUrl(raw)
    if (!url) return
    navigateUrl(url)
  }

  function flash(status: NonNullable<typeof saveStatus>) {
    setSaveStatus(status)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2000)
  }

  function savePage() {
    if (!state.url) return
    const duplicate = sources.some(s => s.url === state.url || s.raw === state.url)
    if (duplicate) { flash('duplicate'); return }
    const label = state.title.trim()
      || (() => { try { return new URL(state.url).hostname.replace(/^www\./, '') } catch { return state.url } })()
    addUrl(state.url, undefined, label)
    flash('saved')
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '5px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          border: '1px solid #1e1e1e', borderRadius: '4px', overflow: 'hidden',
        }}>

          {/* URL / nav toolbar */}
          <div style={{
            height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
            gap: '3px', padding: '0 8px', borderBottom: '1px solid #1a1a1a', background: '#060606',
          }}>
            <NavBtn disabled={!state.canGoBack}    onClick={() => window.electronAPI?.research?.goBack()}    title="Back">‹</NavBtn>
            <NavBtn disabled={!state.canGoForward} onClick={() => window.electronAPI?.research?.goForward()} title="Forward">›</NavBtn>
            <NavBtn onClick={() => window.electronAPI?.research?.reload()} title={state.loading ? 'Stop' : 'Reload'}>
              {state.loading ? '×' : '↺'}
            </NavBtn>
            <NavBtn onClick={() => setHomeMode(true)} title="Home">⌂</NavBtn>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => { if (e.key === 'Enter') navigate(urlInput) }}
              placeholder="Search or enter URL"
              style={{
                flex: 1, height: '22px', background: '#111', border: '1px solid #222',
                borderRadius: '3px', color: '#bbb', fontSize: '11px', padding: '0 8px',
                outline: 'none', fontFamily: 'inherit', letterSpacing: '0.02em',
              }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = '#444' }}
              onBlurCapture={e  => { e.currentTarget.style.borderColor = '#222' }}
            />
            {state.url && (
              <button
                onClick={savePage}
                title="Save page to Sites"
                style={{
                  height: '22px', flexShrink: 0, display: 'flex', alignItems: 'center',
                  background: 'none', border: '1px solid #252525', borderRadius: '3px',
                  color: saveStatus === 'saved' ? '#4d8c62' : saveStatus === 'duplicate' ? '#555' : '#444',
                  fontSize: '10px', padding: '0 7px', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
                  minWidth: '78px', justifyContent: 'center',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#333'
                  e.currentTarget.style.color = saveStatus === 'saved' ? '#4d8c62' : '#888'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#252525'
                  e.currentTarget.style.color = saveStatus === 'saved' ? '#4d8c62' : saveStatus === 'duplicate' ? '#555' : '#444'
                }}
              >
                {saveStatus === 'saved'     ? 'Saved'         :
                 saveStatus === 'duplicate' ? 'Already saved' : 'Save'}
              </button>
            )}
          </div>

          {/* Viewport — WebContentsView is overlaid here by main process.
              When homeMode is true, we render the home screen instead and
              the native view is zeroed so it doesn't cover it. */}
          <div
            ref={viewportRef}
            style={{
              flex: 1, minHeight: 0,
              // Dark fill matches the chrome around it — when the
              // WebContentsView is inset by 1px on three sides, the
              // hairline that shows through reads as part of the frame
              // instead of a random color from behind in the DOM.
              background: '#060606',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {homeMode && (
              <HomeScreen />
            )}
            {!isElectron && !homeMode && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#2a2a2a', fontSize: '11px',
                letterSpacing: '0.08em', userSelect: 'none',
              }}>
                Desktop app required
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
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
        <span style={{ fontSize: '12px', color: '#555', fontWeight: 500, letterSpacing: '0.03em' }}>
          Start researching
        </span>
        <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.02em' }}>
          Search the web or enter a URL above.
        </span>
      </div>
    </div>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({
  children, onClick, disabled, title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: '24px', height: '24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: '3px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#2a2a2a' : '#555',
        fontSize: '16px', fontFamily: 'inherit', padding: 0, outline: 'none',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#aaa' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = '#555' }}
    >
      {children}
    </button>
  )
}
