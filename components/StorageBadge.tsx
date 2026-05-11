'use client'
import { useEffect, useState, useCallback } from 'react'
import { getStorageUsage, STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'
import { clearAllStored } from '@/lib/idb'

// Top-bar badge showing "X.X MB / 250 MB". Always visible.
//
// Updates in response to `proof-storage-changed` events fired by AppContext
// after any IDB write/delete. Click it to open a centered confirmation
// modal for "Reset all data" — the escape hatch for orphaned files in
// IDB (older builds leaked them on project delete) or just a clean slate.
//
// The native menu (Site → Reset Site Data…) does the same thing via
// `session.clearStorageData()` at the Electron layer; both end up at
// `0.0 / 250 MB` after the reload.
export default function StorageBadge() {
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

  const pct     = usage / STORAGE_LIMIT_BYTES
  const usedMb  = usage / (1024 * 1024)
  const limitMb = Math.round(STORAGE_LIMIT_BYTES / (1024 * 1024))
  // 1 decimal under 10 MB, whole numbers above — keeps the badge a stable width.
  const usedStr = usedMb < 10 ? usedMb.toFixed(1) : Math.round(usedMb).toString()

  // Match the project-count badge color (#555) at low usage so the two
  // top-right counters read as a single visual group; brighten only when
  // approaching the cap.
  const baseColor =
    pct >= 0.9 ? '#a55' :
    pct >= 0.5 ? '#888' :
    '#555'
  const color = hover ? (pct >= 0.9 ? '#c66' : '#aaa') : baseColor

  async function reset() {
    // First click arms the confirm step; second click does the actual wipe.
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    try {
      // Wipe IDB files + extracted content, and the localStorage state
      // that referenced them. A full reload is the cleanest way to get
      // React state back in sync without threading a reset callback
      // through every consumer.
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
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={`${usedMb.toFixed(2)} MB of ${limitMb} MB used`}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '11px', color, letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
      >
        {usedStr} / {limitMb} MB
      </button>

      {open && (
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
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '360px', maxWidth: 'calc(100vw - 48px)',
              background: '#0f0f0f', border: '1px solid #222', borderRadius: '4px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              fontFamily: 'inherit',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 18px 14px' }}>
              <div style={{
                fontSize: '11px',
                color: armed ? '#c77' : '#777',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                marginBottom: '10px',
                transition: 'color 0.15s',
              }}>
                {armed ? 'Are you sure?' : 'Reset all data'}
              </div>
              <div style={{ fontSize: '12px', color: armed ? '#aaa' : '#888', lineHeight: 1.7 }}>
                {armed
                  ? 'Click again to permanently delete every file, project, and draft on this machine. There is no undo.'
                  : <>All files, projects, and drafts on this machine will be permanently removed. This action can&apos;t be undone.</>}
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
              <span>Current usage</span>
              <span>{usedMb.toFixed(2)} MB of {limitMb} MB</span>
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
                {armed ? 'Go back' : 'Cancel'}
              </ModalButton>
              <ModalButton onClick={reset} disabled={busy} destructive>
                {busy ? 'Resetting…' : armed ? 'Yes, delete everything' : 'Reset all data'}
              </ModalButton>
            </div>
          </div>
        </div>
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

  const idleBorder = destructive ? '#3a1f1f' : '#222'
  const hoverBorder = destructive ? '#5a2c2c' : '#444'
  const idleColor  = destructive ? '#a55' : '#777'
  const hoverColor = destructive ? '#d77' : '#bbb'

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
