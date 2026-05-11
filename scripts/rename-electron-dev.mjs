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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLIST = join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Info.plist'
)
const DESIRED = 'Site'
const FIELDS  = ['CFBundleName', 'CFBundleDisplayName', 'CFBundleExecutable']
// CFBundleExecutable can't change without renaming the binary inside MacOS/,
// so we leave it alone and only patch the user-visible names.
const PATCH = ['CFBundleName', 'CFBundleDisplayName']

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

const current = read('CFBundleName')
if (current === DESIRED) {
  // Already patched — nothing to do.
  process.exit(0)
}

for (const key of PATCH) set(key, DESIRED)

// Touch the .app so Launch Services notices the change next time the
// process starts — otherwise macOS caches the old label.
execSync(`touch "${join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app')}"`)

console.log(`[rename-electron-dev] Patched dev Electron bundle name → ${DESIRED}`)
