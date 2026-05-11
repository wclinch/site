// Generates desktop app icons from the canonical `{` brace logo.
//
// Output:
//   build/icon.iconset/icon_<size>.png  — Apple iconset (Retina @2x pairs)
//   build/icon.icns                     — macOS bundle icon (via iconutil)
//   build/icon.png                      — 1024² master PNG; electron-builder
//                                         auto-derives Windows .ico and Linux
//                                         PNGs from this.
//
// Run via `npm run build:icon` (also fires as part of `build:desktop`).
//
// We render from an inline high-res SVG so the source-of-truth lives here
// instead of being coupled to the favicon at app/icon.svg (which is sized
// for a 32px viewport). The two should look identical — same glyph, same
// palette — but each is tuned for its target resolution.

import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT     = path.resolve(import.meta.dirname, '..')
const BUILD    = path.join(ROOT, 'build')
const ICONSET  = path.join(BUILD, 'icon.iconset')

// 1024-px master, sized to match macOS's icon-grid convention (since Big Sur):
//   - 100px transparent margin on every side, so the dark body is 824×824
//     centered. Without this the icon appears ~15% larger than every other
//     app in the Dock because system icons all sit inside this margin.
//   - rx ≈ 22% of body side (180/824) matches the macOS rounded-square mask.
//   - Glyph y/font sized so the `{` sits visually centered within the body
//     rectangle, not the full canvas — Georgia's brace baseline runs low.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="180" fill="#0a0a0a"/>
  <text x="512" y="695" font-family="Georgia, 'Times New Roman', serif"
        font-size="580" font-weight="400" fill="#f0f0f0"
        text-anchor="middle">{</text>
</svg>`

// Apple's required iconset sizes. Each non-@2x has a @2x sibling at 2× the
// physical pixels — iconutil expects this exact naming.
const ICONSET_SIZES = [
  { px: 16,   name: 'icon_16x16.png' },
  { px: 32,   name: 'icon_16x16@2x.png' },
  { px: 32,   name: 'icon_32x32.png' },
  { px: 64,   name: 'icon_32x32@2x.png' },
  { px: 128,  name: 'icon_128x128.png' },
  { px: 256,  name: 'icon_128x128@2x.png' },
  { px: 256,  name: 'icon_256x256.png' },
  { px: 512,  name: 'icon_256x256@2x.png' },
  { px: 512,  name: 'icon_512x512.png' },
  { px: 1024, name: 'icon_512x512@2x.png' },
]

await fs.rm(BUILD, { recursive: true, force: true })
await fs.mkdir(ICONSET, { recursive: true })

const svgBuf = Buffer.from(SVG)

await Promise.all(
  ICONSET_SIZES.map(({ px, name }) =>
    sharp(svgBuf, { density: 384 })           // density bumps SVG rasterisation
      .resize(px, px, { fit: 'cover' })       // resolution so the glyph stays crisp
      .png({ compressionLevel: 9 })
      .toFile(path.join(ICONSET, name))
  )
)

// Master PNG (electron-builder uses this for win/linux when no .ico/.png set).
await sharp(svgBuf, { density: 384 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9 })
  .toFile(path.join(BUILD, 'icon.png'))

// macOS-native iconset → icns. iconutil is built in on every Mac.
const r = spawnSync(
  'iconutil',
  ['-c', 'icns', '-o', path.join(BUILD, 'icon.icns'), ICONSET],
  { stdio: 'inherit' }
)
if (r.status !== 0) {
  console.error('iconutil failed — is this running on macOS?')
  process.exit(1)
}

console.log('Generated build/icon.icns (macOS) and build/icon.png (master)')
