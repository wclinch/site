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

const { app, BrowserWindow, Menu, dialog, shell, protocol, net } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { pathToFileURL } = require('url')

const isDev = !app.isPackaged

// The static export lives next to main.cjs once packaged (electron-builder
// copies the project root). In dev (unpackaged) we resolve from the repo.
const OUT_DIR = path.join(__dirname, '..', 'out')

// Reserve `site://` before app-ready so it inherits standard-URL behaviour
// (relative paths, fetch support, secure context). Required by Electron.
protocol.registerSchemesAsPrivileged([
  { scheme: 'site', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Map an incoming pathname to a real file under `out/`. Tries the literal
// path first, then `<path>/index.html` (Next trailingSlash convention), then
// falls back to the root document so client-side routing handles unknowns.
function resolveStatic(pathname) {
  const clean = pathname.replace(/^\/+/, '').replace(/\?.*$/, '')

  // Exact file (e.g. `_next/static/...`, `pdf.worker.min.mjs`)
  const direct = path.join(OUT_DIR, clean)
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct

  // Directory route — Next emits `<route>/index.html`
  const withIndex = path.join(OUT_DIR, clean, 'index.html')
  if (fs.existsSync(withIndex)) return withIndex

  // Same path without trailing slash variations
  const trimmed = clean.replace(/\/$/, '')
  const trimmedHtml = path.join(OUT_DIR, `${trimmed}.html`)
  if (fs.existsSync(trimmedHtml)) return trimmedHtml

  // Fallback to the workspace entry — keeps a hard refresh on an unknown
  // route from showing a blank page.
  return path.join(OUT_DIR, 'app', 'index.html')
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/app')
  } else {
    // Boot directly into the workspace — the landing page is for the
    // marketing site, not the desktop product.
    mainWindow.loadURL('site://localhost/app/')
  }
}

// Native "Reset Site Data" — the bulletproof escape hatch. Runs at the
// Electron session layer, which clears IndexedDB, localStorage, cache, and
// service workers in one shot. The in-app HTML button can also do this,
// but the native path is guaranteed to work even if the renderer is wedged.
async function resetSiteData(browserWindow) {
  const choice = await dialog.showMessageBox(browserWindow ?? null, {
    type: 'warning',
    buttons: ['Cancel', 'Reset all data'],
    defaultId: 0,
    cancelId: 0,
    message: 'Reset all Site data?',
    detail: 'All files, projects, and drafts on this machine will be permanently removed. This action cannot be undone.',
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
    protocol.handle('site', (request) => {
      const url = new URL(request.url)
      const filePath = resolveStatic(url.pathname)
      return net.fetch(pathToFileURL(filePath).toString())
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
