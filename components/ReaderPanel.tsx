'use client'
import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'
import type { QueuedSource } from '@/lib/types'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Props {
  pdfOnly?: boolean
  onExpandScreenshot?: () => void
  onExpandPdf?: () => void
  pdfIsFullscreen?: boolean
  onCollapsePdf?: () => void
}

export default function ReaderPanel({ pdfOnly = false, onExpandScreenshot, onExpandPdf, pdfIsFullscreen = false, onCollapsePdf }: Props) {
  const { selectedSource, selectedImageSource, setSelectedId, setSelectedImageId } = useApp()
  const [screenshotFull, setScreenshotFull] = useState(false)
  const [pdfFull, setPdfFull] = useState(false)
  const [wrongDrop, setWrongDrop] = useState<'screenshot' | 'pdf' | null>(null)
  const [dragOverZone, setDragOverZone] = useState<'screenshot' | 'pdf' | null>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashWrong(zone: 'screenshot' | 'pdf') {
    setWrongDrop(zone)
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    wrongTimer.current = setTimeout(() => setWrongDrop(null), 2900)
  }

  function handlePdfDrop(e: React.DragEvent) {
    e.preventDefault()
    const srcId   = e.dataTransfer.getData('application/x-proof-source-id')
    const srcType = e.dataTransfer.getData('application/x-proof-source-type')
    if (!srcId) return
    if (srcType === 'pdf' || srcType === 'url') setSelectedId(srcId)
    else flashWrong('pdf')
  }

  function handleImageDrop(e: React.DragEvent) {
    e.preventDefault()
    const srcId = e.dataTransfer.getData('application/x-proof-source-id')
    if (srcId) setSelectedImageId(srcId)
  }

  function allowDrop(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/x-proof-source-id')) e.preventDefault()
  }

  function handleDragEnter(zone: 'screenshot' | 'pdf') {
    return (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('application/x-proof-source-id')) {
        setDragOverZone(zone)
      }
    }
  }

  function handleDragLeave() {
    setDragOverZone(null)
  }

  // In pdfOnly mode (expanded layout from page.tsx) just show PDF
  if (pdfOnly) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onDragOver={allowDrop} onDrop={handlePdfDrop}>
        <Header
          label="PDF / URL"
          onExpand={onExpandPdf ?? (() => {})}
          isFullscreen={pdfIsFullscreen}
          onCollapse={onCollapsePdf ?? (() => {})}
          onClose={selectedSource ? () => setSelectedId(null) : undefined}
        />
        <PdfViewer
          source={selectedSource}
          wrongMsg={wrongDrop === 'pdf' ? 'Images load in the top pane' : undefined}
        />
      </div>
    )
  }

  const showScreenshot = !pdfFull
  const showPdf        = !screenshotFull

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Screenshot zone */}
      {showScreenshot && (
        <div
          style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: dragOverZone === 'screenshot' ? 'rgba(92, 168, 160, 0.05)' : 'transparent',
            transition: 'background 0.2s',
          }}
          onDragOver={allowDrop}
          onDragEnter={handleDragEnter('screenshot')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { handleImageDrop(e); setDragOverZone(null) }}
        >
          <Header
            label="Reference"
            onExpand={() => { setScreenshotFull(true); setPdfFull(false) }}
            onExpandExternal={onExpandScreenshot}
            isFullscreen={screenshotFull}
            onCollapse={() => setScreenshotFull(false)}
            onClose={selectedImageSource ? () => setSelectedImageId(null) : undefined}
          />
          <ImageViewer source={selectedImageSource} />
        </div>
      )}

      {showScreenshot && showPdf && (
        <div style={{ height: '1px', flexShrink: 0, background: '#1a1a1a' }} />
      )}

      {/* PDF zone */}
      {showPdf && (
        <div
          style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: dragOverZone === 'pdf' ? 'rgba(92, 168, 160, 0.05)' : 'transparent',
            transition: 'background 0.2s',
          }}
          onDragOver={allowDrop}
          onDragEnter={handleDragEnter('pdf')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { handlePdfDrop(e); setDragOverZone(null) }}
        >
          <Header
            label="PDF / URL"
            onExpand={() => { setPdfFull(true); setScreenshotFull(false) }}
            isFullscreen={pdfFull}
            onCollapse={() => setPdfFull(false)}
            onClose={selectedSource ? () => setSelectedId(null) : undefined}
          />
          <PdfViewer
            source={selectedSource}
            wrongMsg={wrongDrop === 'pdf' ? 'Images load in the top pane' : undefined}
          />
        </div>
      )}

    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  label, onExpand, onExpandExternal, isFullscreen, onCollapse, onClose,
}: {
  label: string
  onExpand: () => void
  onExpandExternal?: () => void
  isFullscreen: boolean
  onCollapse: () => void
  onClose?: () => void
}) {
  return (
    <div style={{
      height: '28px', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 8px 0 14px',
      borderBottom: '1px solid #1a1a1a',
      gap: '4px',
    }}>
      <span style={{ flex: 1, fontSize: '10px', color: '#888', letterSpacing: '0.04em', userSelect: 'none' }}>
        {label}
      </span>
      {onClose && <IconBtn onClick={onClose} title="Close"><CloseIcon /></IconBtn>}
      {isFullscreen
        ? <IconBtn onClick={onCollapse} title="Restore"><CollapseIcon /></IconBtn>
        : <IconBtn onClick={onExpandExternal ?? onExpand} title="Fullscreen"><ExpandIcon /></IconBtn>
      }
    </div>
  )
}

// ─── URL viewer ───────────────────────────────────────────────────────────────

function UrlViewer({ source }: { source: QueuedSource }) {
  // Local-only mode: skip the server pre-flight, optimistically try the iframe
  // and surface the blocked-state UI if it errors.
  const [state, setState] = useState<'ready' | 'blocked'>('ready')
  const url = source.url ?? source.raw

  useEffect(() => { setState('ready') }, [url])

  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  return (
    <div style={{ flex: 1, overflow: 'hidden', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {state === 'blocked' && <UrlBlocked url={url} hostname={hostname} />}
      {state === 'ready' && (
        <iframe
          src={url}
          title={source.label ?? url}
          onError={() => setState('blocked')}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%', colorScheme: 'light' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  )
}

function UrlBlocked({ url, hostname }: { url: string; hostname: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '13px', color: '#777', letterSpacing: '0.02em' }}>This site blocks embedding.</span>
        <span style={{ fontSize: '11px', color: '#444', letterSpacing: '0.02em' }}>{hostname} doesn't allow being shown inside other pages.</span>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '12px', color: '#5ca8a0', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#7dc4bc')}
        onMouseLeave={e => (e.currentTarget.style.color = '#5ca8a0')}
      >Open {hostname} in browser →</a>
    </div>
  )
}

// ─── Note editor ──────────────────────────────────────────────────────────────

function NoteEditor({ source }: { source: QueuedSource }) {
  const { activeId, patchSource } = useApp()
  const [text, setText] = useState(source.noteContent ?? '')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setText(source.noteContent ?? '') }, [source.id])

  function handleChange(val: string) {
    setText(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (activeId) patchSource(activeId, source.id, { noteContent: val })
    }, 400)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Note."
        style={{
          flex: 1, width: '100%', minHeight: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', padding: '20px 24px',
          fontSize: '13px', lineHeight: 1.8, color: '#bbb',
          fontFamily: 'Georgia, "Times New Roman", serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Image viewer ─────────────────────────────────────────────────────────────

function ImageViewer({ source, wrongMsg }: { source: ReturnType<typeof useApp>['selectedImageSource']; wrongMsg?: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!source || source.fileType !== 'image' || source.status !== 'done') {
      setImgUrl(null); return
    }
    let cancelled = false
    getFile(source.id).then(file => {
      if (cancelled) return
      if (prevUrl.current) { URL.revokeObjectURL(prevUrl.current); prevUrl.current = null }
      if (!file) { setImgUrl(null); return }
      const url = URL.createObjectURL(file)
      prevUrl.current = url
      setImgUrl(url)
    })
    return () => { cancelled = true }
  }, [source?.id, source?.status])

  useEffect(() => () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
  }, [])

  if (source?.fileType === 'note') return <NoteEditor source={source} />
  if (source?.fileType === 'url')  return <UrlViewer  source={source} />
  if (source?.fileType === 'pdf')  return <PdfViewer  source={source as ReturnType<typeof useApp>['selectedSource']} />

  return (
    <div style={{ flex: 1, background: '#080808', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!source && <Empty label='Drop image' sub='PNG · JPG · WEBP · GIF' />}
      {source && source.status !== 'done' && <Msg>Loading...</Msg>}
      {source && source.status === 'done' && !imgUrl && <Msg>Image failed to load.</Msg>}
      {source && source.status === 'done' && imgUrl && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <img src={imgUrl} alt={source.label ?? source.raw}
            draggable={false}
            onDragStart={e => e.preventDefault()}
            style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ─── PDF viewer ───────────────────────────────────────────────────────────────

function PdfViewer({ source, wrongMsg }: { source: ReturnType<typeof useApp>['selectedSource']; wrongMsg?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  const [fileUrl, setFileUrl]   = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(Math.floor(w))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!source || source.status !== 'done') {
      setFileUrl(null); setNumPages(0); return
    }
    let cancelled = false
    getFile(source.id).then(file => {
      if (cancelled) return
      if (prevUrl.current) { URL.revokeObjectURL(prevUrl.current); prevUrl.current = null }
      if (!file) { setFileUrl(null); return }
      const url = URL.createObjectURL(file)
      prevUrl.current = url
      setFileUrl(url)
      setNumPages(0)
      setLoadError(false)
    })
    return () => { cancelled = true }
  }, [source?.id, source?.status])

  useEffect(() => () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
  }, [])

  if (source?.fileType === 'url') return <UrlViewer source={source} />

  // Defensive: if the bottom pane somehow ends up with a non-PDF source
  // (e.g. an image that slipped through stale state), don't hand the
  // blob to react-pdf — `<Document>` blows up with InvalidPDFException.
  // Show the empty drop-zone instead.
  const isNonPdfSource = source && source.fileType && source.fileType !== 'pdf'

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {(!source || isNonPdfSource)            && <Empty label={wrongMsg ?? 'Drop PDF or URL'} sub={wrongMsg ? undefined : 'PDF · URL · Draft tracks the active project'} />}
      {source?.status === 'queued'           && <Msg>Waiting...</Msg>}
      {source?.status === 'extracting'       && <Msg>Reading document...</Msg>}
      {source?.status === 'done' && !fileUrl && <Msg>Loading...</Msg>}
      {source?.status === 'error'            && <Msg>{source.error ?? 'Document failed to load.'}</Msg>}
      {source?.status === 'done' && loadError && <Msg>PDF could not be parsed.</Msg>}

      {source?.status === 'done' && fileUrl && !loadError && !isNonPdfSource && (
        <div>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoadError(false) }}
            onLoadError={() => setLoadError(true)}
            loading={<Msg>Loading...</Msg>}
            error={null}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <Page pageNumber={i + 1} width={containerWidth} renderTextLayer renderAnnotationLayer={false} />
              </div>
            ))}
          </Document>
        </div>
      )}
    </div>
  )
}

// ─── Icon button ──────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px', lineHeight: 0,
        color: hov ? '#bbb' : '#777',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '2px', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function ExpandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4V1H4" /><path d="M7 1H10V4" />
      <path d="M10 7V10H7" /><path d="M4 10H1V7" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1V4H1" /><path d="M10 4H7V1" />
      <path d="M7 10V7H10" /><path d="M1 7H4V10" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M1 1L8 8M8 1L1 8" />
    </svg>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Msg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minHeight: '40px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', color: '#666', letterSpacing: '0.02em',
    }}>
      {children}
    </div>
  )
}

function Empty({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px',
      padding: '32px 24px',
    }}>
      <span style={{ fontSize: '14px', color: '#888', letterSpacing: '0.02em', fontWeight: 400 }}>{label}</span>
      {sub && <span style={{ fontSize: '12px', color: '#666', letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.6 }}>{sub}</span>}
    </div>
  )
}

