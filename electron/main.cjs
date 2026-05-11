// Electron main process for the Site desktop app.
//
// In dev mode we load `http://localhost:3000/app` from the live `next dev`
// server (full HMR). In packaged mode we serve the static export under
// `out/` via a custom `site://` protocol — `loadFile` alone doesn't handle
// Next's trailing-slash routing (e.g. `/about/` -> `/about/index.html`)
// or absolute asset paths the way HTTP does. The protocol bridges that gap.
//
// Why not full Next.js server in Electron? This app has no SSR/API routes
// after the local-only refactor (everything lives in IndexedDB), so the
// ~200ms static-load start beats a 2s Node-server boot for desktop UX.

const { app, BrowserWindow, Menu, dialog, shell, protocol, nativeImage } = require('electron')
const path  = require('path')
const fs    = require('fs')

// `app.isPackaged` flips to `true` in our dev setup because
// scripts/rename-electron-dev.mjs renames the Electron binary to "Site" to
// fix the Dock label — and Electron decides default-app vs packaged based
// on argv[0] being literally "Electron". Once renamed, defaultApp is
// undefined → isPackaged is true → dev would silently use the production
// `site://` protocol and 404 on every route. The npm dev script sets
// SITE_DEV=1 so we can detect dev reliably regardless of the rename.
const isDev = process.env.SITE_DEV === '1' || !app.isPackaged

// The static export lives next to main.cjs once packaged (electron-builder
// copies the project root). In dev (unpackaged) we resolve from the repo.
const OUT_DIR = path.join(__dirname, '..', 'out')

// In dev, electron-builder's `productName` and bundle icon aren't applied —
// the running process is just `Electron.app/Contents/MacOS/Electron`. Force
// the Dock label + icon ourselves so it matches the packaged build.
app.setName('Site')
if (process.platform === 'darwin' && isDev) {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(iconPath)) {
    try { app.dock.setIcon(nativeImage.createFromPath(iconPath)) } catch {}
  }
}

// Reserve `site://` before app-ready so it inherits standard-URL behaviour
// (relative paths, fetch support, secure context). Required by Electron.
protocol.registerSchemesAsPrivileged([
  { scheme: 'site', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Map an incoming pathname to a real file under `out/`. Tries the literal
// path first, then `<path>/index.html` (Next trailingSlash convention), then
// falls back to the root document so client-side routing handles unknowns.
//
// Anything that resolves outside OUT_DIR is rejected (returns null) — the
// caller then renders a 404. `path.join(OUT_DIR, '../../etc/passwd')` would
// otherwise escape the sandbox; even though only our own renderer can
// navigate site:// URLs today, defense-in-depth is cheap here.
function resolveStatic(pathname) {
  const clean = pathname.replace(/^\/+/, '').replace(/\?.*$/, '')

  // Reject any pathname that walks out of OUT_DIR. We resolve to absolute
  // and check the prefix — `path.resolve('out', '../../x')` collapses the
  // `..` segments so the final string is definitive.
  function safeUnder(p) {
    const abs = path.resolve(p)
    const root = path.resolve(OUT_DIR)
    return abs === root || abs.startsWith(root + path.sep) ? abs : null
  }

  // Exact file (e.g. `_next/static/...`, `pdf.worker.min.mjs`)
  const direct = safeUnder(path.join(OUT_DIR, clean))
  if (direct && fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct

  // Directory route — Next emits `<route>/index.html`
  const withIndex = safeUnder(path.join(OUT_DIR, clean, 'index.html'))
  if (withIndex && fs.existsSync(withIndex)) return withIndex

  // Same path without trailing slash variations
  const trimmed = clean.replace(/\/$/, '')
  const trimmedHtml = safeUnder(path.join(OUT_DIR, `${trimmed}.html`))
  if (trimmedHtml && fs.existsSync(trimmedHtml)) return trimmedHtml

  // Fallback to the workspace entry — keeps a hard refresh on an unknown
  // route from showing a blank page. Always under OUT_DIR by construction.
  return path.join(OUT_DIR, 'app', 'index.html')
}

// Map file extensions to MIME types. `net.fetch` on a file:// URL doesn't
// always set Content-Type correctly for every extension we ship — and when
// an HTML page comes back as `application/octet-stream`, Chromium renders
// the raw bytes as plain text (which is how the RSC flight payload ended
// up bleeding into the visible UI in earlier builds).
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
}

let mainWindow = null

function createWindow() {
  // Window icon (mostly relevant on Linux/Windows — macOS uses the Dock icon).
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  const icon = fs.existsSync(iconPath) ? iconPath : undefined

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    // Explicit even though `true` is the Electron default — keeps the
    // window resizable + maximizable. Dragging is wired separately via
    // `-webkit-app-region: drag` on the in-app ProjectBar so the user
    // can grab anywhere in the top strip to move the window.
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Site',
    icon,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Run the renderer in an OS-level sandbox. With contextIsolation +
      // no node integration this is belt-and-suspenders: even if a
      // renderer-side bug let an attacker run arbitrary JS, the process
      // can only touch what the OS sandbox permits — no fs, no exec.
      sandbox: true,
      // Default is true but make it explicit so a future edit can't
      // silently disable same-origin / mixed-content protections.
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  // Avoid the brief white flash before first paint.
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // External links open in the user's default browser, not a new Electron
  // window — matters because Site has zero server APIs to gate against.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Refuse top-level navigations to anywhere outside the dev server (in
  // dev) or the site:// protocol (in packaged). Without this, code or
  // an embedded page could window.location away to a phishing URL and
  // host it inside the Site chrome. The link is still openable in the
  // user's real browser via the system shell.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const ok = isDev
      ? url.startsWith('http://localhost:3000')
      : url.startsWith('site://')
    if (!ok) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/')
  } else {
    // Boot into the landing page — gives the app a real first surface
    // (branding, "Open App", About/Privacy/Support links) instead of
    // dropping a fresh user straight into an empty workspace. They
    // click "Open App →" to enter the workspace itself.
    mainWindow.loadURL('site://localhost/')
  }
}

// Native "Reset Site Data" — the bulletproof escape hatch. Runs at the
// Electron session layer, which clears IndexedDB, localStorage, cache, and
// service workers in one shot. The in-app HTML button can also do this,
// but the native path is guaranteed to work even if the renderer is wedged.
async function resetSiteData(browserWindow) {
  const choice = await dialog.showMessageBox(browserWindow ?? null, {
    type: 'warning',
    buttons: ['Cancel', 'Reset'],
    defaultId: 0,
    cancelId: 0,
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
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Reset Site Data…',
          click: (_item, win) => resetSiteData(win),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [{
          label: 'Reset Site Data…',
          click: (_item, win) => resetSiteData(win),
        }, { type: 'separator' }] : []),
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('site', async (request) => {
      const url = new URL(request.url)
      const filePath = resolveStatic(url.pathname)
      const ext = path.extname(filePath).toLowerCase()
      const mime = MIME[ext] || 'application/octet-stream'

      // Read the file ourselves and build a Response with an explicit
      // Content-Type. Going through `net.fetch(file://)` had a habit of
      // returning HTML as `application/octet-stream`, which made Chromium
      // dump the RSC flight payload into the page as visible text.
      //
      // We also send a Content-Security-Policy that only permits same-
      // protocol scripts/styles + the inline blobs Next emits for fonts
      // and CSS. `frame-src https:` is intentionally permissive because
      // the URL viewer embeds arbitrary user-chosen websites; we don't
      // restrict the user's own input. The site:// document itself is
      // still locked down — a malicious embedded page can't reach back
      // through the iframe to the parent.
      // Next.js's static export uses inline <script> tags to stream the
      // RSC flight payload that bootstraps React hydration. A strict
      // script-src that excludes 'unsafe-inline' kills hydration and
      // leaves the user staring at the empty shell (just the ProjectBar
      // renders — everything below it depends on the client-side React
      // mounting). 'unsafe-eval' is needed for the same reason: pdf.js
      // and some Next chunked-module code uses Function() for module
      // wrapping. We accept the trade-off because the renderer is
      // already sandboxed (contextIsolation + nodeIntegration:false +
      // sandbox:true) — CSP here is defense-in-depth, not the primary
      // boundary.
      const csp = [
        "default-src 'self' site:",
        "script-src 'self' site: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' site: 'unsafe-inline'",
        "img-src 'self' site: data: blob:",
        "font-src 'self' site: data:",
        "connect-src 'self' site: blob: data:",
        "worker-src 'self' site: blob:",
        "frame-src https:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
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
      } catch (err) {
        return new Response(`Not found: ${url.pathname}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })
  }

  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS convention is to keep the app running with no windows open.
  if (process.platform !== 'darwin') app.quit()
})
