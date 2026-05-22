'use client'
import dynamic           from 'next/dynamic'
import { AppProvider }   from '@/context/AppContext'
import ProjectBar        from '@/components/ProjectBar'
import SourcePanel       from '@/components/SourcePanel'
import RightPanel        from '@/components/RightPanel'
import SourceContextMenu from '@/components/SourceContextMenu'
import AccountModal      from '@/components/AccountModal'
import { useApp }        from '@/context/AppContext'
import { getCheckoutUrl } from '@/lib/auth'
import { useState, useEffect, useRef } from 'react'

// pdfjs-dist uses DOMMatrix at module init — must not run during SSR
const ReaderPanel = dynamic(() => import('@/components/ReaderPanel'), { ssr: false })

const DEF_SOURCE = '20%'


const PRO_FEATURES = [
  'Unlimited sessions',
  'Unlimited documents',
  '5 GB document storage',
]

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, signIn, refreshEntitlement } = useApp()
  const [email,      setEmail]      = useState('')
  const [key,        setKey]        = useState('')
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [checked,    setChecked]    = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const isProRef = useRef(isPro)
  useEffect(() => { isProRef.current = isPro }, [isPro])

  async function handleSignIn() {
    const trimmedEmail = email.trim()
    const trimmedKey   = key.trim()
    if (!trimmedEmail || !trimmedKey || busy) return
    setBusy(true); setError(null)
    const result = await signIn(trimmedEmail, trimmedKey)
    setBusy(false)
    if (result.ok) {
      if (result.isPro) { onClose(); return }
    } else {
      setError(
        result.error === 'invalid_key'    ? 'Subscription not found or inactive.' :
        result.error === 'email_mismatch' ? 'Email does not match this subscription.' :
        result.error === 'network_error'  ? 'Network unavailable. Try again when online.' :
        result.error === 'not_configured' ? 'Sign-in is not configured in this build.' :
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
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: 'calc(100vw - 48px)',
          background: '#171817', border: '1px solid #232523',
          borderRadius: '6px', boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          padding: '32px 28px 28px', fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: '11px', color: '#8A8780', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Upgrade to Pro
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '0 0 18px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#8A8780', margin: 0, letterSpacing: '-0.01em' }}>
            Unlock unlimited sessions.
          </h2>
          <span style={{ fontSize: '13px', color: '#8A8780', letterSpacing: '0.01em' }}>$8.99 / mo</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '26px' }}>
          {PRO_FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#8A8780' }}>—</span>
              <span style={{ fontSize: '13px', color: '#8A8780' }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', background: '#232523', marginBottom: '22px' }} />

        {/* Checkout button — always shown when not Pro */}
        {!isPro && (
          <button
            onClick={() => window.open(checkoutUrl || 'https://polar.sh', '_blank', 'noopener,noreferrer')}
            style={{
              background: '#171817', border: '1px solid #232523',
              color: '#8A8780', padding: '10px 20px',
              fontSize: '12px', fontFamily: 'inherit',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer', borderRadius: '3px',
              transition: 'color 0.15s, border-color 0.15s',
              display: 'block', width: '100%', textAlign: 'left',
              marginBottom: '20px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#8A8780'; e.currentTarget.style.color = '#8A8780' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#9b9892'; e.currentTarget.style.color = '#8A8780' }}
          >
            Upgrade to Pro →
          </button>
        )}

        {/* Already subscribed — sign in or check */}
        {!isPro && !user && !showSignIn && (
          <button
            onClick={() => setShowSignIn(true)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '12px', color: '#8A8780', fontFamily: 'inherit',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#8A8780')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8A8780')}
          >
            Already subscribed? Sign in →
          </button>
        )}

        {/* Sign-in form — shown after clicking "Already subscribed" or when signed in + not Pro */}
        {!isPro && (showSignIn || user) && (
          <>
            {!user && (
              <>
                <div style={{
                  background: '#171817', border: `1px solid ${error ? '#3a2520' : '#232523'}`,
                  borderRadius: '4px', padding: '11px 14px', marginBottom: '8px',
                }}>
                  <input
                    autoFocus type="email" value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                    placeholder="you@example.com"
                    spellCheck={false} autoCapitalize="off" autoCorrect="off"
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#8A8780', fontFamily: 'inherit', letterSpacing: '0.02em' }}
                  />
                </div>
                <div style={{
                  background: '#171817', border: `1px solid ${error ? '#3a2520' : '#232523'}`,
                  borderRadius: '4px', padding: '11px 14px', marginBottom: error ? '8px' : '12px',
                }}>
                  <input
                    type="text" value={key}
                    onChange={e => { setKey(e.target.value); if (error) setError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    spellCheck={false} autoCapitalize="off" autoCorrect="off"
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#8A8780', fontFamily: 'monospace', letterSpacing: '0.06em' }}
                  />
                </div>
                {error && <div style={{ fontSize: '11px', color: '#a55', margin: '0 0 12px' }}>{error}</div>}
                <button
                  onClick={handleSignIn} disabled={busy || !email.trim() || !key.trim()}
                  style={{
                    background: 'transparent', border: '1px solid #232523',
                    color: busy || !email.trim() || !key.trim() ? '#5a5a5a' : '#8A8780',
                    padding: '9px 18px', fontSize: '11px', fontFamily: 'inherit',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: busy || !email.trim() || !key.trim() ? 'not-allowed' : 'pointer',
                    borderRadius: '3px', transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!busy && email.trim() && key.trim()) { e.currentTarget.style.borderColor = '#8A8780'; e.currentTarget.style.color = '#8A8780' } }}
                  onMouseLeave={e => { if (!busy && email.trim() && key.trim()) { e.currentTarget.style.borderColor = '#9b9892'; e.currentTarget.style.color = '#8A8780' } }}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </>
            )}
            {user && (
              <>
                <button
                  onClick={handleRefresh} disabled={busy}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '12px', color: '#8A8780', fontFamily: 'inherit',
                    cursor: busy ? 'default' : 'pointer', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!busy) e.currentTarget.style.color = '#8A8780' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#8A8780' }}
                >
                  {busy ? 'Checking…' : 'Already subscribed? Check now'}
                </button>
                {checked && !isPro && (
                  <div style={{ fontSize: '11px', color: '#8A8780', marginTop: '10px' }}>
                    No active subscription found.
                  </div>
                )}
              </>
            )}
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '28px', background: 'none', border: 'none', padding: 0,
            fontSize: '11px', color: '#8A8780', letterSpacing: '0.06em',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            display: 'block',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#8A8780')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8A8780')}
        >← Back</button>
      </div>
    </div>
  )
}

type WorkspaceLayout = { researchFocused: boolean; viewFocused: boolean; soloPane: 1 | 2; sidebarCollapsed: boolean }
const DEFAULT_LAYOUT: WorkspaceLayout = { researchFocused: false, viewFocused: false, soloPane: 1, sidebarCollapsed: false }

function layoutKey(id: string) { return `proof-layout:${id}` }
function saveLayout(id: string, l: WorkspaceLayout) {
  try { localStorage.setItem(layoutKey(id), JSON.stringify(l)) } catch {}
}
function loadLayout(id: string): WorkspaceLayout {
  try {
    const raw = localStorage.getItem(layoutKey(id))
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_LAYOUT
}

function AppShell() {
  const { mounted, activeId } = useApp()
  const [researchFocused,  setResearchFocused]  = useState(false)
  const [viewFocused,      setViewFocused]      = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [soloPane, setSoloPane] = useState<1 | 2>(1)

  const layoutMapRef    = useRef<Record<string, WorkspaceLayout>>({})
  const prevActiveRef   = useRef<string | null>(null)
  const currentLayout   = useRef<WorkspaceLayout>(DEFAULT_LAYOUT)
  currentLayout.current = { researchFocused, viewFocused, soloPane, sidebarCollapsed }

  // Save current layout on page unload (covers hard reload)
  useEffect(() => {
    function onUnload() {
      if (activeId) saveLayout(activeId, currentLayout.current)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [activeId])

  // Save layout for outgoing workspace, restore for incoming
  useEffect(() => {
    const prev = prevActiveRef.current
    if (prev) {
      const layout = currentLayout.current
      layoutMapRef.current[prev] = layout
      saveLayout(prev, layout)
    }
    prevActiveRef.current = activeId ?? null
    if (activeId) {
      const saved = layoutMapRef.current[activeId] ?? loadLayout(activeId)
      layoutMapRef.current[activeId] = saved
      setResearchFocused(saved.researchFocused)
      setViewFocused(saved.viewFocused)
      setSoloPane(saved.soloPane)
      setSidebarCollapsed(saved.sidebarCollapsed ?? false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Restore whichever modal was open before hard reload
  useEffect(() => {
    try {
      const saved = localStorage.getItem('proof-modal-open')
      if (saved === 'account') { ;(window as any).electronAPI?.setModal?.(true); setShowAccount(true) }
      else if (saved === 'upgrade') { ;(window as any).electronAPI?.setModal?.(true); setShowUpgrade(true) }
    } catch {}
  }, [])

  useEffect(() => {
    function onUpgradeNeeded() {
      try { localStorage.setItem('proof-modal-open', 'upgrade') } catch {}
      ;(window as any).electronAPI?.setModal?.(true)
      setShowUpgrade(true)
    }
    function onShowAccount() {
      try { localStorage.setItem('proof-modal-open', 'account') } catch {}
      ;(window as any).electronAPI?.setModal?.(true)
      setShowAccount(true)
    }
    window.addEventListener('proof:upgrade-needed', onUpgradeNeeded as EventListener)
    window.addEventListener('proof:show-account',   onShowAccount   as EventListener)
    return () => {
      window.removeEventListener('proof:upgrade-needed', onUpgradeNeeded as EventListener)
      window.removeEventListener('proof:show-account',   onShowAccount   as EventListener)
    }
  }, [])

  // Hide native WebContentsViews on close — keep in sync when modals dismiss.
  useEffect(() => {
    if (!showUpgrade && !showAccount) {
      ;(window as any).electronAPI?.setModal?.(false)
    }
  }, [showUpgrade, showAccount])

  // Sidebar toggle via event (dispatched from ProjectBar button)
  useEffect(() => {
    const handler = () => setSidebarCollapsed(v => !v)
    window.addEventListener('proof:toggle-sidebar', handler)
    return () => window.removeEventListener('proof:toggle-sidebar', handler)
  }, [])

  // Poll resize events after layout changes so Electron WebContentsViews recapture bounds.
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      window.dispatchEvent(new Event('resize'))
      if (Date.now() - start > 500) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [researchFocused, viewFocused, sidebarCollapsed])

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080909' }}>
        <ProjectBar />
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080909', WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <ProjectBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 7px 7px 7px' }}>
          <SourcePanel width={DEF_SOURCE} hidden={viewFocused || sidebarCollapsed} />
          <ReaderPanel
            soloPane={soloPane} setSoloPane={setSoloPane}
            isFocused={viewFocused} onFocusToggle={() => setViewFocused(f => !f)}
            hidden={researchFocused}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RightPanel
              isFocused={researchFocused}
              onFocusToggle={() => {
                if (researchFocused) {
                  setResearchFocused(false)
                } else {
                  setViewFocused(false)
                  setResearchFocused(true)
                }
              }}
            />
          </div>
        </div>
        <SourceContextMenu />
      </div>
      {showUpgrade && <UpgradeModal onClose={() => { try { localStorage.removeItem('proof-modal-open') } catch {} setShowUpgrade(false) }} />}
      {showAccount && <AccountModal onClose={() => { try { localStorage.removeItem('proof-modal-open') } catch {} setShowAccount(false) }} />}
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
