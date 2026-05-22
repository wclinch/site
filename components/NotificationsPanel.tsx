'use client'
import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'proof-activity-log'

// ─── Public API ───────────────────────────────────────────────────────────────

export type NotifHandle = { expire: () => void }

export function notify(message: string, onUndo?: () => void): NotifHandle {
  const id = Math.random().toString(36).slice(2)
  window.dispatchEvent(new CustomEvent('proof:notify', { detail: { id, message, onUndo } }))
  return {
    expire: () => window.dispatchEvent(new CustomEvent('proof:notify-expire', { detail: { id } })),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Notif = {
  id: string
  message: string
  ts: number
  onUndo?: () => void
  undoExpired?: boolean
}

type StoredNotif = { id: string; message: string; ts: number }

function loadStored(): StoredNotif[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveStored(notifs: Notif[]) {
  try {
    const stored: StoredNotif[] = notifs.slice(0, 50).map(({ id, message, ts }) => ({ id, message, ts }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {}
}

// ─── Top-bar button ───────────────────────────────────────────────────────────

export default function NotificationsBtn() {
  const [unread, setUnread] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    function onNotify() { setUnread(c => c + 1) }
    function onToggle() { setActive(v => { const next = !v; if (next) setUnread(0); return next }) }
    function onClose()  { setActive(false) }
    window.addEventListener('proof:notify', onNotify)
    window.addEventListener('proof:activity-toggle', onToggle)
    window.addEventListener('proof:activity-close', onClose)
    return () => {
      window.removeEventListener('proof:notify', onNotify)
      window.removeEventListener('proof:activity-toggle', onToggle)
      window.removeEventListener('proof:activity-close', onClose)
    }
  }, [])

  return (
    <button
      onClick={() => window.dispatchEvent(new Event('proof:activity-toggle'))}
      style={{
        height: '28px', padding: '0 7px', position: 'relative',
        background: 'none', border: 'none', borderRadius: '3px',
        color: active ? '#E6E2D8' : '#8C887F',
        fontSize: '11px', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'color 0.12s',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      onMouseEnter={e => { e.currentTarget.style.color = '#E6E2D8' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8C887F' }}
    >
      Activity
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: '5px', right: '1px',
          width: '5px', height: '5px', borderRadius: '50%',
          background: '#8C887F', display: 'block',
        }} />
      )}
    </button>
  )
}

// ─── Activity panel ───────────────────────────────────────────────────────────

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)   return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function ActivityPanel() {
  const [notifs, setNotifs] = useState<Notif[]>(() =>
    loadStored().map(n => ({ ...n }))
  )
  const [clearArmed, setClearArmed] = useState(false)
  const clearArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onNotify(e: Event) {
      const { id, message, onUndo } = (e as CustomEvent).detail as Notif
      setNotifs(prev => {
        const next = [{ id, message, ts: Date.now(), onUndo }, ...prev.slice(0, 49)]
        saveStored(next)
        return next
      })
    }
    function onExpire(e: Event) {
      const { id } = (e as CustomEvent).detail
      setNotifs(prev => {
        const next = prev.map(n => n.id === id ? { ...n, onUndo: undefined, undoExpired: true } : n)
        saveStored(next)
        return next
      })
    }
    window.addEventListener('proof:notify', onNotify)
    window.addEventListener('proof:notify-expire', onExpire)
    return () => {
      window.removeEventListener('proof:notify', onNotify)
      window.removeEventListener('proof:notify-expire', onExpire)
    }
  }, [])

  function handleUndo(n: Notif) {
    n.onUndo?.()
    setNotifs(prev => { const next = prev.filter(x => x.id !== n.id); saveStored(next); return next })
  }

  function armClear() {
    setClearArmed(true)
    clearArmTimerRef.current = setTimeout(() => setClearArmed(false), 3000)
  }

  function confirmClear() {
    if (clearArmTimerRef.current) clearTimeout(clearArmTimerRef.current)
    setClearArmed(false)
    setNotifs([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      border: '1px solid #252725', borderRadius: '4px',
      background: '#070807', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 6px 0 12px', borderBottom: '1px solid #252725',
        userSelect: 'none', gap: '6px',
      }}>
        <span style={{ flex: 1, fontSize: '10px', color: '#E6E2D8', letterSpacing: '0.04em' }}>Activity</span>
        {notifs.length > 0 && (
          <>
            <button
              onClick={clearArmed ? confirmClear : armClear}
              style={{
                background: 'none', border: 'none', padding: 0, height: '22px',
                fontSize: '10px', cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'color 0.1s',
                color: clearArmed ? '#E6E2D8' : '#5E5A54',
              }}
              onMouseEnter={e => { if (!clearArmed) e.currentTarget.style.color = '#8C887F' }}
              onMouseLeave={e => { if (!clearArmed) e.currentTarget.style.color = '#5E5A54' }}
            >
              {clearArmed ? 'Confirm?' : 'Clear all'}
            </button>
            <div style={{ width: '1px', height: '10px', background: '#252725', flexShrink: 0 }} />
          </>
        )}
        <button
          onClick={() => window.dispatchEvent(new Event('proof:activity-toggle'))}
          style={{
            width: '22px', height: '22px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: '3px',
            cursor: 'pointer', color: '#5E5A54', lineHeight: 0,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#8C887F')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5E5A54')}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1 1L8 8M8 1L1 8" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{
            padding: '28px 14px', fontSize: '11px',
            color: '#5E5A54', textAlign: 'center', letterSpacing: '0.02em',
          }}>
            No recent activity.
          </div>
        ) : notifs.map((n, i) => (
          <div key={n.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '9px 10px 9px 12px',
            borderBottom: i < notifs.length - 1 ? '1px solid #1a1b1a' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: '#8C887F', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {n.message}
              </div>
              <div style={{ fontSize: '10px', color: '#5E5A54', marginTop: '2px', letterSpacing: '0.02em' }}>
                {timeAgo(n.ts)}
              </div>
            </div>
            {n.onUndo && !n.undoExpired && (
              <div style={{ flexShrink: 0, paddingTop: '1px' }}>
                <button
                  onClick={() => handleUndo(n)}
                  style={{
                    background: 'none', border: '1px solid #252725', borderRadius: '3px',
                    padding: '2px 8px', cursor: 'pointer',
                    fontSize: '10px', color: '#E6E2D8', fontFamily: 'inherit',
                    letterSpacing: '0.03em', transition: 'border-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#8C887F')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#252725')}
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
