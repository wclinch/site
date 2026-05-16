// Repackage electron-builder's raw per-arch zips into per-arch
// "ready-to-ship" zips containing the .app + installer .command +
// short README.
//
// electron-builder produces:
//   release/Site-0.1.0-arm64-mac.zip   (just Site.app inside)
//   release/Site-0.1.0-mac.zip         (just Site.app inside)
//
// We unzip each, drop our bundle files alongside the .app, re-zip
// to a versioned filename, and write SHA256 checksums for both.
//
// Intentionally minimal: no DMG, no nested folders, no Installers/
// subdirectory. When the buyer double-clicks the zip macOS expands it
// in place and they see exactly two things: Site.app,
// Read me first.txt.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, statSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT       = join(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE    = join(ROOT, 'release')
const BUNDLE_SRC = join(ROOT, 'scripts', 'mac-bundle')
const VERSION    = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

// Each entry is [electron-builder output filename, friendly output filename].
const TARGETS = [
  [`Site-${VERSION}-arm64-mac.zip`, `Site-v${VERSION}-mac-arm64.zip`],
  [`Site-${VERSION}-mac.zip`,       `Site-v${VERSION}-mac-intel.zip`],
]

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → exit ${r.status}`)
}

function sha256(file) {
  const hash = createHash('sha256')
  hash.update(readFileSync(file))
  return hash.digest('hex')
}

const shaLines = []

for (const [src, dst] of TARGETS) {
  const srcPath = join(RELEASE, src)
  const dstPath = join(RELEASE, dst)
  if (!existsSync(srcPath)) {
    console.error(`  missing: ${srcPath}`)
    console.error(`  run \`npm run electron:build:mac\` first`)
    process.exit(1)
  }

  // Stage everything in a scratch dir, then zip the dir's contents.
  const stage = mkdtempSync(join(tmpdir(), 'site-mac-'))
  console.log(`\n  ${dst} ←`)
  console.log(`    unpacking ${src}...`)
  run('ditto', ['-x', '-k', srcPath, stage])  // ditto preserves resource forks + xattrs

  console.log(`    adding readme...`)
  copyFileSync(join(BUNDLE_SRC, 'Read me first.txt'), join(stage, 'Read me first.txt'))
  // We used to also ship an `Install Site.command` helper here, but on
  // macOS 15 (Sequoia) Gatekeeper hard-blocks unsigned .command files
  // with the same "Move to Trash" dialog as .app files — so the script
  // can't actually run as a workaround. The README explains the two
  // Apple-supported paths past the dialog (System Settings or xattr).

  console.log(`    repacking → ${dst}...`)
  rmSync(dstPath, { force: true })
  // `ditto -c -k --sequesterRsrc` is what Apple recommends for
  // distributing .app bundles — preserves bundle structure, code
  // signature, and extended attributes through the zip. Without
  // --keepParent, the stage directory's contents land at the zip's
  // top level (Site.app, Install Site.command, Read me first.txt).
  run('ditto', ['-c', '-k', '--sequesterRsrc', stage, dstPath])

  // Clean up the scratch and the electron-builder original
  rmSync(stage, { recursive: true, force: true })
  rmSync(srcPath, { force: true })
  rmSync(`${srcPath}.blockmap`, { force: true })

  const size = (statSync(dstPath).size / (1024 * 1024)).toFixed(0)
  const hash = sha256(dstPath)
  console.log(`    ${size} MB · ${hash.slice(0, 16)}…`)
  shaLines.push(`${hash}  ${dst}`)
}

// Write a single checksums file at the release root so buyers (or you)
// can verify either download.
const shaFile = join(RELEASE, 'SHA256SUMS.txt')
writeFileSync(shaFile, shaLines.join('\n') + '\n')
console.log(`\n  wrote ${shaFile}`)
console.log(`\n  ready to upload to Polar.`)
