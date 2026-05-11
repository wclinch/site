// Patch node_modules/electron's Info.plist so the Dock shows "Site"
// instead of "Electron" during `npm run electron:dev`.
//
// Why: macOS reads `CFBundleName` from the running .app bundle's
// Info.plist to label the Dock icon. `app.setName('Site')` from
// inside the renderer doesn't override that — it only affects
// Electron's internal `app.getName()`. In packaged builds the issue
// disappears because electron-builder rewrites the plist with
// `productName: "Site"`. This script does the same one-time patch
// for the dev binary so the dev experience matches the packaged app.
//
// Idempotent: if the plist already says "Site", we no-op.

import { execSync } from 'node:child_process'
import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname    = dirname(fileURLToPath(import.meta.url))
const ELECTRON_PKG = join(__dirname, '..', 'node_modules', 'electron')
const APP_ROOT     = join(ELECTRON_PKG, 'dist', 'Electron.app')
const PLIST        = join(APP_ROOT, 'Contents', 'Info.plist')
const MACOS        = join(APP_ROOT, 'Contents', 'MacOS')
const PATH_FILE    = join(ELECTRON_PKG, 'path.txt')
const DESIRED      = 'Site'

if (!existsSync(PLIST)) {
  // Not on macOS or electron isn't installed yet — skip silently.
  process.exit(0)
}

function read(key) {
  try {
    return execSync(`/usr/libexec/PlistBuddy -c "Print :${key}" "${PLIST}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    return null
  }
}

function set(key, value) {
  const existing = read(key)
  const cmd = existing === null
    ? `Add :${key} string ${value}`
    : `Set :${key} ${value}`
  execSync(`/usr/libexec/PlistBuddy -c "${cmd}" "${PLIST}"`, { stdio: 'ignore' })
}

// Each step below is idempotent so the script is safe to run on every
// `npm run electron:dev` — re-running just re-asserts the desired state.

// The Dock label on macOS comes from CFBundleName, but if the process is
// already running, the dock falls back to the executable name baked into
// Mach-O metadata. So we patch both the plist and the binary name.
for (const key of ['CFBundleName', 'CFBundleDisplayName', 'CFBundleExecutable']) {
  if (read(key) !== DESIRED) set(key, DESIRED)
}

const oldBin = join(MACOS, 'Electron')
const newBin = join(MACOS, DESIRED)
if (existsSync(oldBin) && !existsSync(newBin)) {
  renameSync(oldBin, newBin)
}

// `node_modules/electron/path.txt` is what the `electron` npm CLI reads
// to locate the binary. Rewrite so `electron .` resolves to the new name.
writeFileSync(PATH_FILE, `Electron.app/Contents/MacOS/${DESIRED}`)

// Touch the .app so Launch Services notices the change.
execSync(`touch "${APP_ROOT}"`)

// Force-refresh the Launch Services database. Without this macOS keeps
// showing the cached "Electron" label even after the plist is correct.
try {
  execSync(
    `/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "${APP_ROOT}"`,
    { stdio: 'ignore' }
  )
} catch {}

console.log(`[rename-electron-dev] Patched dev Electron bundle → ${DESIRED} (plist + binary)`)
