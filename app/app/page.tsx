'use client'
import dynamic           from 'next/dynamic'
import { AppProvider }   from '@/context/AppContext'
import ProjectBar        from '@/components/ProjectBar'
import SourcePanel       from '@/components/SourcePanel'
import DraftPanel        from '@/components/DraftPanel'
import SourceContextMenu from '@/components/SourceContextMenu'
import LicenseGate       from '@/components/LicenseGate'
import { useApp }        from '@/context/AppContext'
import { useState, useEffect } from 'react'
import { loadLicense }   from '@/lib/license'

// pdfjs-dist uses DOMMatrix at module init — must not run during SSR
const ReaderPanel    = dynamic(() => import('@/components/ReaderPanel'),    { ssr: false })
const ScreenshotZone = dynamic(() => import('@/components/ScreenshotZone'), { ssr: false })

const DEF_SOURCE = '20%'
const DEF_DRAFT  = '40%'

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
  const [screenshotExpanded, setScreenshotExpanded] = useState(false)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)

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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left 20%: source list */}
        <SourcePanel width={DEF_SOURCE} />
        <div style={{ width: '1px', flexShrink: 0, background: '#222' }} />

        {pdfFullscreen ? (
          /* PDF FULLSCREEN: pdf takes full height, draft alongside */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <ReaderPanel pdfOnly pdfIsFullscreen onCollapsePdf={() => setPdfFullscreen(false)} />
            <div style={{ width: '1px', flexShrink: 0, background: '#333' }} />
            <DraftPanel />
          </div>
        ) : screenshotExpanded ? (
          /* SCREENSHOT EXPANDED: screenshot spans full top 60%, PDF + draft side-by-side at bottom 40% */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ScreenshotZone onCollapse={() => setScreenshotExpanded(false)} />
            <div style={{ height: '1px', flexShrink: 0, background: '#1a1a1a' }} />
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <ReaderPanel pdfOnly onExpandPdf={() => { setScreenshotExpanded(false); setPdfFullscreen(true) }} />
              <div style={{ width: '1px', flexShrink: 0, background: '#333' }} />
              <DraftPanel />
            </div>
          </div>
        ) : (
          /* DEFAULT: screenshot+PDF stacked in center 40%, draft in right 40% */
          <>
            <ReaderPanel onExpandScreenshot={() => setScreenshotExpanded(true)} />
            <div style={{ width: '1px', flexShrink: 0, background: '#333' }} />
            <div style={{ width: DEF_DRAFT, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <DraftPanel />
            </div>
          </>
        )}

      </div>
      <SourceContextMenu />
    </div>
  )
}

export default function AppPage() {
  // License gate runs outside AppProvider so we don't spin up the
  // workspace's IDB / context machinery for a user who hasn't activated.
  // Tri-state: null while we read localStorage on first paint (SSR-safe),
  // false if no valid license cached, true once activated.
  const [licensed, setLicensed] = useState<boolean | null>(null)
  useEffect(() => { setLicensed(loadLicense() !== null) }, [])

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
    <AppProvider>
      <Layout />
      <StorageWarning />
    </AppProvider>
  )
}
