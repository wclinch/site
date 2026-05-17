const { app, BrowserWindow, Menu, dialog, shell, protocol, nativeImage, ipcMain, WebContentsView, session } = require('electron')
const path = require('path')
const fs   = require('fs')

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
    activeTabId: null,
    lastBounds:  null,        // most recent valid { x, y, width, height }
    pendingUrl:  null,        // URL deferred until bounds are known
    pendingTimer: null,
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

// ─── Debug logger (remove after scroll-jump is diagnosed) ────────────────────
function dbg(event, ...rest) {
  const t = new Date().toISOString().slice(11, 23)
  console.log(`[DBG ${t}] [${event}]`, ...rest)
}
function dbgWinState(win, label) {
  try {
    const [cw, ch] = win.getContentSize()
    const fs = win.isFullScreen()
    const mn = win.isMinimized()
    console.log(`[DBG]   win@${label}: contentSize=${cw}x${ch} fullscreen=${fs} minimized=${mn}`)
    for (const pid of Object.keys(panels)) {
      const panel = panels[pid]
      const st = panel.activeTabId && panel.tabStates.get(panel.activeTabId)
      const lb = panel.lastBounds
      console.log(`[DBG]   panel-${pid}: tab=${panel.activeTabId?.slice(-8)} url=${st?.url?.slice(0,60)} lastBounds=${lb ? `${lb.x},${lb.y},${lb.width}x${lb.height}` : 'null'}`)
    }
    for (const paneId of Object.keys(viewPanes)) {
      const pane = viewPanes[paneId]
      const url = pane.view && !pane.view.webContents.isDestroyed() ? pane.view.webContents.getURL() : '—'
      const lb = pane.lastBounds
      console.log(`[DBG]   pane-${paneId}: url=${url.slice(0,60)} lastBounds=${lb ? `${lb.x},${lb.y},${lb.width}x${lb.height}` : 'null'}`)
    }
  } catch {}
}
// Async: capture scrollY from a WebContentsView and log it.
function dbgScrollAsync(label, view) {
  if (!view || view.webContents.isDestroyed()) return
  view.webContents.executeJavaScript(
    `(function(){try{if(window.scrollY)return window.scrollY;var a=document.querySelectorAll('*');for(var i=0;i<Math.min(a.length,300);i++)if(a[i].scrollTop>0)return a[i].scrollTop;return 0}catch(x){return-1}})()`)
    .then(y => console.log(`[DBG]   scrollY@${label}:`, y)).catch(() => {})
}
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!view || view.webContents.isDestroyed()) continue
    const key = `panel-${pid}`
    tasks.push(view.webContents.executeJavaScript(CAPTURE_SCROLL_JS)
      .then(json => { if (json) savedScrolls.set(key, { view, json }) }).catch(() => {}))
  }
  for (const paneId of Object.keys(viewPanes)) {
    const pane = viewPanes[paneId]
    if (!pane.view || pane.view.webContents.isDestroyed()) continue
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
  console.log(`[DBG-restore] savedScrolls.size=${savedScrolls.size}`)
  for (const [key, { view, json }] of savedScrolls.entries()) {
    try {
      const parsed = JSON.parse(json)
      console.log(`[DBG-restore] ${key}: windowScroll=[${parsed[0]},${parsed[1]}] elements=${parsed[2].length}`)
      if (parsed[2].length > 0) {
        console.log(`[DBG-restore] ${key}: first element scrollTop=${parsed[2][0][1]} path=[${parsed[2][0][0]}]`)
      }
    } catch {}
    if (!view || view.webContents.isDestroyed()) continue
    tasks.push(view.webContents.executeJavaScript(makeRestoreScrollJs(json)).catch(() => {}))
  }
  savedScrolls.clear()
  return Promise.all(tasks)
}

// ─── Center view panes ────────────────────────────────────────────────────────
// View 1 and View 2 — one WebContentsView each for center pane live pages.
const viewPanes = {
  '1': { view: null, lastBounds: null, pendingUrl: null },
  '2': { view: null, lastBounds: null, pendingUrl: null },
}

function getOrCreateViewPane(win, paneId) {
  const pane = viewPanes[paneId]
  if (pane.view && !pane.view.webContents.isDestroyed()) return pane.view
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

  // Intercept popups from pinned Pages — route to a new Site Web tab.
  wc.setWindowOpenHandler(({ url }) => {
    openUrlInNewTab(win, url)
    return { action: 'deny' }
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
  if (!view || view.webContents.isDestroyed()) return
  const st = panel.tabStates.get(panel.activeTabId)
  dbg(`showActiveView[${pid}]: removeChildView+addChildView url=${st?.url?.slice(0,60)} lastBounds=${JSON.stringify(panel.lastBounds)}`)
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
    if (view && !view.webContents.isDestroyed()) {
      try { view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
    }
  }
  for (const pid of Object.keys(viewPanes)) {
    const pane = viewPanes[pid]
    if (pane.view && !pane.view.webContents.isDestroyed()) {
      try { pane.view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
    }
  }
}

function restoreAllViews() {
  for (const pid of Object.keys(panels)) {
    const panel = panels[pid]
    if (!panel.activeTabId || !panel.lastBounds) continue
    const view = panel.tabViews.get(panel.activeTabId)
    if (view && !view.webContents.isDestroyed()) {
      try { view.setBounds(panel.lastBounds) } catch {}
    }
  }
  for (const pid of Object.keys(viewPanes)) {
    const pane = viewPanes[pid]
    if (pane.lastBounds && pane.view && !pane.view.webContents.isDestroyed()) {
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
  // Seed state before switchToTab so React sees a non-empty URL in
  // onTabsChanged and keeps homeMode=false instead of showing home screen.
  const state = panel.tabStates.get(id)
  if (state) { state.url = url; state.title = labelFromUrl(url); state.loading = true }
  switchToTab(win, 'A', id)
  if (panel.lastBounds) {
    panel.tabViews.get(id)?.webContents.loadURL(url).catch(() => {})
  } else {
    panel.pendingUrl = url
    if (!win.webContents.isDestroyed()) win.webContents.send('research:recalc-bounds')
  }
}

function tryFirePending(win, pid) {
  const panel = panels[pid]
  if (!panel.pendingUrl || !windowReady || !panel.lastBounds) return
  const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
  if (!view || view.webContents.isDestroyed()) return
  if (panel.pendingTimer) clearTimeout(panel.pendingTimer)
  panel.pendingTimer = setTimeout(() => {
    panel.pendingTimer = null
    const u = panel.pendingUrl
    if (!u) return
    panel.pendingUrl = null
    const v = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!v || v.webContents.isDestroyed()) return
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

  // Intercept window.open / target=_blank / popup / OAuth redirects —
  // open as a new Site Web tab instead of an independent OS window.
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
    if (id === panel.activeTabId) {
      win.webContents.send('research:loading-changed', pid, true)
      if (!(inFullscreenTransition || isMinimized || isRestoring) && state.url && state.url !== 'about:blank') showActiveView(win, pid)
    }
  })
  wc.on('did-stop-loading', () => {
    state.loading = false; syncNav(); sendTabUpdated()
    if (id === panel.activeTabId) {
      win.webContents.send('research:loading-changed', pid, false)
      win.webContents.send('research:can-navigate',    pid, state.canGoBack, state.canGoForward)
    }
  })
  wc.on('did-fail-load', (_e, code) => { if (code === -3) return })

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
  const switchView = panel.tabViews.get(id)
  if (switchView && !switchView.webContents.isDestroyed() && hasContent) {
    const loaded = switchView.webContents.getURL()
    if (!loaded || loaded === 'about:blank') {
      switchView.webContents.loadURL(state.url).catch(() => {})
    }
  }

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
    dbg('will-enter-full-screen'); dbgWinState(win, 'pre')
    for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-pre-fs`, v) }
    for (const paneId of Object.keys(viewPanes)) { dbgScrollAsync(`pane-${paneId}-pre-fs`, viewPanes[paneId].view) }
    saveAllScrolls()
  })
  win.on('will-leave-full-screen', () => {
    inFullscreenTransition = true
    dbg('will-leave-full-screen'); dbgWinState(win, 'pre')
    for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-pre-leave`, v) }
    for (const paneId of Object.keys(viewPanes)) { dbgScrollAsync(`pane-${paneId}-pre-leave`, viewPanes[paneId].view) }
    saveAllScrolls()
  })
  win.on('enter-full-screen', () => {
    const wasUserTriggered = willFSFired
    willFSFired = false
    inFullscreenTransition = false
    dbg(`enter-full-screen wasUserTriggered=${wasUserTriggered}`); dbgWinState(win, 'post')
    win.webContents.send('research:recalc-bounds')
    dbg('enter-full-screen: recalc-bounds sent')
    setTimeout(() => {
      dbg('enter-full-screen: restoring scrolls (220ms)')
      for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-before-restore`, v) }
      restoreAllScrolls().then(() => {
        for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-after-restore`, v) }
      })
    }, 220)
  })
  win.on('leave-full-screen', () => {
    inFullscreenTransition = false
    dbg('leave-full-screen'); dbgWinState(win, 'post')
    win.webContents.send('research:recalc-bounds')
    dbg('leave-full-screen: recalc-bounds sent')
    setTimeout(() => {
      dbg('leave-full-screen: restoring scrolls (220ms)')
      restoreAllScrolls()
    }, 220)
  })
  function clearAndZeroAllViews() {
    for (const pid of Object.keys(panels)) {
      const panel = panels[pid]
      panel.lastBounds = null
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view && !view.webContents.isDestroyed()) {
        try { view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
    for (const paneId of Object.keys(viewPanes)) {
      const pane = viewPanes[paneId]
      pane.lastBounds = null
      if (pane.view && !pane.view.webContents.isDestroyed()) {
        try { pane.view.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
  }

  win.webContents.on('devtools-opened', () => {
    devToolsOpen = true
    dbg('devtools-opened: zeroing all views')
    clearAndZeroAllViews()
  })
  win.webContents.on('devtools-closed', () => {
    devToolsOpen = false
    dbg('devtools-closed: zeroing + recalc in 150ms')
    clearAndZeroAllViews()
    setTimeout(() => { if (!win.isDestroyed()) win.webContents.send('research:recalc-bounds') }, 150)
  })
  win.on('resize', () => {
    if (inFullscreenTransition || isMinimized || isRestoring) {
      dbg('resize: BLOCKED', { inFullscreenTransition, isMinimized, isRestoring })
      return
    }
    dbg('resize: recalc-bounds sent'); dbgWinState(win, 'resize')
    win.webContents.send('research:recalc-bounds')
  })
  win.on('minimize', () => {
    dbg('minimize'); dbgWinState(win, 'minimize')
    for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-pre-minimize`, v) }
    isMinimized = true; isRestoring = false; saveAllScrolls()
  })
  win.on('restore',  () => {
    dbg('restore'); dbgWinState(win, 'restore')
    isMinimized = false
    isRestoring = true
    setTimeout(() => {
      isRestoring = false
      dbg('restore: isRestoring cleared, restoring scrolls')
      for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-before-restore`, v) }
      restoreAllScrolls().then(() => {
        for (const pid of Object.keys(panels)) { const v = panels[pid].activeTabId && panels[pid].tabViews.get(panels[pid].activeTabId); dbgScrollAsync(`panel-${pid}-after-restore`, v) }
      })
    }, 150)
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
        panel.tabViews.get(id).webContents.loadURL(url).catch(err =>
          console.log(`[${pid}] loadURL error:`, err?.message))
      } else {
        panel.pendingUrl = url
        if (windowReady) win.webContents.send('research:recalc-bounds')
      }
      return
    }

    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view || view.webContents.isDestroyed()) return

    const sN = panel.tabStates.get(panel.activeTabId)
    if (sN) { sN.url = url; sN.title = labelFromUrl(url); sN.loading = true }
    if (panel.activeTabId) win.webContents.send('research:tab-updated', pid, panel.activeTabId, { ...sN })

    showActiveView(win, pid)

    if (!windowReady || !panel.lastBounds) {
      panel.pendingUrl = url
      if (windowReady) win.webContents.send('research:recalc-bounds')
      return
    }
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
    if (isMinimized || isRestoring) {
      dbg(`research:set-bounds[${pid}]: BLOCKED isMinimized=${isMinimized} isRestoring=${isRestoring} rect=${rect.x},${rect.y},${rect.width}x${rect.height}`)
      return
    }
    if (inFullscreenTransition && (w === 0 || h === 0)) {
      dbg(`research:set-bounds[${pid}]: BLOCKED inFullscreenTransition+zero w=${w} h=${h}`)
      return
    }
    if (w > 0 && h > 0) {
      if (x <= cw / 10) {
        dbg(`research:set-bounds[${pid}]: BLOCKED near-zero-x x=${x} cw=${cw}`)
        return
      }
      const prevBounds = panel.lastBounds
      panel.lastBounds = { x, y, width: w, height: h }
      if (!modalOpen) {
        const activeState = panel.activeTabId && panel.tabStates.get(panel.activeTabId)
        const hasContent  = !!(activeState?.url && activeState.url !== 'about:blank')
        const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
        if (view && hasContent) {
          dbg(`research:set-bounds[${pid}]: setBounds ${x},${y},${w}x${h} url=${activeState?.url?.slice(0,50)}`)
          const sizeChanged = prevBounds && (prevBounds.width !== w || prevBounds.height !== h)
          if (sizeChanged && !view.webContents.isDestroyed()) {
            view.webContents.executeJavaScript(CAPTURE_SCROLL_JS).then(json => {
              if (view.webContents.isDestroyed()) return
              view.setBounds({ x, y, width: w, height: h })
              if (json && json !== '[0,0,[]]') {
                setTimeout(() => {
                  if (!view.webContents.isDestroyed())
                    view.webContents.executeJavaScript(makeRestoreScrollJs(json)).catch(() => {})
                }, 120)
              }
            }).catch(() => {
              if (!view.webContents.isDestroyed()) view.setBounds({ x, y, width: w, height: h })
            })
          } else {
            view.setBounds({ x, y, width: w, height: h })
          }
        }
        tryFirePending(win, pid)
      }
    } else {
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view) {
        dbg(`research:set-bounds[${pid}]: ZERO-BOUND (w=${w} h=${h}) url=${panel.tabStates.get(panel.activeTabId)?.url?.slice(0,50)}`)
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      }
    }
  })

  // ── nav controls ───────────────────────────────────────────────────────────
  ipcMain.on('research:go-back', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc.isDestroyed() && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  })
  ipcMain.on('research:go-forward', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc.isDestroyed() && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  })
  ipcMain.on('research:reload', (_e, pid) => {
    const panel = panels[pid]
    if (!panel) return
    const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
    if (!view) return
    const wc = view.webContents
    if (!wc.isDestroyed()) wc.reload()
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
        panel.tabViews.get(id).webContents.loadURL(url).catch(() => {})
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

    try { if (!view.webContents.isDestroyed()) view.webContents.setAudioMuted(true) } catch {}
    try { if (!view.webContents.isDestroyed()) view.webContents.stop() } catch {}
    win.contentView.removeChildView(view)
    try { if (!view.webContents.isDestroyed()) view.webContents.loadURL('about:blank').catch(() => {}) } catch {}
    panel.tabViews.delete(id)
    panel.tabStates.delete(id)

    if (panel.tabViews.size === 0) {
      panel.activeTabId = null
      emitTabsChanged(win, pid)
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
      try { if (!view.webContents.isDestroyed()) view.webContents.setAudioMuted(true) } catch {}
      try { if (!view.webContents.isDestroyed()) view.webContents.stop() } catch {}
      try { win.contentView.removeChildView(view) } catch {}
      try { if (!view.webContents.isDestroyed()) view.webContents.loadURL('about:blank').catch(() => {}) } catch {}
    }
    panel.tabViews.clear()
    panel.tabStates.clear()
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
        panel.tabViews.get(ids[activeTabIdx])?.webContents.loadURL(activeUrl).catch(() => {})
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
    if (pane.view && !pane.view.webContents.isDestroyed()) {
      try { pane.view.webContents.setAudioMuted(true) } catch {}
      try { pane.view.webContents.stop() } catch {}
    }
    pane.pendingUrl = url
    // Fire immediately only if valid bounds are already known.
    if (pane.lastBounds && !modalOpen) {
      const view = getOrCreateViewPane(win, paneId)
      view.webContents.setAudioMuted(false)
      view.webContents.loadURL(url).catch(err => console.log(`[view:${paneId}] loadURL error:`, err?.message))
      pane.pendingUrl = null
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
    if (inFullscreenTransition && (w === 0 || h === 0)) {
      dbg(`view:set-bounds[${paneId}]: BLOCKED inFullscreenTransition+zero w=${w} h=${h}`)
      return
    }
    if (w > 0 && h > 0) {
      const prevBounds = pane.lastBounds
      pane.lastBounds = { x, y, width: w, height: h }
      if (!modalOpen) {
        const view = getOrCreateViewPane(win, paneId)
        const currentUrl = view.webContents.getURL()
        dbg(`view:set-bounds[${paneId}]: setBounds ${x},${y},${w}x${h} url=${currentUrl.slice(0,50)}`)
        const sizeChanged = prevBounds && (prevBounds.width !== w || prevBounds.height !== h)
        const hasPending = !!pane.pendingUrl
        if (sizeChanged && !hasPending && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(CAPTURE_SCROLL_JS).then(json => {
            if (view.webContents.isDestroyed()) return
            view.setBounds({ x, y, width: w, height: h })
            if (json && json !== '[0,0,[]]') {
              setTimeout(() => {
                if (!view.webContents.isDestroyed())
                  view.webContents.executeJavaScript(makeRestoreScrollJs(json)).catch(() => {})
              }, 120)
            }
          }).catch(() => {
            if (!view.webContents.isDestroyed()) view.setBounds({ x, y, width: w, height: h })
          })
        } else {
          view.setBounds({ x, y, width: w, height: h })
        }
        if (pane.pendingUrl) {
          const url = pane.pendingUrl
          pane.pendingUrl = null
          dbg(`view:set-bounds[${paneId}]: loadURL (pending) ${url.slice(0,60)}`)
          view.webContents.setAudioMuted(false)
          view.webContents.loadURL(url).catch(err => console.log(`[view:${paneId}] loadURL error:`, err?.message))
        }
      }
    } else {
      pane.lastBounds = null
      const v = pane.view
      if (v && !v.webContents.isDestroyed()) {
        dbg(`view:set-bounds[${paneId}]: ZERO-BOUND url=${v.webContents.getURL().slice(0,50)}`)
        try { v.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      }
    }
  })

  ipcMain.on('view:clear', (_e, paneId) => {
    const pane = viewPanes[paneId]
    if (!pane) return
    pane.pendingUrl = null
    pane.lastBounds = null
    const v = pane.view
    if (v && !v.webContents.isDestroyed()) {
      try { v.webContents.setAudioMuted(true) } catch {}
      try { v.webContents.stop() } catch {}
      try { v.setBounds({ x: 0, y: 0, width: 0, height: 0 }) } catch {}
      v.webContents.loadURL('about:blank').catch(() => {})
    }
  })

  ipcMain.on('view:reload', (_e, paneId) => {
    const pane = viewPanes[paneId]
    if (!pane?.view || pane.view.webContents.isDestroyed()) return
    pane.view.webContents.reload()
  })

  // ── modal state ────────────────────────────────────────────────────────────
  ipcMain.on('app:set-modal', (_e, isOpen) => {
    modalOpen = !!isOpen
    if (modalOpen) {
      hideAllViews()
    } else {
      restoreAllViews()
    }
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
    panel.activeTabId = null
    panel.lastBounds  = null
    panel.pendingUrl  = null
    if (panel.pendingTimer) { clearTimeout(panel.pendingTimer); panel.pendingTimer = null }

    for (const pid of Object.keys(viewPanes)) {
      const pane = viewPanes[pid]
      if (pane.view && !pane.view.webContents.isDestroyed()) {
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
