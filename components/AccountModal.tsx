'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import { getStoredCredentials } from '@/lib/auth'
import { getStorageUsage } from '@/lib/storage-limit'

type View = 'sign_in' | 'loading' | 'error' | 'signed_in'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, isPro, limits, signIn, signOut, openBilling, refreshEntitlement } = useApp()

  const [view,         setView]         = useState<View>(user ? 'signed_in' : 'sign_in')
  const [email,        setEmail]        = useState('')
  const [key,          setKey]          = useState('')
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [armed,        setArmed]        = useState(false)
  const [deleteArmed,  setDeleteArmed]  = useState(false)
  const [storageBytes, setStorageBytes] = useState<number | null>(null)
  const armedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshStorage = useCallback(() => { getStorageUsage().then(setStorageBytes) }, [])
  useEffect(() => {
    refreshStorage()
    window.addEventListener('proof-storage-changed', refreshStorage)
    return () => window.removeEventListener('proof-storage-changed', refreshStorage)
  }, [refreshStorage])

  useEffect(() => {
    if (user) { refreshEntitlement(); return }
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
      if (e.key === 'Escape') {
        if (deleteArmed) { setDeleteArmed(false); return }
        if (armed) { setArmed(false); return }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, armed, deleteArmed])

  async function handleSignIn() {
    const e = email.trim(), k = key.trim()
    if (!e || !k) return
    setView('loading'); setErrorMsg(null)
    const result = await signIn(e, k)
    if (result.ok) {
      setView('signed_in')
    } else {
      setErrorMsg(
        result.error === 'invalid_key'    ? 'License key not found or inactive.' :
        result.error === 'email_mismatch' ? 'Email doesn\'t match this license.' :
        result.error === 'not_configured' ? 'Sign-in is not available in this build.' :
                                            'No connection. Try again when online.'
      )
      setView('error')
    }
  }

  function handleSignOut() { signOut(); onClose() }

  function armDelete() {
    setDeleteArmed(true)
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = setTimeout(() => setDeleteArmed(false), 2500)
  }
  function armSignOut() {
    setArmed(true)
    if (armedTimerRef.current) clearTimeout(armedTimerRef.current)
    armedTimerRef.current = setTimeout(() => setArmed(false), 2500)
  }
  function confirmDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    setDeleteArmed(false)
    if (deleteMailto) window.location.href = deleteMailto
  }
  function confirmSignOut() {
    if (armedTimerRef.current) clearTimeout(armedTimerRef.current)
    handleSignOut()
  }

  // Storage
  let storageStr = '', storagePct = 0, storageBarColor = '#151615', storageTextColor = 'rgba(230,226,216,0.65)'
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
    else if (storagePct >= 0.5) { storageBarColor = 'rgba(230,226,216,0.65)'; storageTextColor = 'rgba(230,226,216,0.65)' }
  }

  const deleteMailto = user
    ? `mailto:Official_Site_Support@protonmail.com?subject=${encodeURIComponent('Delete my Site account')}&body=${encodeURIComponent(`Please delete my Site account.\n\nEmail: ${user.email}`)}`
    : ''

  return (
    <div
      onClick={() => {
        if (deleteArmed) { setDeleteArmed(false); return }
        if (armed) { setArmed(false); return }
        onClose()
      }}
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

        {/* ── Sign-in / Error ── */}
        {(view === 'sign_in' || view === 'error') && (
          <>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#E6E2D8', letterSpacing: '-0.01em' }}>Account</div>
                  <div style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', marginTop: '3px' }}>Sign in with your email and license key.</div>
                </div>
                <Lnk onClick={onClose}>Close</Lnk>
              </div>
              {view === 'error' && errorMsg && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '4px', fontSize: '12px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.6 }}>
                  {errorMsg}
                </div>
              )}
            </div>
            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Field autoFocus type="email" value={email} placeholder="Email"
                onChange={e => { setEmail(e.target.value); if (view === 'error') { setErrorMsg(null); setView('sign_in') } }}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }} />
              <Field type="text" value={key} placeholder="XXXX-XXXX-XXXX-XXXX" mono
                onChange={e => { setKey(e.target.value); if (view === 'error') { setErrorMsg(null); setView('sign_in') } }}
                onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }} />
            </div>
            <div style={{ padding: '0 28px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryBtn onClick={handleSignIn} disabled={!email.trim() || !key.trim()}>Sign in →</PrimaryBtn>
            </div>
          </>
        )}

        {/* ── Loading ── */}
        {view === 'loading' && (
          <>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#E6E2D8', letterSpacing: '-0.01em' }}>Account</div>
                <Lnk onClick={onClose} disabled>Close</Lnk>
              </div>
            </div>
            <div style={{ padding: '24px 28px 48px', fontSize: '12px', color: 'rgba(230,226,216,0.65)' }}>Verifying…</div>
          </>
        )}

        {/* ── Signed in ── */}
        {view === 'signed_in' && user && (
          <>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#E6E2D8', letterSpacing: '-0.01em' }}>Account</div>
                  <div style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', marginTop: '3px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                </div>
                <Lnk onClick={onClose}>Close</Lnk>
              </div>
            </div>

            <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Plan card */}
              <div style={{ background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                {/* Plan row */}
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: storageStr ? '1px solid rgba(230,226,216,0.1)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#E6E2D8' }}>{isPro ? 'Pro' : 'Free'}</span>
                    {isPro && (
                      <span style={{ fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.05em' }}>Active</span>
                    )}
                  </div>
                  {isPro && <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)' }}>$4.99 / mo</span>}
                  {!isPro && (
                    <button
                      onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('proof:upgrade-needed')), 50) }}
                      style={{ fontSize: '11px', color: 'rgba(230,226,216,0.65)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', letterSpacing: '0.02em', fontFamily: 'inherit', transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#E6E2D8')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.65)')}
                    >
                      Upgrade →
                    </button>
                  )}
                </div>

                {/* Storage */}
                {storageStr && (
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: isPro ? '1px solid rgba(230,226,216,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.65)' }}>Storage</span>
                      <span style={{ fontSize: '11px', color: storageTextColor }}>{storageStr}</span>
                    </div>
                    <div style={{ height: '1px', background: '#151615', borderRadius: '1px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(1, storagePct * 100)}%`, background: storageBarColor, borderRadius: '1px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )}

                {/* Manage billing */}
                {isPro && (
                  <button
                    onClick={() => openBilling()}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '12px 16px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#151615')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.01em' }}>Manage billing</span>
                    <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.65)' }}>→</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div style={{ background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                <DangerRow
                  label="Sign out"
                  armed={armed}
                  onArm={armSignOut}
                  onConfirm={confirmSignOut}
                  borderBottom
                />
                <DangerRow
                  label="Delete account"
                  armed={deleteArmed}
                  onArm={armDelete}
                  onConfirm={confirmDelete}
                />
              </div>
            </div>
          </>
        )}
        {/* ── Footer: link to landing ── */}
        <div style={{ padding: '12px 28px', borderTop: '1px solid rgba(230,226,216,0.1)', display: 'flex', justifyContent: 'center' }}>
          <a
            href="/"
            style={{ fontSize: '11px', color: 'rgba(230,226,216,0.45)', textDecoration: 'none', letterSpacing: '0.03em', transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.45)')}
          >
            site.app
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────




function Field({ autoFocus, type, value, placeholder, mono, onChange, onKeyDown }: {
  autoFocus?: boolean; type: string; value: string; placeholder: string; mono?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div
      style={{ background: '#151615', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '5px', padding: '10px 14px', transition: 'border-color 0.15s' }}
      onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(230,226,216,0.65)' }}
      onBlurCapture={e  => { (e.currentTarget as HTMLDivElement).style.borderColor = '#151615' }}
    >
      <input
        autoFocus={autoFocus} type={type} value={value} placeholder={placeholder}
        onChange={onChange} onKeyDown={onKeyDown}
        spellCheck={false} autoCapitalize="off" autoCorrect="off"
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          fontSize: '13px', color: 'rgba(230,226,216,0.65)',
          fontFamily: mono ? 'ui-monospace, "SF Mono", monospace' : 'inherit',
          letterSpacing: mono ? '0.06em' : '0.01em',
        }}
      />
    </div>
  )
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 18px',
        background: 'none',
        border: `1px solid ${disabled ? '#151615' : hov ? 'rgba(230,226,216,0.65)' : '#151615'}`,
        borderRadius: '4px', color: disabled ? 'rgba(230,226,216,0.45)' : '#E6E2D8',
        fontSize: '12px', letterSpacing: '0.03em', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'border-color 0.12s, color 0.12s',
      }}>
      {children}
    </button>
  )
}

function DangerRow({ label, armed, onArm, onConfirm, borderBottom }: {
  label: string; armed: boolean; onArm: () => void; onConfirm: () => void; borderBottom?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={armed ? onConfirm : onArm}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '12px 16px',
        background: hov ? '#151615' : 'none',
        border: 'none', borderBottom: borderBottom ? '1px solid rgba(230,226,216,0.1)' : 'none',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'background 0.12s',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', opacity: armed ? 0.45 : 1, textDecoration: armed ? 'line-through' : 'none', transition: 'opacity 0.15s' }}>{label}</span>
      <span style={{ fontSize: '11px', color: armed ? '#E6E2D8' : 'rgba(230,226,216,0.65)', transition: 'color 0.12s' }}>
        {armed ? 'Confirm?' : '→'}
      </span>
    </button>
  )
}

function Lnk({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: 0,
        fontSize: '12px', color: disabled ? 'rgba(230,226,216,0.45)' : hov ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        letterSpacing: '0.02em', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'color 0.1s',
      }}>
      {children}
    </button>
  )
}
