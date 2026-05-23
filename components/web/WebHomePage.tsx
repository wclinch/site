'use client'
import { useImperativeHandle, useRef, useState, useEffect, forwardRef } from 'react'

export interface WebHomePageHandle { focus: () => void }

const STARTERS: [string, string][] = [
  ['google',    'Google'],
  ['chatgpt',   'ChatGPT'],
  ['wikipedia', 'Wikipedia'],
]

// ─── 3-D wireframe globe ──────────────────────────────────────────────────────

function SpinningGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    const SIZE = 77
    const dpr  = window.devicePixelRatio || 1
    canvas.width  = SIZE * dpr
    canvas.height = SIZE * dpr
    canvas.style.width  = SIZE + 'px'
    canvas.style.height = SIZE + 'px'
    canvas.style.userSelect = 'none'
    canvas.style.pointerEvents = 'none'
    ;(canvas.style as any).webkitUserDrag = 'none'
    ctx.scale(dpr, dpr)

    const R    = SIZE * 0.3
    const cx   = SIZE / 2
    const cy   = SIZE / 2
    const TILT = 23.5 * Math.PI / 180
    const SPEED = 0.00045             // radians per ms

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let start: number | null = null

    function project(phi: number, lam: number, theta: number) {
      const x0 = R * Math.cos(phi) * Math.cos(lam)
      const y0 = R * Math.sin(phi)
      const z0 = R * Math.cos(phi) * Math.sin(lam)
      // Y-axis spin
      const x1 =  x0 * Math.cos(theta) - z0 * Math.sin(theta)
      const z1 =  x0 * Math.sin(theta) + z0 * Math.cos(theta)
      // X-axis tilt
      const y2 = y0 * Math.cos(TILT) - z1 * Math.sin(TILT)
      const z2 = y0 * Math.sin(TILT) + z1 * Math.cos(TILT)
      return { sx: cx + x1, sy: cy - y2, vis: z2 > 0 }
    }

    function drawCurve(pts: Array<{ sx: number; sy: number; vis: boolean }>) {
      let open = false
      ctx.beginPath()
      for (const p of pts) {
        if (!p.vis) { open = false; continue }
        if (!open)  { ctx.moveTo(p.sx, p.sy); open = true }
        else          ctx.lineTo(p.sx, p.sy)
      }
      ctx.stroke()
    }

    function render(ts: number) {
      if (!start) start = ts
      const theta = reduced ? 0 : (ts - start) * SPEED

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.strokeStyle = 'rgba(230,226,216,0.65)'
      ctx.lineWidth   = 0.65

      const N = 64

      // Latitude rings
      for (const deg of [-60, -30, 0, 30, 60]) {
        const phi = deg * Math.PI / 180
        drawCurve(Array.from({ length: N + 1 }, (_, i) =>
          project(phi, (i / N) * Math.PI * 2, theta)
        ))
      }

      // Longitude meridians
      for (let i = 0; i < 8; i++) {
        const lam = (i / 8) * Math.PI * 2
        drawCurve(Array.from({ length: N + 1 }, (_, j) =>
          project((j / N) * Math.PI - Math.PI / 2, lam, theta)
        ))
      }

      // Silhouette circle
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return <canvas ref={canvasRef} draggable={false} style={{ display: 'block', pointerEvents: 'none', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const WebHomePage = forwardRef<WebHomePageHandle, { navigate: (raw: string) => void }>(
function WebHomePage({ navigate }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))
  const [query, setQuery] = useState('')

  function submit() {
    const q = query.trim()
    if (!q) return
    navigate(q)
    setQuery('')
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`.wb-search::placeholder { color: rgba(230,226,216,0.45); }`}</style>

      {/* Globe */}
      <div draggable={false} style={{ marginBottom: '22px', lineHeight: 0, pointerEvents: 'none', userSelect: 'none' }}>
        <SpinningGlobe />
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', width: '400px' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(230,226,216,0.65)', pointerEvents: 'none' }}>
          <circle cx="6" cy="6" r="4.5" />
          <line x1="9.5" y1="9.5" x2="13" y2="13" />
        </svg>
        <input
          ref={inputRef}
          className="wb-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Search or enter URL"
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%', height: '42px',
            background: '#151615', border: '1px solid rgba(230,226,216,0.1)',
            borderRadius: '6px', color: 'rgba(230,226,216,0.65)',
            fontSize: '13px', padding: '0 16px 0 36px',
            outline: 'none', fontFamily: 'inherit', letterSpacing: '0.01em',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(230,226,216,0.25)' }}
          onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(230,226,216,0.1)' }}
        />
      </div>

      {/* Starter chips */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {STARTERS.map(([key, label]) => (
          <StarterChip key={key} label={label} onClick={() => navigate(key)} />
        ))}
      </div>

      {/* Hint */}
      <span style={{ marginTop: '20px', fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.03em' }}>
        <span style={{ fontFamily: 'monospace', color: 'rgba(230,226,216,0.65)' }}>? query</span>
        {' '}→ Google
      </span>
    </div>
  )
})

export default WebHomePage

function StarterChip({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '28px', padding: '0 14px',
        background: hov ? '#151615' : '#070807',
        border: `1px solid ${hov ? 'rgba(230,226,216,0.65)' : '#151615'}`,
        borderRadius: '5px',
        color: hov ? 'rgba(230,226,216,0.65)' : 'rgba(230,226,216,0.65)',
        fontSize: '11px', letterSpacing: '0.03em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s, border-color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
