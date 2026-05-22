'use client'
import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'
import type { QueuedSource, ViewPage } from '@/lib/types'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Center column — single View by default, Split View optional.
// soloPane is owned by AppShell so it survives the unmount/remount cycle when
// the research browser toggles fullscreen.
export default function ReaderPanel({
  soloPane, setSoloPane, isFocused, onFocusToggle, hidden,
}: {
  soloPane: 1 | 2
  setSoloPane: (p: 1 | 2) => void
  isFocused: boolean
  onFocusToggle: () => void
  hidden?: boolean
}) {
  const {
    selectedSource, setSelectedId,
    selectedSource2, setSelectedId2,
    uploadFiles, patchSource,
    view1Page, view2Page, clearView, pinPageToView, pinUrlToView,
    sources,
    splitView, setSplitView,
  } = useApp()

  function handleToggleSplitFromPane(pane: 1 | 2) {
    if (splitView) {
      setSoloPane(pane)
      setSplitView(false)
    } else {
      setSplitView(true)
    }
  }

  function handleClose1() {
    if (view1Page) clearView(1)
    else setSelectedId(null)
  }

  function handleClose2() {
    if (view2Page) clearView(2)
    else setSelectedId2(null)
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

  const hide1 = !splitView && soloPane !== 1
  const hide2 = !splitView && soloPane !== 2

  return (
    <div style={{ flexGrow: hidden ? 0 : 1, flexShrink: 1, flexBasis: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'flex-grow 0.22s ease' }}>
      <div style={{
        flex: 1, minHeight: 0, padding: '7px',
        display: 'flex', flexDirection: 'column',
        gap: splitView ? '8px' : 0,
        transition: 'gap 0.2s ease',
      }}>
        <div style={{
          flex: hide1 ? 0 : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'flex 0.2s ease',
        }}>
          <ViewPane
            viewId={1}
            label="View 1"
            source={view1Page ? null : selectedSource}
            viewPage={view1Page}
            isHidden={hide1}
            onClose={(view1Page || selectedSource) ? handleClose1 : undefined}
            onSelectId={handleDrop1}
            onDropUrl={(url, title) => pinUrlToView(1, url, title)}
            uploadFiles={uploadFiles}
            patchSource={patchSource}
            onToggleSplit={() => handleToggleSplitFromPane(1)}
            splitActive={splitView}
            isFocused={isFocused || (!splitView && soloPane === 1)}
            isExpanded={isFocused}
            onFocusToggle={onFocusToggle}
          />
        </div>
        <div style={{
          flex: hide2 ? 0 : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'flex 0.2s ease',
        }}>
          <ViewPane
            viewId={2}
            label="View 2"
            source={view2Page ? null : selectedSource2}
            viewPage={view2Page}
            isHidden={hide2}
            onClose={(view2Page || selectedSource2) ? handleClose2 : undefined}
            onSelectId={handleDrop2}
            onDropUrl={(url, title) => pinUrlToView(2, url, title)}
            uploadFiles={uploadFiles}
            patchSource={patchSource}
            onToggleSplit={() => handleToggleSplitFromPane(2)}
            splitActive={splitView}
            isFocused={isFocused || (!splitView && soloPane === 2)}
            isExpanded={isFocused}
            onFocusToggle={onFocusToggle}
          />
        </div>
      </div>
    </div>
  )
}

// ─── View pane ───────────────────────────────────────────────────────────────

function ViewPane({
  viewId, label, source, viewPage, isHidden, alwaysShowClose,
  onClose, onSelectId, onDropUrl, uploadFiles, patchSource,
  onToggleSplit, splitActive, isFocused, isExpanded, onFocusToggle,
}: {
  viewId: 1 | 2
  label: string
  source: QueuedSource | null
  viewPage: ViewPage | null
  isHidden: boolean
  alwaysShowClose?: boolean
  onClose?: () => void
  onSelectId: (id: string) => void
  onDropUrl?: (url: string, title: string) => void
  uploadFiles: (files: FileList | File[]) => Promise<void>
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  onToggleSplit?: () => void
  splitActive?: boolean
  isFocused?: boolean
  isExpanded?: boolean
  onFocusToggle?: () => void
}) {
  const [dragOver,     setDragOver]     = useState(false)
  const viewportRef    = useRef<HTMLDivElement>(null)
  const navigatedUrl   = useRef<string | null>(null)

  useEffect(() => {
    const api = (window as any).electronAPI?.view
    if (!api) return

    if (!viewPage || isHidden) {
      if (!viewPage) navigatedUrl.current = null  // reset so same URL re-navigates after clear()
      api.setBounds?.(String(viewId), { x: 0, y: 0, width: 0, height: 0, innerWidth: window.innerWidth, innerHeight: window.innerHeight })
      return
    }

    function sendBounds() {
      const el = viewportRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      api.setBounds?.(String(viewId), {
        x: Math.floor(r.left), y: Math.floor(r.top),
        width: Math.round(r.width), height: Math.round(r.height),
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      })
    }

    if (viewPage.url !== navigatedUrl.current) {
      // URL changed — navigate and set bounds immediately so loadURL has a valid rect.
      navigatedUrl.current = viewPage.url
      requestAnimationFrame(() => { sendBounds(); api.navigate?.(String(viewId), viewPage.url) })
    } else {
      // Only isHidden changed (split toggled) — just reposition, do NOT reload the page.
      requestAnimationFrame(() => requestAnimationFrame(() => sendBounds()))
    }

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
        border: `1px solid ${dragOver ? '#252725' : isFocused ? '#252725' : '#252725'}`, borderRadius: '4px',
        overflow: 'hidden',
        background: dragOver ? 'rgba(255,255,255,0.015)' : 'transparent',
        transition: 'border-color 0.15s ease, background 0.15s',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      onDragOver={e => {
        const t = e.dataTransfer.types
        if (t.includes('application/x-proof-source-id') || t.includes('application/x-proof-web-url') || t.includes('Files')) {
          e.preventDefault(); setDragOver(true)
        }
      }}
      onDragEnter={e => {
        const t = e.dataTransfer.types
        if (t.includes('application/x-proof-source-id') || t.includes('application/x-proof-web-url') || t.includes('Files'))
          setDragOver(true)
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={e => {
        e.preventDefault(); setDragOver(false)
        const srcId = e.dataTransfer.getData('application/x-proof-source-id')
        if (srcId) { onSelectId(srcId); return }
        const webRaw = e.dataTransfer.getData('application/x-proof-web-url')
        if (webRaw && onDropUrl) {
          try { const { url, title } = JSON.parse(webRaw); onDropUrl(url, title) } catch {}
          return
        }
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
      }}
    >
      <PaneHeader
        label={label}
        onClose={showClose ? onClose : undefined}
        onToggleSplit={onToggleSplit}
        splitActive={splitActive}
        isFocused={isFocused}
        isExpanded={isExpanded}
        onFocusToggle={onFocusToggle}
        dragUrl={viewPage ? { url: viewPage.url, title: viewPage.title } : undefined}
        showSidebarToggle={viewId === 1}
      />
      {viewPage
        ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 1px 1px' }}>
            <div ref={viewportRef} style={{ flex: 1, minHeight: 0, background: '#070807', WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
          </div>
        )
        : source
          ? <SourceContent source={source} patchSource={patchSource} />
          : <EmptySource viewId={viewId} uploadFiles={uploadFiles} />
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
    <div style={{ flex: 1, background: '#070807', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Empty label="Unsupported file type" />
    </div>
  )
}

// ─── Empty pane ──────────────────────────────────────────────────────────────

function EmptySource({ viewId, uploadFiles }: { viewId: 1 | 2; uploadFiles: (files: FileList | File[]) => Promise<void> }) {
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
        flex: 1,
        background: fileDragOver ? '#111211' : '#070807',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px', gap: '8px',
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
      <span style={{
        fontSize: '12px', color: fileDragOver ? '#8C887F' : '#8C887F',
        letterSpacing: '0.03em', textAlign: 'center', transition: 'color 0.15s',
        userSelect: 'none',
      }}>
        {fileDragOver ? 'Drop to open.' : 'Nothing open.'}
      </span>
      {!fileDragOver && (
        <span style={{ fontSize: '11px', color: '#8C887F', letterSpacing: '0.02em', textAlign: 'center', userSelect: 'none' }}>
          {viewId === 2 ? 'Open a second source from the shelf.' : 'Select a source from the shelf, or drop a file.'}
        </span>
      )}

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

function PaneHeader({ label, onClose, onToggleSplit, splitActive, isFocused, isExpanded, onFocusToggle, dragUrl, showSidebarToggle }: {
  label: string
  onClose?: () => void
  onToggleSplit?: () => void
  splitActive?: boolean
  isFocused?: boolean
  isExpanded?: boolean
  onFocusToggle?: () => void
  dragUrl?: { url: string; title: string }
  showSidebarToggle?: boolean
}) {
  return (
    <div style={{
      height: '32px', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 6px 0 6px',
      borderBottom: '1px solid #252725',
      gap: '2px',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      {showSidebarToggle && <SidebarToggleBtn />}
      {/* Label chip — draggable when a page is pinned */}
      <span
        draggable={!!dragUrl}
        onDragStart={dragUrl ? e => {
          e.dataTransfer.setData('application/x-proof-web-url', JSON.stringify(dragUrl))
          e.dataTransfer.effectAllowed = 'copy'
        } : undefined}
        title={dragUrl ? `Drag to Web to open in a new tab` : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center',
          height: '22px', padding: '0 8px',
          borderRadius: '4px',
          background: '#111211',
          border: '1px solid #252725',
          fontSize: '10px', color: '#E6E2D8', letterSpacing: '0.04em',
          userSelect: 'none', cursor: dragUrl ? 'grab' : 'default',
          marginLeft: showSidebarToggle ? '2px' : '4px',
          maxWidth: '160px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          flexShrink: 0,
        }}>
        {label}
      </span>
      {/* Spacer so buttons stay right-aligned */}
      <div style={{ flex: 1 }} />
      {onToggleSplit && <SplitBtn active={!!splitActive} onClick={onToggleSplit} />}
      {onFocusToggle && <FocusBtn active={!!isExpanded} onClick={onFocusToggle} />}
      {onClose && <IconBtn onClick={onClose} title="Close"><CloseIcon /></IconBtn>}
    </div>
  )
}

function SidebarToggleBtn() {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('proof:toggle-sidebar'))}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Toggle sidebar"
      style={{
        width: '26px', height: '26px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: '3px',
        color: hov ? '#8C887F' : '#8C887F',
        cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
        transition: 'color 0.12s',
      }}
    >
      <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="0.7" y="0.7" width="12.6" height="9.6" rx="1.5" />
        <line x1="4.7" y1="0.7" x2="4.7" y2="10.3" />
      </svg>
    </button>
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
    <div style={{ flex: 1, overflow: 'auto', background: '#070807', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Note."
        style={{
          flex: 1, width: '100%', minHeight: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', padding: '20px 24px',
          fontSize: '13px', lineHeight: 1.8, color: '#8C887F',
          fontFamily: 'Georgia, "Times New Roman", serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Zoom cursors ─────────────────────────────────────────────────────────────

const CURSOR_IN  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 22 22'%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='white' stroke-width='1.4'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='white' stroke-width='1.4' stroke-linecap='round'/%3E%3Cline x1='9' y1='6' x2='9' y2='12' stroke='white' stroke-width='1.4' stroke-linecap='round'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='white' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E") 5 5, zoom-in`
const CURSOR_OUT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 22 22'%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='white' stroke-width='1.4'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='white' stroke-width='1.4' stroke-linecap='round'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='white' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E") 5 5, zoom-out`

// ─── Image viewer ────────────────────────────────────────────────────────────

function ImageViewer({ source }: { source: QueuedSource }) {
  const [imgUrl,     setImgUrl]     = useState<string | null>(null)
  const [zoomed,     setZoomed]     = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
  const prevUrl      = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

  useEffect(() => { setZoomed(false); setZoomOrigin(null) }, [source.id])

  useEffect(() => () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
  }, [])

  // Escape exits zoom
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  // Scroll to clicked point after zooming in
  useEffect(() => {
    if (!zoomed || !zoomOrigin || !containerRef.current) return
    const container = containerRef.current
    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img) return
    const doScroll = () => {
      const scrollX = img.naturalWidth  * zoomOrigin.x - container.clientWidth  / 2
      const scrollY = img.naturalHeight * zoomOrigin.y - container.clientHeight / 2
      container.scrollLeft = Math.max(0, scrollX)
      container.scrollTop  = Math.max(0, scrollY)
    }
    if (reducedMotion) doScroll(); else requestAnimationFrame(doScroll)
  }, [zoomed, zoomOrigin, reducedMotion])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) { setZoomed(false); setZoomOrigin(null); return }
    const img = (e.currentTarget as HTMLDivElement).querySelector('img')
    if (!img) return
    const rect = img.getBoundingClientRect()
    setZoomOrigin({
      x: Math.max(0, Math.min(1, (e.clientX - rect.left)  / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top)   / rect.height)),
    })
    setZoomed(true)
  }

  return (
    <div style={{ flex: 1, background: '#070807', display: 'flex', flexDirection: 'column', overflow: 'hidden', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {source.status !== 'done' && <Msg>Opening…</Msg>}
      {source.status === 'done' && !imgUrl && <Msg>Image failed to load.</Msg>}
      {source.status === 'done' && imgUrl && (
        <div
          ref={containerRef}
          onClick={handleClick}
          style={{
            flex: 1, minHeight: 0,
            display: 'flex',
            alignItems: zoomed ? 'flex-start' : 'center',
            justifyContent: zoomed ? 'flex-start' : 'center',
            overflow: zoomed ? 'auto' : 'hidden',
            padding: zoomed ? '0' : '20px',
            cursor: zoomed ? CURSOR_OUT : CURSOR_IN,
          }}
        >
          <img
            src={imgUrl}
            alt={source.label ?? source.raw}
            draggable={false}
            onDragStart={e => e.preventDefault()}
            style={{
              display: 'block',
              userSelect: 'none',
              borderRadius: zoomed ? '0' : '2px',
              maxWidth:  zoomed ? 'none' : '100%',
              maxHeight: zoomed ? 'none' : '100%',
              width: 'auto', height: 'auto',
            }}
          />
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
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#070807', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {source.status === 'queued'           && <Msg>Waiting…</Msg>}
      {source.status === 'extracting'       && <Msg>Opening…</Msg>}
      {source.status === 'done' && !fileUrl && <Msg>Opening…</Msg>}
      {source.status === 'error'            && <Msg>{source.error ?? 'Failed to open.'}</Msg>}
      {source.status === 'done' && loadError && <Msg>Could not read this file.</Msg>}
      {source.status === 'done' && fileUrl && !loadError && (
        <div>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoadError(false) }}
            onLoadError={() => setLoadError(true)}
            loading={<Msg>Opening…</Msg>}
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

// ─── Pane icon button (shared base) ──────────────────────────────────────────

function PaneIconBtn({ title, active, faint, onClick, children }: {
  title: string
  active?: boolean
  faint?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '28px', height: '26px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, lineHeight: 0, flexShrink: 0,
        color: active ? '#8C887F' : hov ? '#8C887F' : '#8C887F',
        borderRadius: '3px',
        transition: 'color 0.12s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Split button ─────────────────────────────────────────────────────────────

function SplitBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <PaneIconBtn title={active ? 'Single view' : 'Split'} active={active} onClick={onClick}>
      {active ? (
        // Currently split → single rect with dividing line (click exits split)
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="0.8" y="0.8" width="10.4" height="8.4" rx="1" />
          <line x1="0.8" y1="5" x2="11.2" y2="5" />
        </svg>
      ) : (
        // Currently single → plain rect (click enters split)
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="0.8" y="0.8" width="10.4" height="8.4" rx="1" />
        </svg>
      )}
    </PaneIconBtn>
  )
}

// ─── Focus/expand button ──────────────────────────────────────────────────────

function FocusBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <PaneIconBtn title={active ? 'Restore' : 'Expand'} active={active} onClick={onClick}>
      {active ? (
        // Compress — corner brackets pointing inward
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4,1 4,4 1,4" />
          <polyline points="8,1 8,4 11,4" />
          <polyline points="11,8 8,8 8,11" />
          <polyline points="1,8 4,8 4,11" />
        </svg>
      ) : (
        // Expand — corner brackets pointing outward
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1,4 1,1 4,1" />
          <polyline points="8,1 11,1 11,4" />
          <polyline points="11,8 11,11 8,11" />
          <polyline points="4,11 1,11 1,8" />
        </svg>
      )}
    </PaneIconBtn>
  )
}

// ─── Icon buttons ────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <PaneIconBtn title={title} onClick={onClick}>
      {children}
    </PaneIconBtn>
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
      fontSize: '11px', color: '#8C887F', letterSpacing: '0.02em',
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
      <span style={{ fontSize: '13px', color: '#8C887F', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  )
}
