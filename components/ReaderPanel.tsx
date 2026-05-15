'use client'
import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'
import type { QueuedSource } from '@/lib/types'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Center column — Source 1 and Source 2, stacked vertically.
// Both panels open PDFs, docs, and images from the Stack.
// Clicking a Stack source smart-routes to the first empty pane.
// Either pane also accepts drops from Stack rows or direct file drops.
export default function ReaderPanel() {
  const {
    selectedSource, setSelectedId,
    selectedSource2, setSelectedId2,
    uploadFiles, patchSource,
  } = useApp()

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <SourcePane
          label={selectedSource ? truncate(selectedSource.label ?? selectedSource.raw) : 'Source 1'}
          source={selectedSource}
          onClose={() => setSelectedId(null)}
          onSelectId={setSelectedId}
          uploadFiles={uploadFiles}
          patchSource={patchSource}
        />
        <SourcePane
          label={selectedSource2 ? truncate(selectedSource2.label ?? selectedSource2.raw) : 'Source 2'}
          source={selectedSource2}
          onClose={() => setSelectedId2(null)}
          onSelectId={setSelectedId2}
          uploadFiles={uploadFiles}
          patchSource={patchSource}
        />
      </div>
    </div>
  )
}

function truncate(name: string): string {
  return name.length > 64 ? name.slice(0, 62) + '…' : name
}

// ─── Source pane ─────────────────────────────────────────────────────────────

function SourcePane({
  label, source, onClose, onSelectId, uploadFiles, patchSource,
}: {
  label: string
  source: QueuedSource | null
  onClose: () => void
  onSelectId: (id: string) => void
  uploadFiles: (files: FileList | File[]) => Promise<void>
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        border: `1px solid ${dragOver ? '#2a2a2a' : '#1e1e1e'}`, borderRadius: '4px',
        overflow: 'hidden',
        background: dragOver ? 'rgba(255,255,255,0.01)' : 'transparent',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onDragOver={e => {
        const hasStackSrc = e.dataTransfer.types.includes('application/x-proof-source-id')
        const hasFile     = e.dataTransfer.types.includes('Files')
        if (hasStackSrc || hasFile) { e.preventDefault(); setDragOver(true) }
      }}
      onDragEnter={e => {
        const hasStackSrc = e.dataTransfer.types.includes('application/x-proof-source-id')
        const hasFile     = e.dataTransfer.types.includes('Files')
        if (hasStackSrc || hasFile) setDragOver(true)
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={e => {
        e.preventDefault(); setDragOver(false)
        const srcId = e.dataTransfer.getData('application/x-proof-source-id')
        if (srcId) { onSelectId(srcId); return }
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
      }}
    >
      <PaneHeader label={label} onClose={source ? onClose : undefined} />
      {source
        ? <SourceContent source={source} patchSource={patchSource} />
        : <EmptySource uploadFiles={uploadFiles} />
      }
    </div>
  )
}

// ─── Source content router ───────────────────────────────────────────────────

function SourceContent({
  source, patchSource,
}: {
  source: QueuedSource
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
}) {
  if (source.fileType === 'note')  return <NoteEditor  source={source} patchSource={patchSource} />
  if (source.fileType === 'pdf')   return <PdfViewer   source={source} />
  if (source.fileType === 'image') return <ImageViewer source={source} />
  if (source.fileType === 'url')   return <UrlOpenCard source={source} />
  return (
    <div style={{ flex: 1, background: '#080808', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Empty label="Unsupported source type" />
    </div>
  )
}

// ─── Empty pane ──────────────────────────────────────────────────────────────

function EmptySource({ uploadFiles }: { uploadFiles: (files: FileList | File[]) => Promise<void> }) {
  const [fileDragOver, setFileDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | File[]) {
    const valid = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/')  || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
    )
    if (valid.length) uploadFiles(valid)
  }

  return (
    <div
      style={{
        flex: 1, background: fileDragOver ? '#0c0c0c' : '#080808',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px', gap: '20px',
        transition: 'background 0.15s',
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setFileDragOver(true) }
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setFileDragOver(false)
      }}
      onDrop={e => {
        e.preventDefault(); setFileDragOver(false)
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontSize: '12px', color: fileDragOver ? '#888' : '#555',
          letterSpacing: '0.04em', textAlign: 'center', transition: 'color 0.15s',
        }}>
          {fileDragOver ? 'Release to add' : 'Open a source from Stack.'}
        </span>
        <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.03em', textAlign: 'center' }}>
          Drop a PDF or document here.
        </span>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        style={{
          background: 'none', border: '1px solid #1e1e1e', borderRadius: '3px',
          color: '#666', fontSize: '11px', padding: '6px 14px',
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
          transition: 'border-color 0.12s, color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#aaa' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#666' }}
      >
        Add file
      </button>

      <input
        ref={fileRef} type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = '' } }}
      />
    </div>
  )
}

// ─── Pane header ─────────────────────────────────────────────────────────────

function PaneHeader({ label, onClose }: { label: string; onClose?: () => void }) {
  return (
    <div style={{
      height: '32px', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 8px 0 14px',
      borderBottom: '1px solid #1a1a1a',
      gap: '4px',
    }}>
      <span style={{ flex: 1, fontSize: '11px', color: '#555', letterSpacing: '0.04em', userSelect: 'none' }}>
        {label}
      </span>
      {onClose && <IconBtn onClick={onClose} title="Close"><CloseIcon /></IconBtn>}
    </div>
  )
}

// ─── URL fallback card ───────────────────────────────────────────────────────

function UrlOpenCard({ source }: { source: QueuedSource }) {
  const url = source.url ?? source.raw
  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, '') }
    catch { return url }
  })()
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  const title = source.label && source.label !== url && source.label !== hostname
    ? source.label : null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '22px', padding: '40px 32px', background: '#080808',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', maxWidth: '340px', textAlign: 'center' }}>
        {title && (
          <span style={{ fontSize: '13px', color: '#999', letterSpacing: '0.02em', lineHeight: 1.45 }}>
            {title}
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#444', letterSpacing: '0.04em' }}>
          {hostname}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {isElectron && (
          <button
            onClick={() => window.electronAPI?.research?.navigate(url)}
            style={{
              background: 'none', border: '1px solid #252525', borderRadius: '3px',
              color: '#666', fontSize: '11px', padding: '6px 14px',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none',
              transition: 'border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.color = '#666' }}
          >
            Open in Research
          </button>
        )}
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: '#3a3a3a', letterSpacing: '0.04em', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#666')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
        >
          Open externally ↗
        </a>
      </div>
    </div>
  )
}

// ─── Note editor ─────────────────────────────────────────────────────────────

function NoteEditor({
  source, patchSource,
}: {
  source: QueuedSource
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
}) {
  const { activeId } = useApp()
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

// ─── Image viewer ────────────────────────────────────────────────────────────

function ImageViewer({ source }: { source: QueuedSource }) {
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

  useEffect(() => () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
  }, [])

  return (
    <div style={{ flex: 1, background: '#080808', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {source.status !== 'done' && <Msg>Loading...</Msg>}
      {source.status === 'done' && !imgUrl && <Msg>Image failed to load.</Msg>}
      {source.status === 'done' && imgUrl && (
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

// ─── PDF viewer ──────────────────────────────────────────────────────────────

function PdfViewer({ source }: { source: QueuedSource }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  const [fileUrl, setFileUrl]     = useState<string | null>(null)
  const [numPages, setNumPages]   = useState(0)
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

  useEffect(() => () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {source.status === 'queued'           && <Msg>Waiting...</Msg>}
      {source.status === 'extracting'       && <Msg>Reading document...</Msg>}
      {source.status === 'done' && !fileUrl && <Msg>Loading...</Msg>}
      {source.status === 'error'            && <Msg>{source.error ?? 'Document failed to load.'}</Msg>}
      {source.status === 'done' && loadError && <Msg>PDF could not be parsed.</Msg>}
      {source.status === 'done' && fileUrl && !loadError && (
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

// ─── Icon buttons ────────────────────────────────────────────────────────────

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

function CloseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M1 1L8 8M8 1L1 8" />
    </svg>
  )
}

// ─── Shared primitives ───────────────────────────────────────────────────────

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

function Empty({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <span style={{ fontSize: '13px', color: '#444', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  )
}
