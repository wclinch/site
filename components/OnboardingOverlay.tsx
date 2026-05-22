'use client'
import { useState } from 'react'

// Dev reset: localStorage.removeItem('proof-onboarding-v1') in the console.
export const ONBOARDING_KEY = 'proof-onboarding-v1'

const STEPS = [
  {
    title: 'Everything stays with the session.',
    body:  'Documents, saved pages, views, and web tabs come back when you return.',
    hint:  '↖ Session tabs · top bar',
  },
  {
    title: 'Hold what you need open.',
    body:  'Use 1 or 2 to send the current page to a view.',
    hint:  '1 · 2 · Web toolbar',
  },
  {
    title: 'Save pages for later.',
    body:  'Save keeps the current page with the session.',
    hint:  'Save · Web toolbar',
  },
]

export default function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const isLast    = step === STEPS.length - 1
  const { title, body, hint } = STEPS[step]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '400px', maxWidth: 'calc(100vw - 48px)',
          background: '#080909', border: '1px solid #1e1e1e',
          borderRadius: '6px', boxShadow: '0 24px 60px rgba(0,0,0,0.72)',
          padding: '36px 32px 28px',
          fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '28px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: '18px', height: '2px', borderRadius: '1px',
              background: i === step ? 'rgba(230,226,216,0.24)' : '#232523',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '18px', fontWeight: 500, color: '#E6E2D8',
          margin: '0 0 12px', letterSpacing: '-0.01em', lineHeight: 1.3,
        }}>
          {title}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: '13px', color: 'rgba(230,226,216,0.38)', lineHeight: 1.7,
          margin: '0 0 16px',
        }}>
          {body}
        </p>

        {/* Location hint */}
        <div style={{
          fontSize: '10px', color: '#232523',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: '32px',
        }}>
          {hint}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '11px', color: '#333533', letterSpacing: '0.06em',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.38)')}
            onMouseLeave={e => (e.currentTarget.style.color = '#333533')}
          >
            Skip
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '11px', color: 'rgba(230,226,216,0.22)', letterSpacing: '0.06em',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.22)')}
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => { if (isLast) { onClose(); return }; setStep(s => s + 1) }}
              style={{
                background: '#171817', border: '1px solid #232523',
                color: '#E6E2D8', padding: '8px 18px',
                fontSize: '11px', fontFamily: 'inherit',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: 'pointer', borderRadius: '3px',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(230,226,216,0.22)'; e.currentTarget.style.color = '#E6E2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#232523'; e.currentTarget.style.color = '#E6E2D8' }}
            >
              {isLast ? 'Begin' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
