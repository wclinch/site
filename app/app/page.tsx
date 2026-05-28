'use client'
import dynamic           from 'next/dynamic'
import { AppProvider }   from '@/context/AppContext'
import ProjectBar        from '@/components/ProjectBar'
import SourcePanel       from '@/components/SourcePanel'
import RightPanel        from '@/components/RightPanel'
import SourceContextMenu from '@/components/SourceContextMenu'
import AccountModal      from '@/components/AccountModal'
import NotificationToast from '@/components/NotificationToast'
import { useApp }        from '@/context/AppContext'
import { useState, useEffect, useRef } from 'react'

// pdfjs-dist uses DOMMatrix at module init — must not run during SSR
const ReaderPanel = dynamic(() => import('@/components/ReaderPanel'), { ssr: false })

const DEF_SOURCE = '20%'


type WorkspaceLayout = { researchFocused: boolean; viewFocused: boolean; sidebarCollapsed: boolean }
const DEFAULT_LAYOUT: WorkspaceLayout = { researchFocused: false, viewFocused: false, sidebarCollapsed: false }


function layoutKey(id: string) { return `site-layout:${id}` }
function saveLayout(id: string, l: WorkspaceLayout) {
  try { localStorage.setItem(layoutKey(id), JSON.stringify(l)) } catch {}
}
function loadLayout(id: string): WorkspaceLayout {
  try {
    const raw = localStorage.getItem(layoutKey(id))
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_LAYOUT
}

function AppShell() {
  const { mounted, activeId } = useApp()
  const [researchFocused,  setResearchFocused]  = useState(false)
  const [viewFocused,      setViewFocused]      = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  const layoutMapRef    = useRef<Record<string, WorkspaceLayout>>({})
  const prevActiveRef   = useRef<string | null>(null)
  const currentLayout   = useRef<WorkspaceLayout>(DEFAULT_LAYOUT)
  currentLayout.current = { researchFocused, viewFocused, sidebarCollapsed }

  // Save current layout on page unload (covers hard reload)
  useEffect(() => {
    function onUnload() {
      if (activeId) saveLayout(activeId, currentLayout.current)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [activeId])

  // Save layout for outgoing workspace, restore for incoming
  useEffect(() => {
    const prev = prevActiveRef.current
    if (prev) {
      const layout = currentLayout.current
      layoutMapRef.current[prev] = layout
      saveLayout(prev, layout)
    }
    prevActiveRef.current = activeId ?? null
    if (activeId) {
      const saved = layoutMapRef.current[activeId] ?? loadLayout(activeId)
      layoutMapRef.current[activeId] = saved
      setResearchFocused(saved.researchFocused)
      setViewFocused(saved.viewFocused)
      setSidebarCollapsed(saved.sidebarCollapsed ?? false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Restore settings modal if it was open before hard reload
  useEffect(() => {
    try {
      const saved = localStorage.getItem('site-modal-open')
      if (saved === 'account') { ;(window as any).electronAPI?.setModal?.(true); setShowAccount(true) }
    } catch {}
  }, [])

  useEffect(() => {
    function onShowAccount() {
      try { localStorage.setItem('site-modal-open', 'account') } catch {}
      ;(window as any).electronAPI?.setModal?.(true)
      setShowAccount(true)
    }
    window.addEventListener('site:show-account', onShowAccount as EventListener)
    return () => { window.removeEventListener('site:show-account', onShowAccount as EventListener) }
  }, [])

  useEffect(() => {
    if (!showAccount) { ;(window as any).electronAPI?.setModal?.(false) }
  }, [showAccount])

  // Sidebar toggle via event (dispatched from ReaderPanel)
  useEffect(() => {
    const handler = () => {
      const { viewFocused: vf, sidebarCollapsed: sc } = currentLayout.current
      if (vf || sc) {
        // Sidebar hidden by either mechanism — restore both
        setViewFocused(false)
        setSidebarCollapsed(false)
      } else {
        setSidebarCollapsed(true)
      }
    }
    window.addEventListener('site:toggle-sidebar', handler)
    return () => window.removeEventListener('site:toggle-sidebar', handler)
  }, [])

  // Poll resize events after layout changes so Electron WebContentsViews recapture bounds.
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      window.dispatchEvent(new Event('resize'))
      if (Date.now() - start > 500) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [researchFocused, viewFocused, sidebarCollapsed])

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#070807' }}>
        <ProjectBar />
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#070807', WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <ProjectBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 7px 7px 7px', background: '#090b09' }}>
          <SourcePanel width={DEF_SOURCE} hidden={viewFocused || sidebarCollapsed} />
          <ReaderPanel
            isFocused={viewFocused} onFocusToggle={() => setViewFocused(f => !f)}
            hidden={researchFocused}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RightPanel
              isFocused={researchFocused}
              onFocusToggle={() => {
                if (researchFocused) {
                  setResearchFocused(false)
                } else {
                  setViewFocused(false)
                  setResearchFocused(true)
                }
              }}
            />
          </div>
        </div>
        <SourceContextMenu />
      </div>
      <NotificationToast />
      {showAccount && <AccountModal onClose={() => { try { localStorage.removeItem('site-modal-open') } catch {} setShowAccount(false) }} />}
    </>
  )
}

export default function AppPage() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
