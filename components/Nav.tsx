'use client'
import Link from 'next/link'
import Image from 'next/image'

export default function Nav() {
  return (
    <nav style={{
      padding: '0 24px', height: '44px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid #1a1a1a', flexShrink: 0,
    }}>
      <Link href="/app" style={{ display: 'flex', alignItems: 'center' }}>
        <Image src="/icon.svg" alt="Site" width={24} height={24} />
      </Link>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link href="/about"   className="nav-link">About</Link>
        <Link href="/privacy" className="nav-link">Privacy</Link>
      </div>
    </nav>
  )
}
