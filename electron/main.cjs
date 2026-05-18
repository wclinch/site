const { app, BrowserWindow, Menu, dialog, shell, protocol, nativeImage, ipcMain, WebContentsView, session } = require('electron')
const path = require('path')
const fs   = require('fs')

// In dev: load .env.local so credentials are available without setting system env vars.
// In prod: bake-secrets.mjs writes electron/secrets.cjs at build time (process.env is empty in packaged app).
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }) } catch {}
try { Object.assign(process.env, require('./secrets.cjs')) } catch {}

const isDev   = process.env.SITE_DEV === '1' || !app.isPackaged
const OUT_DIR = path.join(__dirname, '..', 'out')

app.setName('Site')
if (process.platform === 'darwin' && isDev) {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(iconPath)) {
    try { app.dock.setIcon(nativeImage.createFromPath(iconPath)) } catch {}
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'site', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function resolveStatic(pathname) {
  const clean = pathname.replace(/^\/+/, '').replace(/\?.*$/, '')
  function safeUnder(p) {
    const abs  = path.resolve(p)
    const root = path.resolve(OUT_DIR)
    return abs === root || abs.startsWith(root + path.sep) ? abs : null
  }
  const direct = safeUnder(path.join(OUT_DIR, clean))
  if (direct && fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct
  const withIndex = safeUnder(path.join(OUT_DIR, clean, 'index.html'))
  if (withIndex && fs.existsSync(withIndex)) return withIndex
  const trimmedHtml = safeUnder(path.join(OUT_DIR, `${clean.replace(/\/$/, '')}.html`))
  if (trimmedHtml && fs.existsSync(trimmedHtml)) return trimmedHtml
  return path.join(OUT_DIR, 'app', 'index.html')
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
}

// ─── Per-panel state ──────────────────────────────────────────────────────────
//
// Each Research panel (A and B) is completely independent: its own tab views,
// tab states, active tab, bounds, and pending-navigate queue.

function makePanel() {
  return {
    tabViews:    new Map(),   // id → WebContentsView
    tabStates:   new Map(),   // id → { url, title, loading, canGoBack, canGoForward }
    tabZoom:     new Map(),   // id → last-applied auto zoom factor (dedupe)
    activeTabId: null,
    lastBounds:  null,        // most recent valid { x, y, width, height } in physical px
    lastCssWidth: 0,          // most recent CSS width of the Web panel (drives auto zoom)
    pendingUrl:  null,        // URL deferred until bounds are known
    pendingTimer: null,
    zoomTimer:   null,        // debounce for scheduleAutoZoom
  }
}

let mainWindow = null
const MAX_TABS = 20
const panels   = { A: makePanel() }

// Global flags — affect both panels the same way.
let windowReady           = false
let inFullscreenTransition = false
let isMinimized            = false
let isRestoring            = false
let modalOpen              = false
let devToolsOpen           = false
// Cached scale factors — updated only when DevTools is closed and the iW/cw ratio
// looks healthy (> 0.8). Protects against the transient state where DevTools is
// opening but devtools-opened hasn't fired yet (iW drops dramatically before the flag).
let cachedScaleX = 1.0
let cachedScaleY = 1.0
// Scroll-restore gate: set to true by fullscreen/restore transitions so
// scheduleScrollRestore() knows to fire restoreAllScrolls after bounds settle.
let pendingScrollRestore = false
let scrollRestoreTimer   = null


// Returns true if view exists and its webContents is alive.
function wcAlive(view) {
  return !!(view && view.webContents && !view.webContents.isDestroyed())
}

// ─── Auto-readable Web zoom ───────────────────────────────────────────────────
// Per-tab automatic zoom for the right Web panel only — view panes stay at 1.0.
// Picks a readable factor from CSS panel width; hard floor 0.85, prefer >= 0.9.
// Debounced so it doesn't flicker mid-resize, deduped so we don't churn the
// zoom on every set-bounds tick. setZoomFactor only — no CSS transform, no
// reload, no UA spoofing.
const AUTO_ZOOM_MIN          = 0.80
const AUTO_ZOOM_MAX          = 1.00
// Width anchors for the linear zoom ramp: at FLOOR_PX the zoom hits MIN, at
// CEIL_PX it hits MAX. Typical Web panel widths (~700–1100 CSS px) land near
// the floor, so app shells like Google Docs get room to breathe.
const AUTO_ZOOM_FLOOR_PX     = 800
const AUTO_ZOOM_CEIL_PX      = 1600
const AUTO_ZOOM_DEBOUNCE_MS  = 80

// Linear width → zoom ramp, quantized to 0.05 steps so tiny width drift doesn't
// re-emit IPC. Below FLOOR_PX everything pins to MIN, above CEIL_PX to MAX.
function computeAutoZoom(cssWidth) {
  if (!cssWidth || cssWidth <= 0) return AUTO_ZOOM_MAX
  const span = AUTO_ZOOM_CEIL_PX - AUTO_ZOOM_FLOOR_PX
  const t    = Math.max(0, Math.min(1, (cssWidth - AUTO_ZOOM_FLOOR_PX) / span))
  const z    = AUTO_ZOOM_MIN + t * (AUTO_ZOOM_MAX - AUTO_ZOOM_MIN)
  return Math.round(z * 20) / 20
}

function applyAutoZoom(panel, view, id, cssWidth) {
  if (!wcAlive(view) || !id) return
  const factor = computeAutoZoom(cssWidth)
  if (panel.tabZoom.get(id) === factor) return
  panel.tabZoom.set(id, factor)
  try { view.webContents.setZoomFactor(factor) } catch {}
}

function scheduleAutoZoom(panel) {
  if (panel.zoomTimer) clearTimeout(panel.zoomTimer)
  panel.zoomTimer = setTimeout(() => {
    panel.zoomTimer = null
    if (!panel.activeTabId) return
    const view = panel.tabViews.get(panel.activeTabId)
    applyAutoZoom(panel, view, panel.activeTabId, panel.lastCssWidth)
  }, AUTO_ZOOM_DEBOUNCE_MS)
}

// Debounced scroll restore — called from set-bounds after applying new bounds.
// Resets the 200ms timer on each call so we restore after the LAST bounds
// update, not the first.  No-ops if no transition is pending.
function scheduleScrollRestore() {
  if (!pendingScrollRestore) return
  if (scrollRestoreTimer) clearTimeout(scrollRestoreTimer)
  scrollRestoreTimer = setTimeout(() => {
    scrollRestoreTimer   = null
    pendingScrollRestore = false
    restoreAllScrolls()
  }, 200)
}

// ─── Scroll save / restore ────────────────────────────────────────────────────
// Preserves page scroll position across fullscreen transitions and minimize/restore.
// Saved as a minified JSON string: [windowScrollX, windowScrollY, [[childPath[], top, left], ...]]
const savedScrolls = new Map() // key → { view, json }

// Injected into each WebContentsView to capture all scrolled elements.
const CAPTURE_SCROLL_JS = `(function(){try{var r=[],a=document.querySelectorAll('*');for(var i=0,m=Math.min(a.length,600);i<m;i++){var e=a[i];if(e.scrollTop>5||e.scrollLeft>5){var p=[],c=e;for(var d=0;d<15&&c&&c!==document.documentElement;d++){var par=c.parentElement;if(!par)break;var k=0;for(var j=0;j<par.children.length;j++)if(par.children[j]===c){k=j;break}p.unshift(k);c=par}r.push([p,e.scrollTop,e.scrollLeft])}}return JSON.stringify([window.scrollX||0,window.scrollY||0,r])}catch(x){return'[0,0,[]]'}})()
`

function makeRestoreScrollJs(json) {
  return `(function(d){try{window.scrollTo(d[0],d[1]);for(var i=0;i<d[2].length;i++){var it=d[2][i],el=document.documentElement;for(var j=0;j<it[0].length;j++){if(!el.children[it[0][j]]){el=null;break}el=el.children[it[0][j]]}if(el&&el!==document.documentElement){el.scrollTop=it[1];el.scrollLeft=it[2]}}}catch(x){}})(${json})`
}

function saveAllScrolls() {
  savedScrolls.clear()
  const tasks = []
  for (const pid of Object.keys(panels)) {
    const panel = panels[pid]
    if (!panel.activeTabId) continue
    const view = panel.tabViews.get(panel.activeTabId)
    if (!wcAlive(view)) continue
    const key = `panel-${pid}`
    tasks.push(view.webContents.executeJavaScript(CAPTURE_SCROLL_JS)
      .then(json => { if (json) savedScrolls.set(key, { view, json }) }).catch(() => {}))
  }
  for (const paneId of Object.keys(viewPanes)) {
    const pane = viewPanes[paneId]
    if (!wcAlive(pane.view)) continue
    const url = pane.view.webContents.getURL()
    if (!url || url === 'about:blank') continue
    const key = `pane-${paneId}`
    tasks.push(pane.view.webContents.executeJavaScript(CAPTURE_SCROLL_JS)
      .then(json => { if (json) savedScrolls.set(key, { view: pane.view, json }) }).catch(() => {}))
  }
  return Promise.all(tasks)
}

function restoreAllScrolls() {
  const tasks = []
  for (const [key, { view, json }] of savedScrolls.entries()) {
    if (!wcAlive(view)) continue
    tasks.push(view.webContents.executeJavaScript(makeRestoreScrollJs(json)).catch(() => {}))
  }
  // Clear after promises settle so views aren't GC-blocked during JS execution
  return Promise.all(tasks).then(() => savedScrolls.clear())
}

// ─── Center view panes ────────────────────────────────────────────────────────
// View 1 and View 2 — one WebContentsView each for center pane live pages.
const viewPanes = {
  '1': { view: null, lastBounds: null, pendingUrl: null },
  '2': { view: null, lastBounds: null, pendingUrl: null },
}

function getOrCreateViewPane(win, paneId) {
  const pane = viewPanes[paneId]
  if (wcAlive(pane.view)) return pane.view
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      sandbox: true, webSecurity: true,
      partition: 'persist:site-research-A', // shared session — shared logins with Web tabs
    },
  })
  win.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  const wc = view.webContents
  wc.on('will-navigate', (event, url) => {
    try {
      const { protocol: p } = new URL(url)
      if (p !== 'https:' && p !== 'http:') event.preventDefault()
    } catch { event.preventDefault() }
  })

  // All window.open / target=_blank / popup requests from View panes → Site Web tab.
  wc.setWindowOpenHandler(({ url }) => {
    openUrlInNewTab(win, url)
    return { action: 'deny' }
  })

  // Re-apply zoom after every navigation (cross-origin resets Chromium's stored value).
  wc.on('did-finish-load', () => {
    if (wcAlive(view)) view.webContents.setZoomFactor(1.0)
  })

  pane.view = view
  return view
}

// ─── Panel helpers ────────────────────────────────────────────────────────────

function emitTabsChanged(win, pid) {
  const panel = panels[pid]
  const tabs  = []
  for (const [id, state] of panel.tabStates) tabs.push({ id, ...state })
  win.webContents.send('research:tabs-changed', pid, tabs, panel.activeTabId)
}

function labelFromUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.google.com' && u.pathname === '/search') {
      return u.searchParams.get('q') ?? u.hostname.replace(/^www\./, '')
    }
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 60)
  }
}

function showActiveView(win, pid) {
  const panel = panels[pid]
  if (!panel.activeTabId) return
  const view = panel.tabViews.get(panel.activeTabId)
  if (!wcAlive(view)) return
  try { win.contentView.removeChildView(view) } catch {}
  win.contentView.addChildView(view)
  if (panel.lastBounds && !modalOpen) view.setBounds(panel.lastBounds)
  try { view.webContents.focus() } catch {}
}

function hideAllViews() {
  for (const pid of Object.keys(panels)) {
    const panel = panels[pid]
    if (!panel.activeTabId) continue
    const view = panel.tabViews.get(panel.activeTabId)
    if (wcAlive(view)) {
      try { view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
    }
  }
  for (const pid of Object.keys(viewPanes)) {
    const pane = viewPanes[pid]
    if (wcAlive(pane.view)) {
      try { pane.view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
    }
  }
}

function restoreAllViews() {
  for (const pid of Object.keys(panels)) {
    const panel = panels[pid]
    if (!panel.activeTabId || !panel.lastBounds) continue
    const view = panel.tabViews.get(panel.activeTabId)
    if (wcAlive(view)) {
      try { view.setBounds(panel.lastBounds) } catch {}
    }
  }
  for (const pid of Object.keys(viewPanes)) {
    const pane = viewPanes[pid]
    if (pane.lastBounds && wcAlive(pane.view)) {
      try { pane.view.setBounds(pane.lastBounds) } catch {}
    }
  }
}

// Route any new-window request (window.open / target=_blank / popup / OAuth)
// to a new Site Web tab instead of an independent OS window.
function openUrlInNewTab(win, url) {
  try {
    const { protocol: p } = new URL(url)
    if (p !== 'https:' && p !== 'http:') return
  } catch { return }
  const panel = panels['A']
  if (!panel || panel.tabViews.size >= MAX_TABS) return
  const id = `tab-A-${Date.now()}-popup`
  createTabView(win, 'A', id)
  // Seed state before switchToTab so React sees a real URL → homeMode=false.
  const state = panel.tabStates.get(id)
  if (state) { state.url = url; state.title = labelFromUrl(url); state.loading = true }
  // switchToTab handles showActiveView + lazy-load (with bounds guard).
  // Do NOT call loadURL here — switchToTab already does it via the bounds check,
  // and a second call would cancel the first in-flight load causing a blank tab.
  switchToTab(win, 'A', id)
}

function tryFirePending(win, pid) {
  const panel = panels[pid]
  if (!panel.pendingUrl) return
  if (!windowReady || !panel.lastBounds) {
    console.log(`[${pid}] tryFirePending blocked (windowReady=${windowReady} hasLastBounds=${!!panel.lastBounds}): ${panel.pendingUrl?.slice(0, 60)}`)
    return
  }
  const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
  if (!wcAlive(view)) { console.log(`[${pid}] tryFirePending: view not alive`); return }
  if (panel.pendingTimer) clearTimeout(panel.pendingTimer)
  panel.pendingTimer = setTimeout(() => {
    panel.pendingTimer = null
    const u = panel.pendingUrl
    if (!u) return
    panel.pendingUrl = null
    const v = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!wcAlive(v)) return
    console.log(`[${pid}] pendingUrl fired: ${u.slice(0, 60)}`)
    showActiveView(win, pid)
    v.webContents.loadURL(u).catch(err => console.log(`[${pid}] loadURL error:`, err?.message))
  }, 80)
}

function createTabView(win, pid, id) {
  const panel = panels[pid]
  const view  = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      partition: `persist:site-research-${pid}`,
    },
  })
  win.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  try { view.setBackgroundColor('#060606') } catch {}

  const wc = view.webContents

  wc.on('will-navigate', (event, url) => {
    try {
      const { protocol: p } = new URL(url)
      if (p !== 'https:' && p !== 'http:') event.preventDefault()
    } catch { event.preventDefault() }
  })

  // All window.open / target=_blank / popup requests → Site Web tab.
  // Shared partition so logins carry over; no standalone BrowserWindows.
  wc.setWindowOpenHandler(({ url }) => {
    openUrlInNewTab(win, url)
    return { action: 'deny' }
  })

  const state = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
  panel.tabStates.set(id, state)

  function syncNav() {
    state.canGoBack    = wc.navigationHistory.canGoBack()
    state.canGoForward = wc.navigationHistory.canGoForward()
  }
  function sendTabUpdated() {
    win.webContents.send('research:tab-updated', pid, id, { ...state })
  }

  wc.on('did-navigate', (_e, url) => {
    state.url = url; syncNav(); sendTabUpdated()
    if (id === panel.activeTabId && url !== 'about:blank')
      win.webContents.send('research:url-changed', pid, url, state.canGoBack, state.canGoForward)
  })
  wc.on('did-navigate-in-page', (_e, url) => {
    state.url = url; syncNav(); sendTabUpdated()
    if (id === panel.activeTabId && url !== 'about:blank')
      win.webContents.send('research:url-changed', pid, url, state.canGoBack, state.canGoForward)
  })
  wc.on('page-title-updated', (_e, title) => {
    state.title = title; sendTabUpdated()
    if (id === panel.activeTabId)
      win.webContents.send('research:title-changed', pid, title)
  })
  wc.on('did-start-loading', () => {
    state.loading = true; sendTabUpdated()
    if (id === panel.activeTabId)
      win.webContents.send('research:loading-changed', pid, true)
  })
  wc.on('did-stop-loading', () => {
    state.loading = false; syncNav(); sendTabUpdated()
    if (id === panel.activeTabId) {
      win.webContents.send('research:loading-changed', pid, false)
      win.webContents.send('research:can-navigate',    pid, state.canGoBack, state.canGoForward)
    }
  })
  wc.on('did-fail-load', (_e, code) => {
    if (code === -3) return
    win.webContents.send('research:fail-load', pid, id, code)
  })

  // Re-apply zoom after every navigation (cross-origin resets zoom to per-origin stored value).
  // Clear dedupe entry so the auto-zoom re-applies even if the cached factor matches.
  wc.on('did-finish-load', () => {
    if (wcAlive(view) && id === panel.activeTabId) {
      panel.tabZoom.delete(id)
      applyAutoZoom(panel, view, id, panel.lastCssWidth)
    }
  })

  panel.tabViews.set(id, view)
  return view
}

function switchToTab(win, pid, id) {
  const panel = panels[pid]
  if (!panel.tabViews.has(id)) return
  // Hide the previously active tab.
  if (panel.activeTabId && panel.activeTabId !== id && panel.tabViews.has(panel.activeTabId)) {
    panel.tabViews.get(panel.activeTabId).setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }
  panel.activeTabId = id
  const state = panel.tabStates.get(id) || { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
  const hasContent = !!(state.url && state.url !== 'about:blank')

  // Only expand the view to real bounds when the tab has content.
  // Blank/new tabs stay hidden (0,0,0,0) — React home screen shows instead.
  if (!(inFullscreenTransition || isMinimized || isRestoring) && hasContent) showActiveView(win, pid)

  // If this view was restored from a saved workspace but never loaded, load it now.
  // Guard on bounds — don't loadURL into a 0×0 view; defer until bounds arrive.
  const switchView = panel.tabViews.get(id)
  if (wcAlive(switchView) && hasContent) {
    const loaded = switchView.webContents.getURL()
    if (!loaded || loaded === 'about:blank') {
      if (panel.lastBounds && windowReady) {
        switchView.webContents.loadURL(state.url).catch(() => {})
      } else {
        panel.pendingUrl = state.url
        console.log(`[${pid}] pendingUrl set (switchToTab): ${state.url.slice(0, 60)}`)
        if (windowReady) win.webContents.send('research:recalc-bounds')
      }
    }
  }

  if (wcAlive(switchView)) applyAutoZoom(panel, switchView, id, panel.lastCssWidth)

  // Only send url-changed for real URLs. Sending '' triggers setHomeMode(false)
  // in the renderer which would flash white before homeMode corrects itself.
  if (hasContent) win.webContents.send('research:url-changed', pid, state.url, state.canGoBack, state.canGoForward)
  win.webContents.send('research:title-changed',   pid, state.title)
  win.webContents.send('research:loading-changed', pid, state.loading)
  win.webContents.send('research:can-navigate',    pid, state.canGoBack, state.canGoForward)
  emitTabsChanged(win, pid)
}

// ─── IPC setup ────────────────────────────────────────────────────────────────

function setupResearchBrowser(win) {
  // Create one initial tab for the single Research panel.
  const initId = `tab-A-${Date.now()}`
  createTabView(win, 'A', initId)
  panels['A'].activeTabId = initId
  emitTabsChanged(win, 'A')

  // Track whether will-enter-full-screen fired for this transition.
  // On macOS app-restore, enter-full-screen fires WITHOUT will-enter-full-screen.
  let willFSFired = false

  win.on('will-enter-full-screen', () => {
    willFSFired = true
    inFullscreenTransition = true
    saveAllScrolls()
  })
  win.on('will-leave-full-screen', () => {
    inFullscreenTransition = true
    saveAllScrolls()
  })
  win.on('enter-full-screen', () => {
    const wasUserTriggered = willFSFired
    willFSFired = false
    inFullscreenTransition = false
    pendingScrollRestore = true
    win.webContents.send('research:recalc-bounds')
  })
  win.on('leave-full-screen', () => {
    inFullscreenTransition = false
    pendingScrollRestore = true
    win.webContents.send('research:recalc-bounds')
  })
  function clearAndZeroAllViews() {
    for (const pid of Object.keys(panels)) {
      const panel = panels[pid]
      panel.lastBounds = null
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (wcAlive(view)) {
        try { view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
    for (const paneId of Object.keys(viewPanes)) {
      const pane = viewPanes[paneId]
      pane.lastBounds = null
      if (wcAlive(pane.view)) {
        try { pane.view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
  }

  win.webContents.on('devtools-opened', () => {
    devToolsOpen = true
    clearAndZeroAllViews()
  })
  win.webContents.on('devtools-closed', () => {
    devToolsOpen = false
    clearAndZeroAllViews()
    setTimeout(() => { if (!win.isDestroyed()) win.webContents.send('research:recalc-bounds') }, 150)
  })
  win.on('resize', () => {
    if (inFullscreenTransition || isMinimized || isRestoring) return
    win.webContents.send('research:recalc-bounds')
  })
  win.on('minimize', () => {
    isMinimized = true; isRestoring = false; saveAllScrolls()
  })
  win.on('restore',  () => {
    isMinimized = false
    isRestoring = true
    setTimeout(() => {
      isRestoring = false
      pendingScrollRestore = true
      win.webContents.send('research:recalc-bounds')
    }, 100)
  })

  // ── navigate ──────────────────────────────────────────────────────────────
  ipcMain.on('research:navigate', (_e, pid, url) => {
    const panel = panels[pid]
    if (!panel) return

    if (panel.tabViews.size === 0) {
      const id = `tab-${pid}-${Date.now()}`
      createTabView(win, pid, id)
      panel.activeTabId = id
      const s = panel.tabStates.get(id)
      if (s) { s.url = url; s.title = labelFromUrl(url); s.loading = true }
      emitTabsChanged(win, pid)
      showActiveView(win, pid)
      if (windowReady && panel.lastBounds) {
        panel.tabViews.get(id)?.webContents?.loadURL(url).catch(err =>
          console.log(`[${pid}] loadURL error:`, err?.message))
      } else {
        console.log(`[${pid}] pendingUrl set (navigate, no-tab): ${url.slice(0, 60)}`)
        panel.pendingUrl = url
        if (windowReady) win.webContents.send('research:recalc-bounds')
      }
      return
    }

    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!wcAlive(view)) return

    const sN = panel.tabStates.get(panel.activeTabId)
    if (sN) { sN.url = url; sN.title = labelFromUrl(url); sN.loading = true }
    if (panel.activeTabId) win.webContents.send('research:tab-updated', pid, panel.activeTabId, { ...sN })

    if (!windowReady || !panel.lastBounds) {
      console.log(`[${pid}] pendingUrl set (navigate): ${url.slice(0, 60)}`)
      panel.pendingUrl = url
      if (windowReady) win.webContents.send('research:recalc-bounds')
      return
    }
    showActiveView(win, pid)
    view.webContents.loadURL(url).catch(err => console.log(`[${pid}] loadURL error:`, err?.message))
  })

  // ── set-bounds ─────────────────────────────────────────────────────────────
  ipcMain.on('research:set-bounds', (_e, pid, rect) => {
    const panel = panels[pid]
    if (!panel) return
    // While DevTools is open the window is wider — keep views zeroed.
    if (devToolsOpen) {
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view) view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      return
    }
    const [cw, ch] = win.getContentSize()
    if (!devToolsOpen && rect.innerWidth && rect.innerWidth / cw > 0.8) {
      cachedScaleX = cw / rect.innerWidth
      cachedScaleY = ch / (rect.innerHeight || ch)
    }
    const sx = cachedScaleX, sy = cachedScaleY
    const x = Math.round(rect.x     * sx)
    const y = Math.round(rect.y     * sy)
    const w = Math.round(rect.width * sx)
    const h = Math.round(rect.height * sy)
    if (isMinimized || isRestoring) return
    if (inFullscreenTransition && (w === 0 || h === 0)) return
    if (w > 0 && h > 0) {
      if (x <= cw / 10) return
      panel.lastBounds   = { x, y, width: w, height: h }
      panel.lastCssWidth = rect.width
      if (!modalOpen) {
        const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
        if (view) {
          view.setBounds({ x, y, width: w, height: h })
          scheduleAutoZoom(panel)
          if (!panel.pendingUrl) scheduleScrollRestore()
        }
        tryFirePending(win, pid)
      }
    } else {
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view) view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    }
  })

  ipcMain.handle('shell:open-external', (_e, url) => {
    try {
      const { protocol: p } = new URL(url)
      if (p === 'https:' || p === 'http:') shell.openExternal(url)
    } catch {}
  })

  // ── nav controls ───────────────────────────────────────────────────────────
  ipcMain.on('research:go-back', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc || wc.isDestroyed()) return
    if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  })
  ipcMain.on('research:go-forward', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc || wc.isDestroyed()) return
    if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  })
  ipcMain.on('research:reload', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc || wc.isDestroyed()) return
    wc.reload()
  })

  // ── get-state / get-tabs ───────────────────────────────────────────────────
  ipcMain.handle('research:get-state', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
    const state = panel.activeTabId && panel.tabStates.get(panel.activeTabId)
    return state ? { ...state } : { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
  })

  ipcMain.handle('research:get-tabs', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return { tabs: [], activeTabId: null }
    const tabs = []
    for (const [id, state] of panel.tabStates) tabs.push({ id, ...state })
    return { tabs, activeTabId: panel.activeTabId }
  })

  // ── new-tab ────────────────────────────────────────────────────────────────
  ipcMain.on('research:new-tab', (_e, pid, url) => {
    const panel = panels[pid]
    if (!panel || panel.tabViews.size >= MAX_TABS) return
    const id = `tab-${pid}-${Date.now()}`
    createTabView(win, pid, id)
    switchToTab(win, pid, id)
    if (url) {
      if (panel.lastBounds) {
        panel.tabViews.get(id)?.webContents?.loadURL(url).catch(() => {})
      } else {
        panel.pendingUrl = url
        win.webContents.send('research:recalc-bounds')
      }
    }
  })

  // ── close-tab ─────────────────────────────────────────────────────────────
  ipcMain.on('research:close-tab', (_e, pid, id) => {
    const panel = panels[pid]
    if (!panel || !panel.tabViews.has(id)) return
    const view     = panel.tabViews.get(id)
    const wasActive = id === panel.activeTabId

    try { if (wcAlive(view)) view.webContents.setAudioMuted(true) } catch {}
    try { if (wcAlive(view)) view.webContents.stop() } catch {}
    win.contentView.removeChildView(view)
    try { if (wcAlive(view)) view.webContents.loadURL('about:blank').catch(() => {}) } catch {}
    panel.tabViews.delete(id)
    panel.tabStates.delete(id)
    panel.tabZoom.delete(id)

    if (panel.tabViews.size === 0) {
      const newId = `tab-${pid}-${Date.now()}`
      createTabView(win, pid, newId)
      switchToTab(win, pid, newId)
      return
    }
    if (wasActive) {
      const ids = [...panel.tabViews.keys()]
      switchToTab(win, pid, ids[ids.length - 1])
    } else {
      emitTabsChanged(win, pid)
    }
  })

  // ── switch-tab ─────────────────────────────────────────────────────────────
  ipcMain.on('research:switch-tab', (_e, pid, id) => {
    const panel = panels[pid]
    if (panel && panel.tabViews.has(id)) switchToTab(win, pid, id)
  })

  // ── load-workspace ─────────────────────────────────────────────────────────
  ipcMain.on('research:load-workspace', (_e, tabs) => {
    const panel      = panels['A']
    const savedBounds = panel.lastBounds

    if (panel.pendingTimer) { clearTimeout(panel.pendingTimer); panel.pendingTimer = null }
    panel.pendingUrl = null

    for (const [, view] of panel.tabViews) {
      try { if (wcAlive(view)) view.webContents.setAudioMuted(true) } catch {}
      try { if (wcAlive(view)) view.webContents.stop() } catch {}
      try { win.contentView.removeChildView(view) } catch {}
      try { if (wcAlive(view)) view.webContents.loadURL('about:blank').catch(() => {}) } catch {}
    }
    panel.tabViews.clear()
    panel.tabStates.clear()
    panel.tabZoom.clear()
    if (panel.zoomTimer) { clearTimeout(panel.zoomTimer); panel.zoomTimer = null }
    panel.activeTabId = null
    panel.lastBounds  = savedBounds

    const workspaceTabs = Array.isArray(tabs) ? tabs.filter(t => t && t.url) : []
    const base = Date.now()

    if (workspaceTabs.length === 0) {
      const id = `tab-A-ws-${base}`
      createTabView(win, 'A', id)
      panel.activeTabId = id
      emitTabsChanged(win, 'A')
      if (savedBounds && windowReady) showActiveView(win, 'A')
      return
    }

    const ids = workspaceTabs.map((_, i) => `tab-A-ws-${base}-${i}`)
    for (let i = 0; i < workspaceTabs.length; i++) {
      createTabView(win, 'A', ids[i])
      const state = panel.tabStates.get(ids[i])
      if (state) { state.url = workspaceTabs[i].url || ''; state.title = workspaceTabs[i].title || '' }
    }
    const activeIdx = workspaceTabs.findIndex(t => t.active)
    panel.activeTabId = ids[activeIdx >= 0 ? activeIdx : 0]
    emitTabsChanged(win, 'A')

    const activeTabIdx = activeIdx >= 0 ? activeIdx : 0
    const activeUrl = workspaceTabs[activeTabIdx].url
    if (activeUrl) {
      if (savedBounds && windowReady) {
        showActiveView(win, 'A')
        panel.tabViews.get(ids[activeTabIdx])?.webContents?.loadURL(activeUrl).catch(() => {})
      } else {
        panel.pendingUrl = activeUrl
        if (windowReady) win.webContents.send('research:recalc-bounds')
      }
    } else if (savedBounds && windowReady) {
      showActiveView(win, 'A')
    }
  })

  // ── view pane IPC ──────────────────────────────────────────────────────────
  ipcMain.on('view:navigate', (_e, paneId, url) => {
    const pane = viewPanes[paneId]
    if (!pane) return
    // Mute whatever is currently playing before navigating away.
    if (wcAlive(pane.view)) {
      try { pane.view.webContents.setAudioMuted(true) } catch {}
      try { pane.view.webContents.stop() } catch {}
    }
    pane.pendingUrl = url
    // Fire immediately only if valid bounds are already known.
    if (pane.lastBounds && !modalOpen) {
      const view = getOrCreateViewPane(win, paneId)
      view.webContents.setAudioMuted(false)
      console.log(`[view:${paneId}] loadURL immediate: ${url.slice(0, 60)}`)
      view.webContents.loadURL(url).catch(err => console.log(`[view:${paneId}] loadURL error:`, err?.message))
      pane.pendingUrl = null
    } else {
      console.log(`[view:${paneId}] pendingUrl set: ${url.slice(0, 60)} (lastBounds=${!!pane.lastBounds} modalOpen=${modalOpen})`)
    }
  })

  ipcMain.on('view:set-bounds', (_e, paneId, rect) => {
    const pane = viewPanes[paneId]
    if (!pane) return
    if (isMinimized || isRestoring) return
    const sx = cachedScaleX, sy = cachedScaleY
    const x = Math.round(rect.x     * sx)
    const y = Math.round(rect.y     * sy)
    const w = Math.round(rect.width * sx)
    const h = Math.round(rect.height * sy)
    if (inFullscreenTransition && (w === 0 || h === 0)) return
    if (w > 0 && h > 0) {
      pane.lastBounds = { x, y, width: w, height: h }
      if (!modalOpen) {
        const view = getOrCreateViewPane(win, paneId)
        // Keep view pane on top of z-order so it reliably receives mouse events
        // (mirroring showActiveView for the web browser panel).
        try { win.contentView.removeChildView(view) } catch {}
        win.contentView.addChildView(view)
        view.setBounds({ x, y, width: w, height: h })
        if (wcAlive(view)) view.webContents.setZoomFactor(1.0)
        if (!pane.pendingUrl) scheduleScrollRestore()
        if (pane.pendingUrl) {
          const url = pane.pendingUrl
          pane.pendingUrl = null
          view.webContents.setAudioMuted(false)
          view.webContents.loadURL(url).catch(err => console.log(`[view:${paneId}] loadURL error:`, err?.message))
        }
      }
    } else {
      pane.lastBounds = null
      const v = pane.view
      if (wcAlive(v)) try { v.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
    }
  })

  ipcMain.on('view:clear', (_e, paneId) => {
    const pane = viewPanes[paneId]
    if (!pane) return
    pane.pendingUrl = null
    pane.lastBounds = null
    const v = pane.view
    if (wcAlive(v)) {
      try { v.webContents.setAudioMuted(true) } catch {}
      try { v.webContents.stop() } catch {}
      try { v.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      v.webContents.loadURL('about:blank').catch(() => {})
    }
  })

  ipcMain.on('view:reload', (_e, paneId) => {
    const pane = viewPanes[paneId]
    if (!wcAlive(pane?.view)) return
    pane.view.webContents.reload()
  })

  // ── modal state ────────────────────────────────────────────────────────────
  ipcMain.on('app:set-modal', (event, isOpen) => {
    modalOpen = !!isOpen
    if (modalOpen) {
      hideAllViews()
    } else {
      restoreAllViews()
      // Fire any URLs that were deferred while the modal was blocking bounds updates.
      for (const pid of Object.keys(panels)) tryFirePending(win, pid)
      for (const paneId of Object.keys(viewPanes)) {
        const pane = viewPanes[paneId]
        if (pane.pendingUrl && pane.lastBounds) {
          const url = pane.pendingUrl
          pane.pendingUrl = null
          const view = getOrCreateViewPane(win, paneId)
          if (wcAlive(view)) {
            console.log(`[view:${paneId}] pendingUrl fired (modal close): ${url.slice(0, 60)}`)
            view.webContents.setAudioMuted(false)
            view.webContents.loadURL(url).catch(err => console.log(`[view:${paneId}] loadURL error:`, err?.message))
          }
        }
      }
    }
    // sendSync requires a returnValue to unblock the renderer immediately
    // after native views are hidden — before React renders the modal.
    event.returnValue = null
  })

  // ── cleanup ────────────────────────────────────────────────────────────────
  win.on('closed', () => {
    modalOpen = false
    const channels = [
      'research:navigate', 'research:set-bounds',
      'research:go-back', 'research:go-forward', 'research:reload',
      'research:new-tab', 'research:close-tab', 'research:switch-tab',
      'research:load-workspace', 'app:set-modal',
      'view:navigate', 'view:set-bounds', 'view:clear', 'view:reload',
    ]
    for (const ch of channels) ipcMain.removeAllListeners(ch)
    ipcMain.removeHandler('research:get-state')
    ipcMain.removeHandler('research:get-tabs')

    const panel = panels['A']
    panel.tabViews.clear()
    panel.tabStates.clear()
    panel.tabZoom.clear()
    panel.activeTabId = null
    panel.lastBounds  = null
    panel.lastCssWidth = 0
    panel.pendingUrl  = null
    if (panel.pendingTimer) { clearTimeout(panel.pendingTimer); panel.pendingTimer = null }
    if (panel.zoomTimer)    { clearTimeout(panel.zoomTimer);    panel.zoomTimer    = null }

    for (const pid of Object.keys(viewPanes)) {
      const pane = viewPanes[pid]
      if (wcAlive(pane.view)) {
        try { pane.view.webContents.close?.() } catch {}
      }
      viewPanes[pid] = { view: null, lastBounds: null, pendingUrl: null }
    }
  })
}

// ─── Polar auth IPC ───────────────────────────────────────────────────────────
//
// The org access token (POLAR_ACCESS_TOKEN) lives here in the main process only —
// never exposed to the renderer. Set it as an environment variable before launch.

const POLAR_ORG_ID       = 'ef60cd00-9e07-4db8-83e8-bda9a2afa313'
const POLAR_API          = 'https://api.polar.sh'

function polarHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function setupAuth() {
  const ORG_TOKEN = process.env.POLAR_ACCESS_TOKEN ?? ''

  // Sign in: find customer by email → create session → check subscriptions
  ipcMain.handle('auth:get-session', async (_e, email) => {
    if (!ORG_TOKEN) return { error: 'not_configured' }
    try {
      // 1. Find customer by email in this org
      const cusRes = await fetch(
        `${POLAR_API}/v1/customers?email=${encodeURIComponent(email)}&organization_id=${POLAR_ORG_ID}&limit=1`,
        { headers: polarHeaders(ORG_TOKEN) }
      )
      if (!cusRes.ok) return { error: 'polar_error', status: cusRes.status }
      const cusData = await cusRes.json()
      const customer = cusData?.items?.[0]
      if (!customer) return { error: 'no_account' }

      // 2. Create a customer session (short-lived token + portal URL)
      const sesRes = await fetch(`${POLAR_API}/v1/customer-sessions/`, {
        method: 'POST',
        headers: polarHeaders(ORG_TOKEN),
        body: JSON.stringify({ customer_id: customer.id }),
      })
      if (!sesRes.ok) return { error: 'polar_error', status: sesRes.status }
      const session = await sesRes.json()

      // 3. Check subscription status with the customer session token
      const subRes = await fetch(
        `${POLAR_API}/v1/customer-portal/subscriptions?active=true&limit=10`,
        { headers: polarHeaders(session.token) }
      )
      let isPro = false
      if (subRes.ok) {
        const subData = await subRes.json()
        isPro = (subData?.items ?? []).some(s =>
          s.status === 'active' || s.status === 'trialing'
        )
      }

      return {
        ok: true,
        token:      session.token,
        expiresAt:  session.expires_at,
        customerId: customer.id,
        email:      customer.email,
        isPro,
      }
    } catch (err) {
      return { error: 'network_error', message: err?.message }
    }
  })

  // Recheck subscription status with an existing customer session token
  ipcMain.handle('auth:check-subscriptions', async (_e, customerToken) => {
    try {
      const res = await fetch(
        `${POLAR_API}/v1/customer-portal/subscriptions?active=true&limit=10`,
        { headers: polarHeaders(customerToken) }
      )
      if (!res.ok) return { error: 'polar_error', status: res.status }
      const data = await res.json()
      const isPro = (data?.items ?? []).some(s =>
        s.status === 'active' || s.status === 'trialing'
      )
      return { ok: true, isPro }
    } catch {
      return { error: 'network_error' }
    }
  })

  // Get a fresh customer portal URL (do not cache — Polar docs say generate fresh each time)
  ipcMain.handle('auth:get-portal-url', async (_e, customerId) => {
    if (!ORG_TOKEN) return { error: 'not_configured' }
    try {
      const res = await fetch(`${POLAR_API}/v1/customer-sessions/`, {
        method: 'POST',
        headers: polarHeaders(ORG_TOKEN),
        body: JSON.stringify({ customer_id: customerId }),
      })
      if (!res.ok) return { error: 'polar_error', status: res.status }
      const data = await res.json()
      return { ok: true, portalUrl: data.customer_portal_url }
    } catch {
      return { error: 'network_error' }
    }
  })
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  const icon = fs.existsSync(iconPath) ? iconPath : undefined

  mainWindow = new BrowserWindow({
    width: 1320, height: 840,
    minWidth: 900, minHeight: 600,
    resizable: true, maximizable: true, fullscreenable: true,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Site', icon, show: false,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      sandbox: true, webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    windowReady = true
    showActiveView(mainWindow, 'A')
    if (panels.A.pendingUrl) mainWindow.webContents.send('research:recalc-bounds')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const ok = isDev ? url.startsWith('http://localhost:3000') : url.startsWith('site://')
    if (!ok) { event.preventDefault(); shell.openExternal(url) }
    if (ok && !url.includes('/app')) {
      const panel = panels['A']
      for (const [, view] of panel.tabViews) {
        try { view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/')
  } else {
    mainWindow.loadURL('site://localhost/')
  }

  setupResearchBrowser(mainWindow)
}

// ─── Menu / reset ─────────────────────────────────────────────────────────────

async function resetSiteData(browserWindow) {
  const choice = await dialog.showMessageBox(browserWindow ?? null, {
    type: 'warning', buttons: ['Cancel', 'Reset'],
    defaultId: 0, cancelId: 0,
    message: 'Reset Site data?',
    detail: 'Removes all files, projects, and drafts on the device. Cannot be reversed.',
  })
  if (choice.response !== 1) return
  const session = (browserWindow ?? BrowserWindow.getAllWindows()[0])?.webContents.session
  if (!session) return
  await session.clearStorageData({
    storages: ['indexdb', 'localstorage', 'cookies', 'cachestorage', 'serviceworkers', 'shadercache', 'websql'],
  })
  ;(browserWindow ?? BrowserWindow.getAllWindows()[0])?.reload()
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' },
        { label: 'Reset Site Data…', click: (_i, w) => resetSiteData(w) },
        { type: 'separator' },
        { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' }, { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [{ label: 'Reset Site Data…', click: (_i, w) => resetSiteData(w) }, { type: 'separator' }] : []),
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('site', async (request) => {
      const url      = new URL(request.url)
      const filePath = resolveStatic(url.pathname)
      const ext      = path.extname(filePath).toLowerCase()
      const mime     = MIME[ext] || 'application/octet-stream'
      const csp = [
        "default-src 'self' site:",
        "script-src 'self' site: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' site: 'unsafe-inline'",
        "img-src 'self' site: data: blob:",
        "font-src 'self' site: data:",
        "connect-src 'self' site: blob: data: https://api.polar.sh",
        "worker-src 'self' site: blob:",
        "frame-src https:",
        "object-src 'none'", "base-uri 'none'", "form-action 'none'",
      ].join('; ')
      try {
        const body = await fs.promises.readFile(filePath)
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Security-Policy': csp,
            'X-Content-Type-Options': 'nosniff',
          },
        })
      } catch {
        return new Response(`Not found: ${url.pathname}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })
  }

  // Override UA on the shared web-tab / View-pane session so sites like Canva
  // see a plain Chrome UA instead of detecting Electron via navigator.userAgentData.
  const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  session.fromPartition('persist:site-research-A').setUserAgent(CHROME_UA)

  buildMenu()
  setupAuth()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
