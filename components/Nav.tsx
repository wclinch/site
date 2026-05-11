'use client'
import Link from 'next/link'

export default function Nav() {
  return (
    <nav style={{
      padding: '0 24px', height: '44px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid #1a1a1a', flexShrink: 0,
    }}>
      <Link href="/app" style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="7" fill="#f0f0f0" opacity="0.1" />
          <text x="16" y="23" fontFamily="Georgia, serif" fontSize="22" fontWeight="400" fill="#f0f0f0" textAnchor="middle">{`{`}</text>
        </svg>
      </Link>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link href="/about"   className="nav-link">About</Link>
        <Link href="/privacy" className="nav-link">Privacy</Link>
      </div>
    </nav>
  )
}
