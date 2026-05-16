const { app, BrowserWindow, Menu, dialog, shell, protocol, nativeImage, ipcMain, WebContentsView } = require('electron')
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
  try { win.contentView.removeChildView(view) } catch {}
  win.contentView.addChildView(view)
  if (panel.lastBounds) view.setBounds(panel.lastBounds)
  try { view.webContents.focus() } catch {}
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

  const wc        = view.webContents
  const defaultUA = wc.getUserAgent()
  const cleanUA   = defaultUA.replace(/\sElectron\/[^\s]+/i, '')
  if (cleanUA !== defaultUA) wc.setUserAgent(cleanUA)

  wc.on('will-navigate', (event, url) => {
    try {
      const { protocol: p } = new URL(url)
      if (p !== 'https:' && p !== 'http:') event.preventDefault()
    } catch { event.preventDefault() }
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
    if (id === panel.activeTabId)
      win.webContents.send('research:url-changed', pid, url, state.canGoBack, state.canGoForward)
  })
  wc.on('did-navigate-in-page', (_e, url) => {
    state.url = url; syncNav(); sendTabUpdated()
    if (id === panel.activeTabId)
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
      if (!(inFullscreenTransition || isMinimized)) showActiveView(win, pid)
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
  if (!(inFullscreenTransition || isMinimized)) showActiveView(win, pid)
  const state = panel.tabStates.get(id) || { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }

  // If this view was restored from a saved workspace but never loaded, load it now.
  const switchView = panel.tabViews.get(id)
  if (switchView && !switchView.webContents.isDestroyed() && state.url) {
    const loaded = switchView.webContents.getURL()
    if (!loaded || loaded === 'about:blank') {
      switchView.webContents.loadURL(state.url).catch(() => {})
    }
  }

  win.webContents.send('research:url-changed',     pid, state.url, state.canGoBack, state.canGoForward)
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

  win.on('will-enter-full-screen', () => { inFullscreenTransition = true })
  win.on('will-leave-full-screen', () => { inFullscreenTransition = true })
  win.on('enter-full-screen', () => {
    inFullscreenTransition = false
    win.webContents.send('research:recalc-bounds')
  })
  win.on('leave-full-screen', () => {
    inFullscreenTransition = false
    win.webContents.send('research:recalc-bounds')
  })
  win.on('minimize', () => { isMinimized = true })
  win.on('restore',  () => {
    isMinimized = false
    win.webContents.send('research:recalc-bounds')
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
    const [cw, ch] = win.getContentSize()
    const iW = rect.innerWidth  || cw
    const iH = rect.innerHeight || ch
    const sx = cw / iW, sy = ch / iH
    const x = Math.round(rect.x     * sx)
    const y = Math.round(rect.y     * sy)
    const w = Math.round(rect.width * sx)
    const h = Math.round(rect.height * sy)
    if ((inFullscreenTransition || isMinimized) && (w === 0 || h === 0)) return
    if (w > 0 && h > 0) {
      // Ignore spurious near-zero-x bounds that arrive during layout settling.
      // Research column can be dragged wide, so only filter clearly invalid
      // positions (< 10% of content width — less than SourcePanel's ~20%).
      if (x <= cw / 10) return
      panel.lastBounds = { x, y, width: w, height: h }
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view) view.setBounds({ x, y, width: w, height: h })
      tryFirePending(win, pid)
    } else {
      const view = panel.activeTabId && panel.tabViews.get(panel.activeTabId)
      if (view) view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
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

    win.contentView.removeChildView(view)
    try { if (!view.webContents.isDestroyed()) view.webContents.close?.() } catch {}
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
      try { win.contentView.removeChildView(view) } catch {}
      try { if (!view.webContents.isDestroyed()) view.webContents.close?.() } catch {}
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

  // ── cleanup ────────────────────────────────────────────────────────────────
  win.on('closed', () => {
    const channels = [
      'research:navigate', 'research:set-bounds',
      'research:go-back', 'research:go-forward', 'research:reload',
      'research:new-tab', 'research:close-tab', 'research:switch-tab',
      'research:load-workspace',
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

  buildMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
