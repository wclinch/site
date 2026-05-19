'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { getCheckoutUrl, getStoredCredentials } from '@/lib/auth'
type View = 'sign_in' | 'loading' | 'error' | 'signed_in'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, signIn, signOut, openBilling, refreshEntitlement } = useApp()

  const [view,          setView]          = useState<View>(user ? 'signed_in' : 'sign_in')
  const [email,         setEmail]         = useState('')
  const [key,           setKey]           = useState('')
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [armed,         setArmed]         = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(() => {
    try { return localStorage.getItem('proof-show-quick-open') !== 'false' } catch { return true }
  })

  useEffect(() => {
    if (user) {
      refreshEntitlement()
      return
    }
    const creds = getStoredCredentials()
    if (creds) {
      setView('loading')
      signIn(creds.email, creds.licenseKey).then(result => {
        if (result.ok) setView('signed_in')
        else { setEmail(creds.email); setKey(creds.licenseKey); setView('sign_in') }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (armed) setArmed(false); else onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, armed])

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
        result.error === 'invalid_key'    ? 'Subscription not found or inactive.' :
        result.error === 'email_mismatch' ? 'Email does not match this subscription.' :
        result.error === 'not_configured' ? 'Sign-in is not configured in this build.' :
                                            'Network unavailable. Try again when online.'
      setErrorMsg(msg)
      setView('error')
    }
  }

  function handleSignOut() {
    signOut()
    onClose()
  }

  const checkoutUrl = getCheckoutUrl(user?.email)

  return (
    <div
      onClick={() => { if (armed) setArmed(false); else onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '360px', maxWidth: 'calc(100vw - 48px)',
          background: '#111', border: '1px solid #222', borderRadius: '4px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          fontFamily: 'inherit',
        }}
      >

        {/* ── Sign-in view ── */}
        {(view === 'sign_in' || view === 'error') && (
          <>
            <div style={{ padding: '16px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: view === 'error' ? '#c44' : '#777', letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.15s' }}>
                  {view === 'error' ? 'Error' : 'Account'}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: view === 'error' ? '#aaa' : '#888', lineHeight: 1.7 }}>
                {view === 'error' && errorMsg
                  ? errorMsg
                  : 'Sign in with your email and subscription key.'}
              </div>
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            <div style={{ padding: '11px 18px' }}>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (view === 'error') { setErrorMsg(null); setView('sign_in') } }}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                placeholder="you@example.com"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '12px', color: '#ccc', fontFamily: 'inherit', letterSpacing: '0.02em',
                }}
              />
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            <div style={{ padding: '11px 18px' }}>
              <input
                type="text"
                value={key}
                onChange={e => { setKey(e.target.value); if (view === 'error') { setErrorMsg(null); setView('sign_in') } }}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '12px', color: '#ccc', fontFamily: 'monospace', letterSpacing: '0.06em',
                }}
              />
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <ModalButton onClick={onClose}>Cancel</ModalButton>
              <ModalButton onClick={handleSignIn} disabled={!email.trim() || !key.trim()} accent>
                Sign In
              </ModalButton>
            </div>
          </>
        )}

        {/* ── Loading ── */}
        {view === 'loading' && (
          <>
            <div style={{ padding: '16px 18px 14px' }}>
              <div style={{ fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Account
              </div>
              <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.7 }}>
                Checking account…
              </div>
            </div>
            <div style={{ height: '1px', background: '#1e1e1e' }} />
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end' }}>
              <ModalButton onClick={onClose} disabled>Cancel</ModalButton>
            </div>
          </>
        )}

        {/* ── Signed in ── */}
        {view === 'signed_in' && user && (
          <>
            {/* Header — only shows confirmation text when armed */}
            {armed && (
              <>
                <div style={{ padding: '16px 18px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#c44', letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.15s' }}>
                      Confirm
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {[1, 2].map(s => (
                        <div key={s} style={{
                          width: '16px', height: '2px', borderRadius: '1px',
                          background: s === 1 ? '#1e1e1e' : '#c44',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.7 }}>
                    You will be signed out on this device.
                  </div>
                </div>
                <div style={{ height: '1px', background: '#1e1e1e' }} />
              </>
            )}

            {/* Account header row — always visible when not armed */}
            {!armed && (
              <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Account
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{
                      width: '16px', height: '2px', borderRadius: '1px',
                      background: s === 1 ? '#3a3a3a' : '#1e1e1e',
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            <div style={{ padding: '12px 18px', fontSize: '11px', color: '#666', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Email</span>
              <span style={{ color: '#888', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            <div style={{ padding: '12px 18px', fontSize: '11px', color: '#666', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Plan</span>
              <span style={{ color: isPro ? '#5c9e6e' : '#666' }}>{isPro ? 'Pro' : 'Free'}</span>
            </div>

            {isPro && (
              <>
                <div style={{ height: '1px', background: '#1e1e1e' }} />
                <div style={{ padding: '12px 18px', fontSize: '11px', color: '#666', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Price</span>
                  <span style={{ color: '#555' }}>$8.99 / mo</span>
                </div>
                <div style={{ height: '1px', background: '#1e1e1e' }} />
                <ManageRow onClick={() => openBilling()} />
              </>
            )}

            {/* Settings */}
            <div style={{ height: '1px', background: '#1e1e1e' }} />
            <div style={{ padding: '14px 18px 12px' }}>
              <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Settings
              </div>
              <SettingToggle
                label="Show Quick Open"
                helper="Show shortcuts below the Web bar."
                value={showQuickOpen}
                onChange={val => {
                  try {
                    if (val) localStorage.removeItem('proof-show-quick-open')
                    else localStorage.setItem('proof-show-quick-open', 'false')
                  } catch {}
                  setShowQuickOpen(val)
                  window.dispatchEvent(new Event('proof:settings-changed'))
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ height: '1px', background: '#1e1e1e' }} />
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <ModalButton onClick={onClose} disabled={armed}>← Back</ModalButton>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isPro && !armed && (
                  <ModalButton
                    onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('proof:upgrade-needed')), 50) }}
                  >
                    Upgrade
                  </ModalButton>
                )}
                {armed ? (
                  <>
                    <ModalButton onClick={() => setArmed(false)}>Cancel</ModalButton>
                    <ModalButton onClick={handleSignOut} destructive>Confirm</ModalButton>
                  </>
                ) : (
                  <ModalButton onClick={() => setArmed(true)} destructive>Sign Out</ModalButton>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SettingToggle({ label, helper, value, onChange }: {
  label: string
  helper: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onChange(!value)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%',
        background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <div style={{
        flexShrink: 0, marginTop: '1px',
        width: '13px', height: '13px',
        border: `1px solid ${value ? '#444' : '#2a2a2a'}`,
        borderRadius: '2px',
        background: value ? '#1e1e1e' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        {value && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5,4 3,5.5 6.5,2" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: '12px', color: hov ? '#aaa' : '#777', letterSpacing: '0.02em', transition: 'color 0.15s' }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: '#444', letterSpacing: '0.02em', marginTop: '2px', lineHeight: 1.5 }}>
          {helper}
        </div>
      </div>
    </button>
  )
}

function ManageRow({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', width: '100%', padding: '12px 18px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '11px', color: hov ? '#999' : '#555', letterSpacing: '0.04em',
        fontFamily: 'inherit', textAlign: 'left',
        transition: 'color 0.15s',
      }}
    >
      Manage subscription →
    </button>
  )
}

function ModalButton({ children, onClick, disabled, destructive, accent }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  accent?: boolean
}) {
  const [hover, setHover] = useState(false)

  const idleBorder  = destructive ? '#2a1515' : accent ? '#2a2a2a' : '#252525'
  const hoverBorder = destructive ? '#3a1515' : accent ? '#444'    : '#333'
  const idleColor   = destructive ? '#c44'    : accent ? '#888'    : '#666'
  const hoverColor  = destructive ? '#e55'    : accent ? '#ddd'    : '#aaa'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#111',
        border: `1px solid ${hover && !disabled ? hoverBorder : idleBorder}`,
        borderRadius: '3px',
        padding: '7px 14px',
        fontSize: '11px', fontFamily: 'inherit',
        color: hover && !disabled ? hoverColor : idleColor,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        opacity: disabled && !destructive ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
