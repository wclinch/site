'use client'
import { useState } from 'react'
import { validateLicense } from '@/lib/license'

// Full-screen license entry. Renders in place of the workspace when the
// app boots without a cached license. Restrained, on-brand chrome —
// reads as part of the application, not as a paywall ad.

export default function LicenseGate({ onActivated }: { onActivated: () => void }) {
  const [key, setKey]         = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await validateLicense(key)
    setBusy(false)
    if (r.ok) {
      onActivated()
      return
    }
    setError(r.reason)
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#080808',
      fontFamily: 'inherit',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>

        {/* Eyebrow */}
        <div style={{
          fontSize: '11px', color: '#555',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '20px',
        }}>
          License
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '20px', fontWeight: 500, color: '#bbb',
          lineHeight: 1.3, letterSpacing: '-0.01em',
          margin: '0 0 14px',
        }}>
          Enter the license key.
        </h1>

        {/* Body */}
        <p style={{
          fontSize: '13px', color: '#777', lineHeight: 1.7,
          margin: '0 0 24px',
        }}>
          A license key was issued at purchase. Paste it below to activate this device.
          Validation runs once. The application is offline afterward.
        </p>

        {/* Input */}
        <div style={{
          background: '#0d0d0d', border: `1px solid ${error ? '#3a1f1f' : '#1a1a1a'}`,
          borderRadius: '4px',
          padding: '12px 14px',
          display: 'flex', alignItems: 'center',
          marginBottom: error ? '8px' : '20px',
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
              flex: 1,
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '12px', color: '#ccc', fontFamily: 'inherit',
              letterSpacing: '0.03em',
            }}
          />
        </div>

        {error && (
          <div style={{
            fontSize: '11px', color: '#a55',
            letterSpacing: '0.02em', margin: '0 0 20px', padding: '0 2px',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={submit}
            disabled={busy || !key.trim()}
            style={{
              background: 'transparent',
              border: '1px solid #2a2a2a',
              color: busy || !key.trim() ? '#555' : '#bbb',
              padding: '9px 18px',
              fontSize: '11px',
              fontFamily: 'inherit',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: busy || !key.trim() ? 'not-allowed' : 'pointer',
              borderRadius: '3px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!busy && key.trim()) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee' } }}
            onMouseLeave={e => { if (!busy && key.trim()) { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#bbb' } }}
          >
            {busy ? 'Validating…' : 'Activate'}
          </button>

          <a
            href="mailto:Official_Site_Support@protonmail.com?subject=Site%20license"
            style={{
              fontSize: '12px', color: '#555',
              letterSpacing: '0.02em', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            Lost your key? Email support.
          </a>
        </div>

        {/* Footnote */}
        <p style={{
          marginTop: '36px',
          fontSize: '11px', color: '#444', lineHeight: 1.7,
        }}>
          One key per purchase. Activation contacts Polar once; no further transmissions.
        </p>

      </div>
    </div>
  )
}
