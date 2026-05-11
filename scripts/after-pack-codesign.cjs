// electron-builder afterPack hook — ad-hoc signs the staged .app bundle
// after packaging but before DMG creation. We don't have an Apple Developer
// Program membership ($99/yr), so we can't ship a Developer-ID-signed
// binary. But a fully unsigned download triggers macOS's hard
// "Site is damaged and can't be opened" Gatekeeper block, which is much
// worse than the soft "can't be checked" warning — the former requires
// `xattr -cr` to bypass, the latter just a right-click → Open.
//
// `codesign --force --deep --sign -` produces an ad-hoc signature (the `-`
// identity). The binary then has *some* signature for macOS to validate,
// which downgrades the block to the soft warning on most macOS versions.
// Users still need to bypass Gatekeeper once on first launch — see
// release/README.txt for the xattr command — but Polar/Chrome downloads
// no longer flat-out refuse to open.
//
// Mac-only; Windows/Linux packages are left untouched.

const { spawnSync } = require('node:child_process')
const path  = require('node:path')

module.exports = async function (ctx) {
  if (ctx.electronPlatformName !== 'darwin') return
  const appName = ctx.packager.appInfo.productFilename
  const appPath = path.join(ctx.appOutDir, `${appName}.app`)
  console.log(`[after-pack] ad-hoc signing ${appPath}`)
  const r = spawnSync('codesign', [
    '--force', '--deep', '--sign', '-',
    appPath,
  ], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`codesign exited with ${r.status}`)
  // Sanity-check the signature actually applied; electron-builder will
  // continue happily even if codesign produced an unsigned binary.
  const verify = spawnSync('codesign', ['--verify', '--verbose=2', appPath], { stdio: 'inherit' })
  if (verify.status !== 0) throw new Error('codesign verify failed after ad-hoc sign')
}
