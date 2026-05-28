'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { getStorageUsage } from '@/lib/storage-limit'
import { getAskSiteUsageToday, DAILY_ASK_LIMIT } from '@/lib/askSiteRateLimit'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { limits, threads, allSources, viewTabs } = useApp()

  const [storageBytes, setStorageBytes] = useState<number | null>(null)

  const refreshStorage = useCallback(() => { getStorageUsage().then(setStorageBytes) }, [])
  useEffect(() => {
    refreshStorage()
    window.addEventListener('site-storage-changed', refreshStorage)
    const interval = setInterval(refreshStorage, 3000)
    return () => { window.removeEventListener('site-storage-changed', refreshStorage); clearInterval(interval) }
  }, [refreshStorage])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const docCount  = allSources.filter(s => s.fileType === 'pdf' || s.fileType === 'image').length
  const pageCount = allSources.filter(s => s.fileType === 'url').length
  const askUsed   = getAskSiteUsageToday()

  let storageStr = '', storagePct = 0, storageBarColor = 'rgba(230,226,216,0.25)', storageTextColor = 'rgba(230,226,216,0.65)'
  if (storageBytes !== null) {
    const limitBytes = limits.storageBytes
    storagePct = Math.min(1, storageBytes / limitBytes)
    const usedMb = storageBytes / (1024 * 1024)
    const limitMb = Math.round(limitBytes / (1024 * 1024))
    const usedStr = usedMb < 1 ? `${Math.round(storageBytes / 1024)} KB`
                  : usedMb < 10 ? `${usedMb.toFixed(1)} MB`
                  : `${Math.round(usedMb)} MB`
    const limitStr = limitMb >= 1024 ? `${Math.round(limitMb / 1024)} GB` : `${limitMb} MB`
    storageStr = `${usedStr} / ${limitStr}`
    if (storagePct >= 0.9) { storageBarColor = 'rgba(230,226,216,0.7)'; storageTextColor = 'rgba(230,226,216,0.7)' }
    else if (storagePct >= 0.5) { storageBarColor = 'rgba(230,226,216,0.55)'; storageTextColor = 'rgba(230,226,216,0.65)' }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: 'calc(100vw - 40px)',
          background: '#070807',
          border: '1px solid rgba(230,226,216,0.1)',
          borderRadius: '6px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
          fontFamily: 'inherit', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: '#E6E2D8', letterSpacing: '-0.01em' }}>Settings</div>
            <Lnk onClick={onClose}>Close</Lnk>
          </div>
        </div>

        <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>

          {/* Usage card */}
          <div style={{ background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ padding: '9px 16px 8px', borderBottom: '1px solid rgba(230,226,216,0.06)' }}>
              <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Usage</span>
            </div>

            {/* Storage row with bar */}
            <div style={{ padding: '9px 16px 8px', borderBottom: '1px solid rgba(230,226,216,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)' }}>Storage</span>
                <span style={{ fontSize: '12px', color: storageTextColor, fontVariantNumeric: 'tabular-nums' }}>
                  {storageBytes !== null ? storageStr : '—'}
                </span>
              </div>
              <div style={{ height: '1px', background: 'rgba(230,226,216,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(storageBytes !== null ? 1 : 0, storagePct * 100)}%`, background: storageBarColor, borderRadius: '1px', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <UsageRow label="Threads"  value={String(threads.length)} />
            <UsageRow label="Ask Site"  value={`${askUsed} / ${DAILY_ASK_LIMIT} today`} />
            <UsageRow label="Documents" value={String(docCount)} />
            <UsageRow label="Pages"     value={String(pageCount)} />
            <UsageRow label="View tabs" value={String(viewTabs.length)} last />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function UsageRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      padding: '8px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: last ? 'none' : '1px solid rgba(230,226,216,0.06)',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function Lnk({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: 0,
        fontSize: '13px', color: hov ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        letterSpacing: '0.02em', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.1s',
      }}>
      {children}
    </button>
  )
}
