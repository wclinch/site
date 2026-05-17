'use client'
import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'
import type { QueuedSource, ViewPage } from '@/lib/types'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Center column — single View by default, Split View optional.
export default function ReaderPanel() {
  const {
    selectedSource, setSelectedId,
    selectedSource2, setSelectedId2,
    uploadFiles, patchSource,
    view1Page, view2Page, clearView, pinPageToView,
    sources,
    splitView, setSplitView,
  } = useApp()

  function handleToggleSplit() {
    setSplitView(!splitView)
  }

  function handleClose1() {
    if (view1Page) clearView(1)
    else setSelectedId(null)
  }

  function handleClose2() {
    if (view2Page) clearView(2)
    else setSelectedId2(null)
    setSplitView(false)
  }

  // URL sources dragged onto a View pane get pinned as a live page.
  function handleDrop1(srcId: string) {
    const src = sources.find(s => s.id === srcId)
    if (!src) return
    if (src.fileType === 'url') { pinPageToView(1, src) }
    else { clearView(1); setSelectedId(srcId) }
  }
  function handleDrop2(srcId: string) {
    const src = sources.find(s => s.id === srcId)
    if (!src) return
    if (src.fileType === 'url') { pinPageToView(2, src) }
    else { clearView(2); setSelectedId2(srcId) }
  }

  const hide1 = false
  const hide2 = !splitView

  const label1 = view1Page
    ? truncate(view1Page.title)
    : selectedSource ? truncate(selectedSource.label ?? selectedSource.raw) : (splitView ? 'View 1' : 'View')
  const label2 = view2Page
    ? truncate(view2Page.title)
    : selectedSource2 ? truncate(selectedSource2.label ?? selectedSource2.raw) : 'View 2'

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        flex: 1, minHeight: 0, padding: '5px',
        display: 'flex', flexDirection: 'column',
        gap: splitView ? '4px' : 0,
      }}>
        <div style={{ flex: hide1 ? 0 : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ViewPane
            viewId={1}
            label={label1}
            source={view1Page ? null : selectedSource}
            viewPage={view1Page}
            isHidden={hide1}
            onClose={(view1Page || selectedSource) ? handleClose1 : undefined}
            onSelectId={handleDrop1}
            uploadFiles={uploadFiles}
            patchSource={patchSource}
            onToggleSplit={handleToggleSplit}
            splitActive={splitView}
          />
        </div>
        <div style={{ flex: hide2 ? 0 : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ViewPane
            viewId={2}
            label={label2}
            source={view2Page ? null : selectedSource2}
            viewPage={view2Page}
            isHidden={hide2}
            onClose={handleClose2}
            alwaysShowClose
            onSelectId={handleDrop2}
            uploadFiles={uploadFiles}
            patchSource={patchSource}
          />
        </div>
      </div>
    </div>
  )
}

function truncate(name: string): string {
  return name.length > 64 ? name.slice(0, 62) + '…' : name
}

// ─── View pane ───────────────────────────────────────────────────────────────

function ViewPane({
  viewId, label, source, viewPage, isHidden, alwaysShowClose,
  onClose, onSelectId, uploadFiles, patchSource,
  onToggleSplit, splitActive,
}: {
  viewId: 1 | 2
  label: string
  source: QueuedSource | null
  viewPage: ViewPage | null
  isHidden: boolean
  alwaysShowClose?: boolean
  onClose?: () => void
  onSelectId: (id: string) => void
  uploadFiles: (files: FileList | File[]) => Promise<void>
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  onToggleSplit?: () => void
  splitActive?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const api = (window as any).electronAPI?.view
    if (!api) return

    if (!viewPage || isHidden) {
      api.setBounds?.(String(viewId), { x: 0, y: 0, width: 0, height: 0, innerWidth: window.innerWidth, innerHeight: window.innerHeight })
      return
    }

    function sendBounds() {
      const el = viewportRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      api.setBounds?.(String(viewId), {
        x: r.left, y: r.top,
        width: Math.round(r.width), height: Math.round(r.height),
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
    }

    // Send bounds before navigate so the native view has a valid rect when loadURL fires.
    sendBounds()
    api.navigate?.(String(viewId), viewPage.url)

    const ro = new ResizeObserver(sendBounds)
    if (viewportRef.current) ro.observe(viewportRef.current)
    const unsub = (window as any).electronAPI?.research?.onBoundsRecalc?.(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => sendBounds()))
    })

    return () => {
      ro.disconnect()
      unsub?.()
      api.setBounds?.(String(viewId), { x: 0, y: 0, width: 0, height: 0, innerWidth: window.innerWidth, innerHeight: window.innerHeight })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPage?.url, isHidden, viewId])

  const showClose = alwaysShowClose || !!(viewPage || source)

  return (
    <div
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        border: `1px solid ${dragOver ? '#333' : '#222'}`, borderRadius: '4px',
        overflow: 'hidden',
        background: dragOver ? 'rgba(255,255,255,0.01)' : 'transparent',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onDragOver={e => {
        if (viewPage) return
        const hasStackSrc = e.dataTransfer.types.includes('application/x-proof-source-id')
        const hasFile     = e.dataTransfer.types.includes('Files')
        if (hasStackSrc || hasFile) { e.preventDefault(); setDragOver(true) }
      }}
      onDragEnter={e => {
        if (viewPage) return
        const hasStackSrc = e.dataTransfer.types.includes('application/x-proof-source-id')
        const hasFile     = e.dataTransfer.types.includes('Files')
        if (hasStackSrc || hasFile) setDragOver(true)
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={e => {
        if (viewPage) return
        e.preventDefault(); setDragOver(false)
        const srcId = e.dataTransfer.getData('application/x-proof-source-id')
        if (srcId) { onSelectId(srcId); return }
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
      }}
    >
      <PaneHeader
        label={label}
        onClose={showClose ? onClose : undefined}
        onToggleSplit={onToggleSplit}
        splitActive={splitActive}
      />
      {viewPage
        ? <div ref={viewportRef} style={{ flex: 1, minHeight: 0, background: '#060606' }} />
        : source
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
          {fileDragOver ? 'Release to add' : 'Open a Document or Page from the left.'}
        </span>
      </div>

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

function PaneHeader({ label, onClose, onToggleSplit, splitActive }: {
  label: string
  onClose?: () => void
  onToggleSplit?: () => void
  splitActive?: boolean
}) {
  return (
    <div style={{
      height: '28px', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 8px 0 14px',
      borderBottom: '1px solid #1a1a1a',
      gap: '4px',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <span style={{ flex: 1, fontSize: '10px', color: '#777', letterSpacing: '0.05em', userSelect: 'none' }}>
        {label}
      </span>
      {onToggleSplit && <SplitBtn active={!!splitActive} onClick={onToggleSplit} />}
      {onClose && <IconBtn onClick={onClose} title="Close"><CloseIcon /></IconBtn>}
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
    <div style={{ flex: 1, overflow: 'auto', background: '#080808', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
    <div style={{ flex: 1, background: '#080808', display: 'flex', flexDirection: 'column', overflow: 'hidden', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#080808', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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

// ─── Split button ─────────────────────────────────────────────────────────────

function SplitBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={active ? 'Exit Split' : 'Split'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px', lineHeight: 0, flexShrink: 0,
        color: active ? '#555' : hov ? '#555' : '#2e2e2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '2px', transition: 'color 0.12s',
      }}
    >
      <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="0.65" y="0.65" width="4.1" height="7.7" rx="0.7" />
        <rect x="6.25" y="0.65" width="4.1" height="7.7" rx="0.7" />
      </svg>
    </button>
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
        color: hov ? '#999' : '#555',
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
