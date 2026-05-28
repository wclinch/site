'use client'
import { useState, useEffect, useRef } from 'react'

const T = '#E6E2D8', M = 'rgba(230,226,216,0.65)', S = '#151615', BR = 'rgba(230,226,216,0.1)'

type ToastEntry = { id: string; message: string; onUndo?: () => void }

export default function NotificationToast() {
  const [toast, setToast] = useState<ToastEntry | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onNotify(e: Event) {
      const { id, message, onUndo } = (e as CustomEvent).detail as ToastEntry
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setToast({ id, message, onUndo })
      hideTimer.current = setTimeout(() => setToast(null), 4000)
    }
    window.addEventListener('site:notify', onNotify)
    // ignore site:notify-expire — undo stays visible until toast fades
    return () => {
      window.removeEventListener('site:notify', onNotify)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (!toast) return null

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '10%', transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex', alignItems: 'stretch',
      background: '#1c1d1c', border: '1px solid rgba(230,226,216,0.1)', borderRadius: '5px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
      fontSize: '12px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      whiteSpace: 'nowrap', overflow: 'hidden',
      animation: 'toast-in 0.15s ease',
    }}>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <span style={{ color: M, padding: '8px 14px', display: 'flex', alignItems: 'center' }}>{toast.message}</span>
      {toast.onUndo && (
        <>
          <div style={{ width: '1px', background: 'rgba(230,226,216,0.1)', flexShrink: 0 }} />
          <button
            onClick={() => { toast.onUndo?.(); setToast(null) }}
            style={{
              background: 'none', border: 'none', padding: '8px 14px',
              cursor: 'pointer', fontSize: '12px', color: T,
              fontFamily: 'inherit', letterSpacing: '0.05em',
              transition: 'background 0.1s', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(230,226,216,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >Undo</button>
        </>
      )}
    </div>
  )
}
