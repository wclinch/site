'use client'
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getStorageUsage } from '@/lib/storage-limit'
import { clearAllStored } from '@/lib/idb'
import { useApp } from '@/context/AppContext'

// Top-bar badge showing "X.X MB / NNN MB". Limit is tier-aware (150 MB Free, 5 GB Pro).
//
// Updates in response to `proof-storage-changed` events fired by AppContext
// after any IDB write/delete. Click it to open a centered confirmation
// modal for "Reset all data" — the escape hatch for orphaned files in
// IDB (older builds leaked them on project delete) or just a clean slate.
//
// The native menu (Site → Reset Site Data…) does the same thing via
// `session.clearStorageData()` at the Electron layer; both end up at
// `0.0 / NNN MB` after the reload.
export default function StorageBadge() {
  const { limits } = useApp()
  const [usage, setUsage]   = useState<number | null>(null)
  const [open,  setOpen]    = useState(false)
  const [busy,  setBusy]    = useState(false)
  const [hover, setHover]   = useState(false)
  // Two-step destructive flow: the first click on "Reset all data" arms
  // the confirm step (in-modal — never a native dialog), the second click
  // on "Yes, delete everything" actually wipes. Esc / Cancel / backdrop
  // click all reset both `open` and `armed` together.
  const [armed, setArmed]   = useState(false)

  const refresh = useCallback(() => {
    getStorageUsage().then(setUsage)
  }, [])

  useEffect(() => {
    refresh()
    function onChange() {
      // Read immediately, then once more after the browser's storage
      // accounting catches up. Cheap, and avoids "removed file but
      // badge didn't budge" UX.
      refresh()
      setTimeout(refresh, 400)
    }
    window.addEventListener('proof-storage-changed', onChange)
    return () => window.removeEventListener('proof-storage-changed', onChange)
  }, [refresh])

  // Hide native WebContentsViews on close — open is handled synchronously in onClick.
  useEffect(() => {
    if (!open) { ;(window as any).electronAPI?.setModal?.(false) }
  }, [open])

  // Close modal on Escape. Backdrop click is handled directly on the overlay.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        setOpen(false)
        setArmed(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy])

  if (usage === null) return null

  const limitBytes = limits.storageBytes
  const pct     = usage / limitBytes
  const usedMb  = usage / (1024 * 1024)
  const usedKb  = usage / 1024
  const limitMb = Math.round(limitBytes / (1024 * 1024))
  // Granularity is unit-adaptive so per-file changes are always visible:
  //   < 1 MB  → show whole KB (a 200 KB screenshot bumps "0 KB" → "200 KB"
  //             instead of staying at "0.0 MB" and looking unchanged)
  //   1-10 MB → one decimal MB
  //   ≥ 10 MB → whole MB
  const usedStr =
    usedMb < 1   ? `${Math.round(usedKb)} KB` :
    usedMb < 10  ? `${usedMb.toFixed(1)} MB`  :
                   `${Math.round(usedMb)} MB`
  const limitStr = `${limitMb} MB`

  // Match the project-count badge color (#555) at low usage so the two
  // top-right counters read as a single visual group; brighten only when
  // approaching the cap.
  const baseColor =
    pct >= 0.9 ? '#a55' :
    pct >= 0.5 ? '#888' :
    '#555'
  const color = hover ? (pct >= 0.9 ? '#e55' : '#aaa') : baseColor

  async function reset() {
    // First click arms the confirm step; second click does the actual wipe.
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    try {
      // Wipe IDB files + all proof- localStorage keys. On reload, init
      // creates a fresh "Untitled" workspace from scratch.
      await clearAllStored()
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('proof-'))
        keys.forEach(k => localStorage.removeItem(k))
      } catch {}
      window.dispatchEvent(new Event('proof-storage-changed'))
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { ;(window as any).electronAPI?.setModal?.(true); setOpen(true) }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={`Uploaded Documents: ${usedMb.toFixed(2)} MB of ${limitMb} MB. Saved Pages do not count toward storage.`}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '11px', color, letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
      >
        {usedStr} / {limitStr}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (busy) return
            setOpen(false)
            setArmed(false)
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
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
              background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: '4px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              fontFamily: 'inherit',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{
                  fontSize: '11px',
                  color: armed ? '#c44' : '#777',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  transition: 'color 0.15s',
                }}>
                  {armed ? 'Confirm' : 'Clear Documents'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{
                      width: '16px', height: '2px', borderRadius: '1px',
                      background: (s === 1 && !armed) || (s === 2 && armed) ? '#c44' : '#1e1e1e',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: armed ? '#aaa' : '#888', lineHeight: 1.7 }}>
                {armed
                  ? 'Confirm to remove all Documents and files on this device. Cannot be reversed.'
                  : <>Removes all Documents and files on this device. Cannot be reversed.</>}
              </div>
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            {/* Usage row */}
            <div style={{
              padding: '12px 18px',
              fontSize: '11px', color: '#666', letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Used</span>
              <span>{usedMb.toFixed(2)} / {limitMb} MB</span>
            </div>

            <div style={{ height: '1px', background: '#1e1e1e' }} />

            {/* Actions */}
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <ModalButton
                onClick={() => {
                  // While armed, Cancel disarms in place instead of closing —
                  // gives an easy "I didn't mean it" without losing context.
                  if (armed) setArmed(false)
                  else setOpen(false)
                }}
                disabled={busy}
              >
                {armed ? 'Back' : 'Cancel'}
              </ModalButton>
              <ModalButton onClick={reset} disabled={busy} destructive>
                {busy ? 'Clearing…' : armed ? 'Confirm clear' : 'Clear Documents'}
              </ModalButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Matches the visual weight of `cta-link` / `text-cta` in globals.css —
// minimal ghost button with letter-spaced uppercase text. The destructive
// variant just shifts the border + text toward a muted oxblood so it
// stays inside the app's restrained palette rather than shouting.
function ModalButton({
  children, onClick, disabled, destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  const [hover, setHover] = useState(false)

  const idleBorder = destructive ? '#2a1515' : '#252525'
  const hoverBorder = destructive ? '#3a1515' : '#333'
  const idleColor  = destructive ? '#c44' : '#555'
  const hoverColor = destructive ? '#e55' : '#999'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#0f0f0f',
        border: `1px solid ${hover && !disabled ? hoverBorder : idleBorder}`,
        borderRadius: '3px',
        padding: '7px 14px',
        fontSize: '11px', fontFamily: 'inherit',
        color: hover && !disabled ? hoverColor : idleColor,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: disabled ? (destructive ? 'wait' : 'not-allowed') : 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        opacity: disabled && !destructive ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
