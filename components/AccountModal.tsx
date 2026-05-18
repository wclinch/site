'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { getCheckoutUrl } from '@/lib/auth'
type View = 'sign_in' | 'loading' | 'no_account' | 'signed_in'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, signIn, signOut, openBilling, refreshEntitlement } = useApp()

  const [view,       setView]       = useState<View>(user ? 'signed_in' : 'sign_in')
  const [email,      setEmail]      = useState('')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)

  // Refresh subscription status whenever the modal opens while signed in
  useEffect(() => {
    if (user) refreshEntitlement()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSignIn() {
    const trimmed = email.trim()
    if (!trimmed) return
    setView('loading')
    setErrorEmail(null)
    const result = await signIn(trimmed)
    if (result.ok) {
      setView('signed_in')
    } else if (result.error === 'no_account') {
      setErrorEmail(trimmed)
      setView('no_account')
    } else if (result.error === 'not_configured') {
      setView('no_account')
      setErrorEmail('__not_configured')
    } else {
      setView('no_account')
      setErrorEmail('__network')
    }
  }

  async function handleManageBilling() {
    setBillingBusy(true)
    await openBilling().catch(() => {})
    setBillingBusy(false)
  }

  function handleUpgrade() {
    const url = getCheckoutUrl(user?.email)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else window.open('https://polar.sh', '_blank', 'noopener,noreferrer')
  }

  function handleSignOut() {
    signOut()
    onClose()
  }

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
          width: '420px', maxWidth: 'calc(100vw - 48px)',
          background: '#080808',
          border: '1px solid #1e1e1e',
          borderRadius: '6px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          position: 'relative',
          padding: '36px 32px 32px',
          fontFamily: 'inherit',
        }}
      >

        {/* ── Sign in form ── */}
        {(view === 'sign_in' || view === 'no_account') && (
          <>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px' }}>
              Account
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#bbb', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Sign in
            </h2>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.65, margin: '0 0 24px' }}>
              Sign in with your account email.
            </p>

            {view === 'no_account' && errorEmail && errorEmail !== '__not_configured' && errorEmail !== '__network' && (
              <div style={{ fontSize: '11px', color: '#a55', margin: '0 0 16px', letterSpacing: '0.02em' }}>
                No account found for {errorEmail}. Check your email or upgrade to create one.
              </div>
            )}
            {view === 'no_account' && errorEmail === '__network' && (
              <div style={{ fontSize: '11px', color: '#a55', margin: '0 0 16px', letterSpacing: '0.02em' }}>
                Network unavailable. Try again when online.
              </div>
            )}
            {view === 'no_account' && errorEmail === '__not_configured' && (
              <div style={{ fontSize: '11px', color: '#555', margin: '0 0 16px', letterSpacing: '0.02em' }}>
                Account sign-in is not configured in this build.
              </div>
            )}

            <div style={{
              background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '4px',
              padding: '11px 14px', display: 'flex', alignItems: 'center', marginBottom: '18px',
            }}>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                placeholder="you@example.com"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '12px', color: '#ccc', fontFamily: 'inherit', letterSpacing: '0.02em',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <AccountBtn onClick={handleSignIn} disabled={!email.trim()}>
                Sign in
              </AccountBtn>
            </div>
          </>
        )}

        {/* ── Loading ── */}
        {view === 'loading' && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#555', letterSpacing: '0.04em' }}>Checking account…</p>
          </div>
        )}

        {/* ── Signed in ── */}
        {view === 'signed_in' && user && (
          <>
            <div style={{
              fontSize: '11px', color: isPro ? '#5c9e6e' : '#555',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px',
              transition: 'color 0.2s',
            }}>
              {isPro ? 'Pro' : 'Free'}
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#bbb', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              {user.email}
            </h2>

            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.65, margin: '0 0 28px' }}>
              {isPro
                ? 'Unlimited workspaces, unlimited Documents, 5 GB uploaded Documents, and Unlimited Pages.'
                : '1 workspace, 10 Documents, 150 MB uploaded Documents, and Unlimited Pages.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {isPro ? (
                <AccountBtn onClick={handleManageBilling} disabled={billingBusy}>
                  {billingBusy ? 'Opening…' : 'Manage billing'}
                </AccountBtn>
              ) : (
                <AccountBtn onClick={() => { onClose(); ;(window as any).electronAPI?.setModal?.(true); setTimeout(() => window.dispatchEvent(new Event('proof:upgrade-needed')), 50) }}>
                  Upgrade to Pro
                </AccountBtn>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '12px', color: '#444', letterSpacing: '0.02em',
                  fontFamily: 'inherit', transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#777')}
                onMouseLeave={e => (e.currentTarget.style.color = '#444')}
              >
                Sign out
              </button>
            </div>
          </>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: '28px', background: 'none', border: 'none', padding: 0,
            fontSize: '11px', color: '#444', letterSpacing: '0.06em',
            cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >← Back</button>
      </div>
    </div>
  )
}

function AccountBtn({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'transparent',
        border: `1px solid ${hov && !disabled ? '#333' : '#252525'}`,
        color: disabled ? '#444' : hov ? '#ddd' : '#888',
        padding: '8px 16px', fontSize: '11px', fontFamily: 'inherit',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '3px', outline: 'none',
        transition: 'color 0.15s, border-color 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
