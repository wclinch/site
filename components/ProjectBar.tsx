'use client'
import { useApp } from '@/context/AppContext'
import StorageBadge from './StorageBadge'

export default function ProjectBar() {
  const { namedProjectCount } = useApp()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '44px', flexShrink: 0,
      borderBottom: '1px solid #1a1a1a',
      // Whole bar is a drag handle so the user can grab anywhere in it
      // to move the window. Interactive children below opt out via
      // WebkitAppRegion: 'no-drag'. The macOS traffic lights are an OS
      // overlay (titleBarStyle: 'hiddenInset') and aren't affected by
      // this CSS — they keep working over top of the drag region.
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>
      <a href="/" aria-label="Site"
        style={{
          display: 'flex', alignItems: 'center',
          textDecoration: 'none', lineHeight: 1,
          opacity: 0.85, transition: 'opacity 0.15s',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
      >
        {/* No background plate — the bare `{` is the mark. Bumped weight +
            slightly larger glyph so it reads as a logo on its own rather
            than as a stray punctuation character. */}
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
        </svg>
      </a>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <StorageBadge />
        <span style={{ width: '1px', height: '12px', background: '#222' }} />
        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {namedProjectCount} / 3 projects
        </span>
        <span style={{ width: '1px', height: '12px', background: '#222' }} />
        {/* Quiet support hook. mailto: opens the user's default mail
            client — no tracking, no contact form, no server. Same
            target as the Nav/footer/About support links so anyone who
            needs help finds the same inbox regardless of entry point. */}
        <a
          href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support"
          title="Email support"
          style={{
            fontSize: '11px', color: '#555', letterSpacing: '0.04em',
            textDecoration: 'none', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >
          Support
        </a>
      </div>
    </div>
  )
}
