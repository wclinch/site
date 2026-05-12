'use client'
import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export default function ScreenshotZone({ onCollapse }: { onCollapse: () => void }) {
  const { selectedImageSource, setSelectedImageId } = useApp()
  const src = selectedImageSource

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const srcId = e.dataTransfer.getData('application/x-proof-source-id')
    if (srcId) setSelectedImageId(srcId)
  }

  function allowDrop(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/x-proof-source-id')) e.preventDefault()
  }

  return (
    <div style={{ flex: '0 0 60%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#080808', borderBottom: '1px solid #1a1a1a' }}
      onDragOver={allowDrop} onDrop={handleDrop}
    >
      <div style={{ height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px 0 14px', borderBottom: '1px solid #1a1a1a', gap: '4px' }}>
        <span style={{ flex: 1, fontSize: '10px', color: '#888', letterSpacing: '0.04em', userSelect: 'none' }}>
          {src ? (src.label ?? src.raw) : 'Reference'}
        </span>
        <IconBtn onClick={onCollapse} title="Collapse"><CollapseIcon /></IconBtn>
      </div>

      {!src && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.02em' }}>No source loaded</span>
        </div>
      )}
      {src?.fileType === 'image' && <ImageContent source={src} />}
      {src?.fileType === 'note'  && <NoteContent  source={src} />}
      {src?.fileType === 'url'   && <UrlContent   source={src} />}
      {src?.fileType === 'pdf'   && <PdfContent   source={src} />}
    </div>
  )
}

// ─── Image ────────────────────────────────────────────────────────────────────

function ImageContent({ source }: { source: NonNullable<ReturnType<typeof useApp>['selectedImageSource']> }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (source.status !== 'done') { setImgUrl(null); return }
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
  }, [source.id, source.status])

  useEffect(() => () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current) }, [])

  if (!imgUrl) return <Msg>{source.status !== 'done' ? 'Loading...' : 'Image failed to load.'}</Msg>
  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <img src={imgUrl} alt={source.label ?? source.raw}
        draggable={false} onDragStart={e => e.preventDefault()}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} />
    </div>
  )
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function PdfContent({ source }: { source: NonNullable<ReturnType<typeof useApp>['selectedImageSource']> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
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
    if (source.status !== 'done') { setFileUrl(null); setNumPages(0); return }
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
  }, [source.id, source.status])

  useEffect(() => () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current) }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#080808' }}>
      {!fileUrl && <Msg>{source.status !== 'done' ? 'Loading...' : 'PDF failed to load.'}</Msg>}
      {fileUrl && !loadError && (
        <div>
          <Document file={fileUrl}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoadError(false) }}
            onLoadError={() => setLoadError(true)}
            loading={<Msg>Loading...</Msg>} error={null}>
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <Page pageNumber={i + 1} width={containerWidth} renderTextLayer renderAnnotationLayer={false} />
              </div>
            ))}
          </Document>
        </div>
      )}
      {loadError && <Msg>PDF could not be parsed.</Msg>}
    </div>
  )
}

// ─── Note ─────────────────────────────────────────────────────────────────────

function NoteContent({ source }: { source: NonNullable<ReturnType<typeof useApp>['selectedImageSource']> }) {
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
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <textarea value={text} onChange={e => handleChange(e.target.value)}
        placeholder="Note."
        style={{
          flex: 1, width: '100%', minHeight: '100%', background: 'transparent',
          border: 'none', outline: 'none', resize: 'none', padding: '20px 24px',
          fontSize: '13px', lineHeight: 1.8, color: '#bbb',
          fontFamily: 'Georgia, "Times New Roman", serif', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── URL ──────────────────────────────────────────────────────────────────────

function UrlContent({ source }: { source: NonNullable<ReturnType<typeof useApp>['selectedImageSource']> }) {
  // Local-only mode: try the iframe directly, fall back to "blocked" UI on error.
  const [state, setState] = useState<'ready' | 'blocked'>('ready')
  const url = source.url ?? source.raw
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  useEffect(() => { setState('ready') }, [url])

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {state === 'blocked' && (
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
      )}
      {state === 'ready' && (
        <iframe src={url} title={source.label ?? url} onError={() => setState('blocked')}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%', colorScheme: 'light' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      )}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Msg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#444', letterSpacing: '0.02em' }}>
      {children}
    </div>
  )
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0, color: hov ? '#bbb' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', flexShrink: 0 }}
    >{children}</button>
  )
}

function CollapseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1V4H1" /><path d="M10 4H7V1" />
      <path d="M7 10V7H10" /><path d="M1 7H4V10" />
    </svg>
  )
}
