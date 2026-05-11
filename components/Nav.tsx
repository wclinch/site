'use client'
import Link from 'next/link'

export default function Nav() {
  return (
    // Dimensions kept identical to the in-app ProjectBar (44px tall,
    // 20px side padding, 22×22 logo) so the header looks like the same
    // piece of chrome across the marketing site and the workspace.
    <nav style={{
      padding: '0 20px', height: '44px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid #1a1a1a', flexShrink: 0,
    }}>
      <Link href="/app" aria-label="Site"
        style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <text x="16" y="26" fontFamily="Georgia, serif" fontSize="30" fontWeight="500" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
        </svg>
      </Link>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link href="/about"   className="nav-link">About</Link>
        <Link href="/privacy" className="nav-link">Privacy</Link>
        {/* mailto: link — opens the user's default mail client. No
            tracking, no contact form, no server. */}
        <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support"
           className="nav-link">Support</a>
      </div>
    </nav>
  )
}
