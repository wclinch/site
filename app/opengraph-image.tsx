import { ImageResponse } from 'next/og'

// Generated at build time (Node runtime). We previously used `runtime: 'edge'`
// but static export — used for the desktop Electron build — can't run edge
// route handlers. Node generation produces the same PNG with no functional
// difference for the marketing site.
export const dynamic     = 'force-static'
export const alt         = 'Site — Structured for thought.'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: '#080808',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '80px',
        fontFamily: 'monospace',
      }}
    >
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: '#1a1a1a', display: 'flex' }} />

      {/* Logo mark */}
      <div style={{ position: 'absolute', top: '72px', left: '80px', fontSize: '36px', color: '#333', display: 'flex' }}>
        {'{'}
      </div>

      {/* Main text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '72px', fontWeight: 300, color: '#ccc', letterSpacing: '-1px', display: 'flex', lineHeight: 1 }}>
          Site
        </div>
        <div style={{ fontSize: '28px', color: '#555', fontWeight: 300, display: 'flex', lineHeight: 1.4 }}>
          Structured for thought.
        </div>
        <div style={{ fontSize: '18px', color: '#333', display: 'flex', marginTop: '4px' }}>
          A source-native workspace. Local-first. No account.
        </div>
      </div>

      {/* Bottom line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: '#1a1a1a', display: 'flex' }} />
    </div>,
    size,
  )
}
