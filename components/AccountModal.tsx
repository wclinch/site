'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { getCheckoutUrl } from '@/lib/auth'
type View = 'sign_in' | 'loading' | 'error' | 'signed_in'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, signIn, signOut, openBilling, refreshEntitlement } = useApp()

  const [view,       setView]       = useState<View>(user ? 'signed_in' : 'sign_in')
  const [email,      setEmail]      = useState('')
  const [key,        setKey]        = useState('')
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

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
    const trimmedEmail = email.trim()
    const trimmedKey   = key.trim()
    if (!trimmedEmail || !trimmedKey) return
    setView('loading')
    setErrorMsg(null)
    const result = await signIn(trimmedEmail, trimmedKey)
    if (result.ok) {
      setView('signed_in')
    } else {
      const msg =
        result.error === 'invalid_key'    ? 'License key not found or subscription inactive.' :
        result.error === 'email_mismatch' ? 'Email does not match the license key.' :
        result.error === 'not_configured' ? 'Sign-in is not configured in this build.' :
                                            'Network unavailable. Try again when online.'
      setErrorMsg(msg)
      setView('error')
    }
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
        {(view === 'sign_in' || view === 'error') && (
          <>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px' }}>
              Account
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#bbb', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Sign in
            </h2>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.65, margin: '0 0 24px' }}>
              Enter your account email and license key.
            </p>

            {view === 'error' && errorMsg && (
              <div style={{ fontSize: '11px', color: '#a55', margin: '0 0 16px', letterSpacing: '0.02em' }}>
                {errorMsg}
              </div>
            )}

            <InputField
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
              placeholder="you@example.com"
              style={{ marginBottom: '10px' }}
            />
            <InputField
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              style={{ marginBottom: '18px', fontFamily: 'monospace', letterSpacing: '0.06em' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <AccountBtn onClick={handleSignIn} disabled={!email.trim() || !key.trim()}>
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
            <h2 style={{ fontSize: '17px', fontWeight: 500, color: '#bbb', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              {user.email}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', color: isPro ? '#5c9e6e' : '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {isPro ? 'Pro' : 'Free'}
              </span>
              {isPro && (
                <>
                  <span style={{ fontSize: '11px', color: '#2a2a2a' }}>·</span>
                  <span style={{ fontSize: '11px', color: '#444', letterSpacing: '0.02em' }}>$8.99 / mo</span>
                  <span style={{ fontSize: '11px', color: '#2a2a2a' }}>·</span>
                  <button
                    onClick={() => openBilling()}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: '#444', fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                  >
                    Manage subscription →
                  </button>
                </>
              )}
            </div>

            <div style={{ height: '1px', background: '#111', marginBottom: '22px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!isPro && (
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

function InputField({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '4px',
      padding: '11px 14px', display: 'flex', alignItems: 'center', ...style,
    }}>
      <input
        {...props}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontSize: '12px', color: '#ccc', fontFamily: 'inherit', letterSpacing: '0.02em',
          width: '100%',
        }}
      />
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
