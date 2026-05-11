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
    }}>
      <a href="/" aria-label="Site"
        style={{
          display: 'flex', alignItems: 'center',
          textDecoration: 'none', lineHeight: 1,
          opacity: 0.55, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="7" fill="#1a1a1a" />
          <text x="16" y="23" fontFamily="Georgia, serif" fontSize="22" fontWeight="400" fill="#e8e8e8" textAnchor="middle">{'{'}</text>
        </svg>
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <StorageBadge />
        <span style={{ width: '1px', height: '12px', background: '#222' }} />
        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {namedProjectCount} / 3 projects
        </span>
      </div>
    </div>
  )
}
