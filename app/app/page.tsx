'use client'
import dynamic           from 'next/dynamic'
import { AppProvider }   from '@/context/AppContext'
import ProjectBar        from '@/components/ProjectBar'
import SourcePanel       from '@/components/SourcePanel'
import RightPanel        from '@/components/RightPanel'
import SourceContextMenu from '@/components/SourceContextMenu'
import AccountModal      from '@/components/AccountModal'
import HistoryModal      from '@/components/HistoryModal'
import { useApp }        from '@/context/AppContext'
import { getCheckoutUrl } from '@/lib/auth'
import { useState, useEffect, useRef } from 'react'

// pdfjs-dist uses DOMMatrix at module init — must not run during SSR
const ReaderPanel = dynamic(() => import('@/components/ReaderPanel'), { ssr: false })

const DEF_SOURCE  = '20%'
const DEF_BROWSER = '40%'

function StorageWarning() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      setMsg(detail)
      setTimeout(() => setMsg(null), 4000)
    }
    window.addEventListener('proof-storage-warning', handler)
    return () => window.removeEventListener('proof-storage-warning', handler)
  }, [])
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', top: '56px', left: '50%', transform: 'translateX(-50%)',
      background: '#0f0f0f', border: '1px solid #222', borderRadius: '4px',
      padding: '9px 16px', fontSize: '12px', color: '#aaa', letterSpacing: '0.04em',
      boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {msg}
    </div>
  )
}

const PRO_FEATURES = [
  'Unlimited workspaces',
  'Unlimited Documents',
  '5 GB uploaded Documents',
  'Unlimited Pages',
]

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, signIn, refreshEntitlement } = useApp()
  const [email,     setEmail]     = useState('')
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [checked,   setChecked]   = useState(false)
  const isProRef = useRef(isPro)
  useEffect(() => { isProRef.current = isPro }, [isPro])

  async function handleSignIn() {
    const trimmed = email.trim()
    if (!trimmed || busy) return
    setBusy(true); setError(null)
    const result = await signIn(trimmed)
    setBusy(false)
    if (result.ok) {
      if (result.isPro) { onClose(); return }
    } else {
      setError(
        result.error === 'no_account'      ? 'No account found for that email.' :
        result.error === 'network_error'   ? 'Network unavailable. Try again when online.' :
        result.error === 'not_configured'  ? 'Sign-in is not configured in this build.' :
                                             'Sign in failed. Try again.'
      )
    }
  }

  async function handleRefresh() {
    setBusy(true)
    await refreshEntitlement()
    setBusy(false)
    setChecked(true)
    if (isProRef.current) onClose()
  }

  const checkoutUrl = getCheckoutUrl(user?.email)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: 'calc(100vw - 48px)',
          background: '#080808', border: '1px solid #1e1e1e',
          borderRadius: '6px', boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          padding: '32px 28px 28px', fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Upgrade to Pro
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#bbb', margin: '0 0 18px', letterSpacing: '-0.01em' }}>
          Unlock unlimited workspaces.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '26px' }}>
          {PRO_FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#333' }}>—</span>
              <span style={{ fontSize: '13px', color: '#666' }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', background: '#111', marginBottom: '22px' }} />

        {/* Not signed in — show sign-in form */}
        {!user && (
          <>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.65, margin: '0 0 16px' }}>
              Sign in to subscribe.
            </p>
            <div style={{
              background: '#0d0d0d', border: `1px solid ${error ? '#3a1f1f' : '#1a1a1a'}`,
              borderRadius: '4px', padding: '11px 14px', marginBottom: error ? '8px' : '14px',
            }}>
              <input
                autoFocus type="email" value={email}
                onChange={e => { setEmail(e.target.value); if (error) setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                placeholder="you@example.com"
                spellCheck={false} autoCapitalize="off" autoCorrect="off"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#ccc', fontFamily: 'inherit', letterSpacing: '0.02em' }}
              />
            </div>
            {error && <div style={{ fontSize: '11px', color: '#a55', margin: '0 0 14px' }}>{error}</div>}
            <button
              onClick={handleSignIn} disabled={busy || !email.trim()}
              style={{
                background: 'transparent', border: '1px solid #2a2a2a',
                color: busy || !email.trim() ? '#555' : '#bbb',
                padding: '9px 18px', fontSize: '11px', fontFamily: 'inherit',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: busy || !email.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '3px', transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!busy && email.trim()) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee' } }}
              onMouseLeave={e => { if (!busy && email.trim()) { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#bbb' } }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}

        {/* Signed in, not Pro — show checkout */}
        {user && !isPro && (
          <>
            <button
              onClick={() => window.open(checkoutUrl || 'https://polar.sh', '_blank', 'noopener,noreferrer')}
              style={{
                background: '#141414', border: '1px solid #2a2a2a',
                color: '#bbb', padding: '10px 20px',
                fontSize: '12px', fontFamily: 'inherit',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: 'pointer', borderRadius: '3px',
                transition: 'color 0.15s, border-color 0.15s',
                display: 'block', marginBottom: '16px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#bbb' }}
            >
              Subscribe to Pro →
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleRefresh} disabled={busy}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '12px', color: '#555', fontFamily: 'inherit',
                  cursor: busy ? 'default' : 'pointer', transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.color = '#999' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
              >
                {busy ? 'Checking…' : 'Already subscribed? Check now'}
              </button>
            </div>
            {checked && !isPro && (
              <div style={{ fontSize: '11px', color: '#555', marginTop: '10px' }}>
                No active subscription found.
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '28px', background: 'none', border: 'none', padding: 0,
            fontSize: '11px', color: '#333', letterSpacing: '0.06em',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            display: 'block',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        >← Back</button>
      </div>
    </div>
  )
}

function AppShell() {
  const { mounted } = useApp()
  const [researchFocused, setResearchFocused] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    function onUpgradeNeeded() { setShowUpgrade(true) }
    function onShowAccount()   { setShowAccount(true) }
    function onShowHistory()   { setShowHistory(true) }
    window.addEventListener('proof:upgrade-needed', onUpgradeNeeded as EventListener)
    window.addEventListener('proof:show-account',   onShowAccount   as EventListener)
    window.addEventListener('proof:show-history',   onShowHistory   as EventListener)
    return () => {
      window.removeEventListener('proof:upgrade-needed', onUpgradeNeeded as EventListener)
      window.removeEventListener('proof:show-account',   onShowAccount   as EventListener)
      window.removeEventListener('proof:show-history',   onShowHistory   as EventListener)
    }
  }, [])

  // Hide native WebContentsViews behind modal overlays — they sit above DOM z-index.
  useEffect(() => {
    const isOpen = showUpgrade || showAccount || showHistory
    ;(window as any).electronAPI?.setModal?.(isOpen)
  }, [showUpgrade, showAccount, showHistory])

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808' }}>
        <ProjectBar />
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808', WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <ProjectBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingRight: '5px' }}>
          <SourcePanel width={DEF_SOURCE} />
          {!researchFocused && <ReaderPanel />}
          <div style={researchFocused
            ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : { width: DEF_BROWSER, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          }>
            <RightPanel isFocused={researchFocused} onFocusToggle={() => setResearchFocused(f => !f)} />
          </div>
        </div>
        <SourceContextMenu />
      </div>
      <StorageWarning />
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} />
    </>
  )
}

export default function AppPage() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
