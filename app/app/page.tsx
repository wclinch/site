'use client'
import dynamic           from 'next/dynamic'
import { AppProvider }   from '@/context/AppContext'
import ProjectBar        from '@/components/ProjectBar'
import SourcePanel       from '@/components/SourcePanel'
import RightPanel        from '@/components/RightPanel'
import SourceContextMenu from '@/components/SourceContextMenu'
import LicenseGate       from '@/components/LicenseGate'
import { useApp }        from '@/context/AppContext'
import { useState, useEffect } from 'react'
import { loadLicense }   from '@/lib/license'

// pdfjs-dist uses DOMMatrix at module init — must not run during SSR
const ReaderPanel = dynamic(() => import('@/components/ReaderPanel'), { ssr: false })

const DEF_SOURCE  = '20%'
const DEF_BROWSER = '40%'

function StorageWarning() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      setMsg(detail)
      setTimeout(() => setMsg(null), 4000)
    }
    window.addEventListener('proof-storage-warning', handler)
    return () => window.removeEventListener('proof-storage-warning', handler)
  }, [])
  if (!msg) return null
  return (
    <div style={{
      // Top-center, just under the project bar — validation messages
      // ("name already exists", "limit reached") read as part of the
      // header chrome instead of a stray notification at the bottom.
      position: 'fixed', top: '56px', left: '50%', transform: 'translateX(-50%)',
      // Neutral palette to match the rest of the app (#0f0f0f surface,
      // #222 borders, #888 text). The old oxblood treatment implied a
      // destructive error; most of what flows through here is just
      // input-level validation.
      background: '#0f0f0f', border: '1px solid #222', borderRadius: '4px',
      padding: '9px 16px', fontSize: '12px', color: '#aaa', letterSpacing: '0.04em',
      boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {msg}
    </div>
  )
}

function Layout() {
  const { mounted } = useApp()
  const [researchFocused, setResearchFocused] = useState(false)

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808' }}>
        <ProjectBar />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808' }}>
      <ProjectBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingRight: '5px' }}>
        <SourcePanel width={DEF_SOURCE} />
        {!researchFocused && <ReaderPanel />}
        <div style={researchFocused
          ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          : { width: DEF_BROWSER, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        }>
          <RightPanel isFocused={researchFocused} onFocusToggle={() => setResearchFocused(f => !f)} />
        </div>
      </div>
      <SourceContextMenu />
    </div>
  )
}

function GatedShell() {
  // Tri-state: null on first paint (SSR-safe — localStorage isn't
  // available during prerender), false when no valid license is
  // cached, true once activated. ProjectBar uses useApp so this whole
  // component sits inside AppProvider regardless of license state —
  // the context is cheap to mount and gives the gate a real header
  // strip instead of a bare modal floating in space.
  const [licensed, setLicensed] = useState<boolean | null>(null)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') { setLicensed(true); return }
    setLicensed(loadLicense() !== null)
  }, [])

  if (licensed === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808' }}>
        <ProjectBar />
      </div>
    )
  }

  if (!licensed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#080808' }}>
        <ProjectBar />
        <LicenseGate onActivated={() => setLicensed(true)} />
      </div>
    )
  }

  return (
    <>
      <Layout />
      <StorageWarning />
    </>
  )
}

export default function AppPage() {
  return (
    <AppProvider>
      <GatedShell />
    </AppProvider>
  )
}
