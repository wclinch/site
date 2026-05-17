'use client'
import { useState } from 'react'
import { validateLicense } from '@/lib/license'
import { getCheckoutUrl } from '@/lib/auth'

type View = 'buy' | 'activate'

export default function LicenseGate({ onActivated, onClose }: {
  onActivated: () => void
  onClose?: () => void
}) {
  const [view, setView]   = useState<View>('buy')
  const [key, setKey]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkoutUrl = getCheckoutUrl()

  function openCheckout() {
    const url = checkoutUrl || 'https://polar.sh'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await validateLicense(key)
    setBusy(false)
    if (r.ok) { onActivated(); return }
    setError(r.reason)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#080808', fontFamily: 'inherit',
      padding: '32px 28px 24px',
    }}>

      {/* Eyebrow */}
      <div style={{
        fontSize: '11px', color: '#555',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: '20px',
      }}>
        {view === 'buy' ? 'Upgrade to Pro' : 'Activate Pro'}
      </div>

      {view === 'buy' ? (
        <>
          <h2 style={{
            fontSize: '18px', fontWeight: 500, color: '#bbb',
            lineHeight: 1.3, letterSpacing: '-0.01em',
            margin: '0 0 18px',
          }}>
            Get unlimited storage and workspaces.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '28px' }}>
            {[
              '5 GB document storage',
              'Unlimited workspaces',
              'Unlimited documents',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#444' }}>—</span>
                <span style={{ fontSize: '13px', color: '#777' }}>{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={openCheckout}
            style={{
              alignSelf: 'flex-start',
              background: '#141414', border: '1px solid #2a2a2a',
              color: '#bbb', padding: '10px 20px',
              fontSize: '12px', fontFamily: 'inherit',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer', borderRadius: '3px',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: '20px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#bbb' }}
          >
            Get Pro →
          </button>

          <div style={{ height: '1px', background: '#111', marginBottom: '20px' }} />

          <button
            onClick={() => setView('activate')}
            style={{
              alignSelf: 'flex-start',
              background: 'none', border: 'none', padding: 0,
              fontSize: '12px', color: '#555', letterSpacing: '0.02em',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            Already purchased? Enter your key →
          </button>
        </>
      ) : (
        <>
          <h2 style={{
            fontSize: '18px', fontWeight: 500, color: '#bbb',
            lineHeight: 1.3, letterSpacing: '-0.01em',
            margin: '0 0 10px',
          }}>
            Enter your license key
          </h2>

          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.7, margin: '0 0 22px' }}>
            Check your purchase confirmation email for the license key.
          </p>

          <div style={{
            background: '#0d0d0d', border: `1px solid ${error ? '#3a1f1f' : '#1a1a1a'}`,
            borderRadius: '4px', padding: '11px 14px',
            display: 'flex', alignItems: 'center',
            marginBottom: error ? '8px' : '18px',
            transition: 'border-color 0.15s',
          }}>
            <input
              autoFocus
              value={key}
              onChange={e => { setKey(e.target.value); if (error) setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              disabled={busy}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12px', color: '#ccc', fontFamily: 'inherit',
                letterSpacing: '0.03em',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '11px', color: '#a55', letterSpacing: '0.02em', margin: '0 0 18px', padding: '0 2px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <button
              onClick={submit}
              disabled={busy || !key.trim()}
              style={{
                background: 'transparent', border: '1px solid #2a2a2a',
                color: busy || !key.trim() ? '#555' : '#bbb',
                padding: '9px 18px', fontSize: '11px', fontFamily: 'inherit',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: busy || !key.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '3px', transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!busy && key.trim()) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee' } }}
              onMouseLeave={e => { if (!busy && key.trim()) { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#bbb' } }}
            >
              {busy ? 'Validating…' : 'Activate'}
            </button>

            <a
              href="mailto:Official_Site_Support@protonmail.com?subject=Site%20license"
              style={{ fontSize: '12px', color: '#555', letterSpacing: '0.02em', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              Lost your key? Email support.
            </a>
          </div>

          <button
            onClick={() => { setView('buy'); setError(null); setKey('') }}
            style={{
              alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
              fontSize: '11px', color: '#444', letterSpacing: '0.06em',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444')}
          >← Back</button>
        </>
      )}

      {view === 'buy' && onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: '24px', background: 'none', border: 'none', padding: 0,
            fontSize: '11px', color: '#333', letterSpacing: '0.06em',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            alignSelf: 'flex-start',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        >← Back</button>
      )}
    </div>
  )
}
