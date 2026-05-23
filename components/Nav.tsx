'use client'
import Link from 'next/link'

export default function Nav() {
  return (
    // Dimensions kept identical to the in-app ProjectBar (44px tall,
    // 20px side padding, 22×22 logo) so the header looks like the same
    // piece of chrome across the marketing site and the workspace.
    //
    // WebkitAppRegion: 'drag' makes the whole bar a window-drag handle in
    // the packaged Electron app (titleBarStyle: 'hiddenInset' otherwise
    // leaves only a tiny strip near the traffic lights). Interactive
    // children opt out below with 'no-drag'. The CSS property is ignored
    // in regular browsers so the marketing site on the web is unaffected.
    <nav style={{
      padding: '0 20px', height: '44px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid rgba(230,226,216,0.1)', flexShrink: 0,
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>
      <Link href="/" aria-label="Site"
        style={{
          display: 'flex', alignItems: 'center', lineHeight: 1,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#E6E2D8" textAnchor="middle">{'{'}</text>
        </svg>
      </Link>
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        <div style={{ width: '1px', height: '14px', background: '#151615', marginRight: '2px', flexShrink: 0 }} />
        <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support"
           className="nav-link">Support</a>
      </div>
    </nav>
  )
}
