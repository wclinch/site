'use client'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useApp } from '@/context/AppContext'
import { getFile } from '@/lib/idb'
import type { QueuedSource } from '@/lib/types'
import { notify } from './NotificationsPanel'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Center column — single View with a tab strip.
export default function ReaderPanel({
  isFocused, onFocusToggle, hidden,
}: {
  isFocused: boolean
  onFocusToggle: () => void
  hidden?: boolean
}) {
  const {
    selectedSource,
    viewTabs, activeViewTabId,
    openInView, openUrlInView, closeViewTab,
    uploadFiles, patchSource,
    sources, allSources, activeId, addSourceToSession, removeSourceFromProject,
  } = useApp()

  const activeViewTab = viewTabs.find(t => t.id === activeViewTabId) ?? null
  const viewPage = activeViewTab?.url
    ? { url: activeViewTab.url, title: activeViewTab.title ?? '' }
    : null

  function handleClose() {
    if (activeViewTabId) closeViewTab(activeViewTabId)
  }

  function handleDrop(srcId: string) {
    const src = sources.find(s => s.id === srcId)
    if (!src) {
      if (activeId) {
        addSourceToSession(srcId, activeId)
        const pid = activeId
        const prevTabId = activeViewTabId
        setTimeout(() => openInView(srcId), 50)
        notify('Opened', () => {
          if (prevTabId) closeViewTab(prevTabId)
          removeSourceFromProject(srcId, pid)
        })
      }
      return
    }
    if (src.fileType === 'url') openUrlInView(src.url ?? src.raw, src.label ?? '', src.id)
    else openInView(srcId)
  }

  const hasContent = !!(viewPage || selectedSource)

  return (
    <div style={{ flexGrow: hidden ? 0 : 1, flexShrink: 1, flexBasis: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'flex-grow 0.22s ease' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '7px', display: 'flex', flexDirection: 'column' }}>
        <ViewPane
          viewId={1}
          source={viewPage ? null : selectedSource}
          viewPage={viewPage}
          isHidden={false}
          onClose={hasContent ? handleClose : undefined}
          onSelectId={handleDrop}
          onDropUrl={(url, title) => openUrlInView(url, title)}
          uploadFiles={uploadFiles}
          patchSource={patchSource}
          isFocused={isFocused}
          isExpanded={isFocused}
          onFocusToggle={onFocusToggle}
        />
      </div>
    </div>
  )
}

// ─── View pane ───────────────────────────────────────────────────────────────

function ViewPane({
  viewId, source, viewPage, isHidden,
  onClose, onSelectId, onDropUrl, uploadFiles, patchSource,
  isFocused, isExpanded, onFocusToggle,
}: {
  viewId: 1
  source: QueuedSource | null
  viewPage: { url: string; title: string } | null
  isHidden: boolean
  onClose?: () => void
  onSelectId: (id: string) => void
  onDropUrl?: (url: string, title: string) => void
  uploadFiles: (files: FileList | File[]) => Promise<void>
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
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

  return (
    <div
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        border: `1px solid ${dragOver ? 'rgba(230,226,216,0.45)' : 'rgba(230,226,216,0.1)'}`, borderRadius: '4px',
        overflow: 'hidden',
        background: '#070807',
        position: 'relative',
        transition: 'border-color 0.15s ease',
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
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,8,7,0.55)',
        }}>
          <span style={{ fontSize: '12px', color: '#E6E2D8', letterSpacing: '0.03em' }}>
            Drop to open
          </span>
        </div>
      )}
      <ViewTabStrip onClose={onClose} isFocused={!!isFocused} isExpanded={!!isExpanded} onFocusToggle={onFocusToggle} viewPage={viewPage} />
      {viewPage
        ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 1px 1px', cursor: 'default' }}>
            <div ref={viewportRef} style={{ flex: 1, minHeight: 0, background: '#070807', WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
          </div>
        )
        : source
          ? <SourceContent source={source} patchSource={patchSource} isFocused={!!isFocused} />
          : <EmptySource uploadFiles={uploadFiles} />
      }
    </div>
  )
}

// ─── Source content router ───────────────────────────────────────────────────

function SourceContent({
  source, patchSource, isFocused,
}: {
  source: QueuedSource
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  isFocused?: boolean
}) {
  if (source.fileType === 'note')  return <NoteEditor  source={source} patchSource={patchSource} />
  if (source.fileType === 'pdf')   return <PdfViewer   source={source} isFocused={isFocused} />
  if (source.fileType === 'image') return <ImageViewer source={source} />
  return (
    <div style={{ flex: 1, background: '#070807', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Empty label="Unsupported file type" />
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
        flex: 1,
        background: fileDragOver ? '#0c0e0c' : '#070807',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px', gap: '0',
        transition: 'background 0.15s',
        cursor: 'default',
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
      {fileDragOver ? (
        <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.03em', userSelect: 'none' }}>
          Drop to open.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '360px', userSelect: 'none' }}>
          <span style={{ fontSize: '12px', color: 'rgba(230,226,216,0.35)', letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.7, marginBottom: '6px', whiteSpace: 'nowrap' }}>
            Select a source from the shelf to open it here.
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.2)', letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.7, marginBottom: '24px', whiteSpace: 'nowrap' }}>
            Sources stack as tabs — switch between them at the top.
          </span>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              height: '26px', padding: '0 14px',
              background: 'none',
              border: '1px solid rgba(230,226,216,0.1)',
              borderRadius: '4px',
              color: 'rgba(230,226,216,0.3)',
              fontSize: '11px', letterSpacing: '0.02em',
              cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              transition: 'color 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.6)'; e.currentTarget.style.borderColor = 'rgba(230,226,216,0.22)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(230,226,216,0.3)'; e.currentTarget.style.borderColor = 'rgba(230,226,216,0.1)' }}
          >
            Open file…
          </button>
        </div>
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

// ─── Tab strip (replaces PaneHeader) ─────────────────────────────────────────

function ViewTabStrip({
  onClose, isFocused, isExpanded, onFocusToggle, viewPage,
}: {
  onClose?: () => void
  isFocused: boolean
  isExpanded: boolean
  onFocusToggle?: () => void
  viewPage: { url: string; title: string } | null
}) {
  const { viewTabs, activeViewTabId, activeId, closeViewTab, switchViewTab, reorderViewTabs, allSources } = useApp()
  const [dropVisualId, setDropVisualId] = useState<string | null>(null)
  const dragTabIdRef    = useRef<string | null>(null)
  const dropTargetIdRef = useRef<string | null>(null)

  function tabLabel(tab: import('@/lib/types').ViewTab): string {
    if (tab.srcId) {
      const src = allSources.find(s => s.id === tab.srcId)
      return src?.label || src?.raw || 'Document'
    }
    if (tab.url) {
      if (tab.title) return tab.title
      try { return new URL(tab.url).hostname.replace(/^www\./, '') } catch { return tab.url }
    }
    return 'View'
  }

  return (
    <div
      style={{
        height: '44px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 4px 0 8px',
        borderBottom: '1px solid rgba(230,226,216,0.1)',
        gap: '2px',
        WebkitAppRegion: 'no-drag',
        overflow: 'hidden',
      } as React.CSSProperties}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('application/x-proof-view-tab-id')) e.preventDefault()
      }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
          dropTargetIdRef.current = null; setDropVisualId(null)
        }
      }}
      onDrop={e => {
        const fromId = e.dataTransfer.getData('application/x-proof-view-tab-id')
        const toId   = dropTargetIdRef.current
        if (fromId && toId && fromId !== toId) reorderViewTabs(fromId, toId)
        dragTabIdRef.current = null; dropTargetIdRef.current = null; setDropVisualId(null)
      }}
    >
      {/* Tabs */}
      {viewTabs.map(tab => {
        const isActive = tab.id === activeViewTabId
        const label = tabLabel(tab)
        const dragUrl = tab.url ? { url: tab.url, title: tab.title ?? tab.url } : undefined
        return (
          <TabChip
            key={tab.id}
            label={label}
            active={isActive}
            dragUrl={dragUrl}
            srcId={tab.srcId}
            dragBefore={dropVisualId === tab.id && dragTabIdRef.current !== tab.id}
            onClick={() => switchViewTab(tab.id)}
            onClose={e => { e.stopPropagation(); closeViewTab(tab.id) }}
            onDragStart={() => {
              dragTabIdRef.current = tab.id
              window.dispatchEvent(new CustomEvent('proof:drag-active', { detail: { originalSessionId: activeId } }))
            }}
            onDragEnd={e => {
              dragTabIdRef.current = null; setDropVisualId(null)
              window.dispatchEvent(new CustomEvent('proof:drag-done', { detail: { canceled: e.dataTransfer.dropEffect === 'none' } }))
            }}
            onDragOver={e => {
              if (!e.dataTransfer.types.includes('application/x-proof-view-tab-id')) return
              e.preventDefault(); e.stopPropagation()
              if (dropTargetIdRef.current !== tab.id) {
                dropTargetIdRef.current = tab.id; setDropVisualId(tab.id)
              }
            }}
            tabId={tab.id}
          />
        )
      })}
      {viewTabs.length === 0 && (
        <span style={{
          height: '28px', padding: '0 12px',
          display: 'inline-flex', alignItems: 'center',
          borderRadius: '4px', background: '#151615', border: '1px solid rgba(230,226,216,0.1)',
          fontSize: '13px', color: '#E6E2D8', letterSpacing: '0.01em',
          userSelect: 'none', marginLeft: '4px', flexShrink: 0,
        }}>
          View
        </span>
      )}
      <div style={{ flex: 1 }} />
      {onFocusToggle && <FocusBtn active={isExpanded} onClick={onFocusToggle} />}
      {onClose && <IconBtn onClick={onClose} title="Close"><CloseIcon /></IconBtn>}
    </div>
  )
}

function TabChip({
  label, active, dragUrl, srcId, dragBefore, onClick, onClose, onDragStart, onDragEnd, onDragOver, tabId,
}: {
  label: string
  active: boolean
  dragUrl?: { url: string; title: string }
  srcId?: string
  dragBefore?: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
  onDragStart?: () => void
  onDragEnd?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  tabId: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/x-proof-view-tab-id', tabId)
        if (srcId) e.dataTransfer.setData('application/x-proof-source-id', srcId)
        if (dragUrl) e.dataTransfer.setData('application/x-proof-web-url', JSON.stringify(dragUrl))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={e => onDragEnd?.(e)}
      onDragOver={onDragOver}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        height: '28px', padding: '0 8px 0 12px',
        borderRadius: '4px',
        background: active ? '#151615' : hov ? 'rgba(21,22,21,0.5)' : 'none',
        border: `1px solid ${active ? 'rgba(230,226,216,0.1)' : 'transparent'}`,
        borderLeft: dragBefore ? '2px solid rgba(230,226,216,0.65)' : active ? '1px solid rgba(230,226,216,0.1)' : '1px solid transparent',
        fontSize: '13px', color: active ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
        letterSpacing: '0.01em', userSelect: 'none', cursor: 'grab', flexShrink: 0,
        maxWidth: '160px', overflow: 'hidden',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <button
        onClick={onClose}
        style={{
          flexShrink: 0, width: '16px', height: '16px',
          display: hov || active ? 'flex' : 'none',
          alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none',
          color: 'rgba(230,226,216,0.55)', lineHeight: 0,
          borderRadius: '2px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#E6E2D8')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(230,226,216,0.55)')}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M1 1L7 7M7 1L1 7" />
        </svg>
      </button>
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
    <div style={{ flex: 1, overflow: 'auto', background: '#070807', display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Note."
        style={{
          flex: 1, width: '100%', minHeight: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', padding: '20px 24px',
          fontSize: '13px', lineHeight: 1.8, color: 'rgba(230,226,216,0.65)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Zoom cursors ─────────────────────────────────────────────────────────────

// Shadow layer (black, thick) drawn first, then white on top — visible on both light PDFs and dark backgrounds
const CURSOR_IN  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 22 22'%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='black' stroke-width='3.5' stroke-opacity='0.55'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-opacity='0.55'/%3E%3Cline x1='9' y1='6' x2='9' y2='12' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-opacity='0.55'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-opacity='0.55'/%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='white' stroke-width='2'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='9' y1='6' x2='9' y2='12' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, zoom-in`
const CURSOR_OUT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 22 22'%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='black' stroke-width='3.5' stroke-opacity='0.55'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-opacity='0.55'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-opacity='0.55'/%3E%3Ccircle cx='9' cy='9' r='6.5' fill='none' stroke='white' stroke-width='2'/%3E%3Cline x1='6' y1='9' x2='12' y2='9' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='14' y1='14' x2='20' y2='20' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, zoom-out`

// ─── Image viewer ────────────────────────────────────────────────────────────

function ImageViewer({ source }: { source: QueuedSource }) {
  const [imgUrl,     setImgUrl]     = useState<string | null>(null)
  const [zoomed,     setZoomed]     = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null)
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

  // Scroll so clicked pixel stays under cursor after zoom
  useLayoutEffect(() => {
    if (!zoomed || !zoomOrigin || !containerRef.current) return
    const container = containerRef.current
    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img) return
    const doScroll = () => {
      container.scrollLeft = Math.max(0, img.naturalWidth  * zoomOrigin.x - zoomOrigin.vx)
      container.scrollTop  = Math.max(0, img.naturalHeight * zoomOrigin.y - zoomOrigin.vy)
    }
    if (reducedMotion) doScroll(); else requestAnimationFrame(doScroll)
  }, [zoomed, zoomOrigin, reducedMotion])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomed) { setZoomed(false); setZoomOrigin(null); return }
    const img = (e.currentTarget as HTMLDivElement).querySelector('img')
    if (!img) return
    const imgRect       = img.getBoundingClientRect()
    const containerRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    setZoomOrigin({
      x:  Math.max(0, Math.min(1, (e.clientX - imgRect.left) / imgRect.width)),
      y:  Math.max(0, Math.min(1, (e.clientY - imgRect.top)  / imgRect.height)),
      vx: e.clientX - containerRect.left,
      vy: e.clientY - containerRect.top,
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
            userSelect: 'none',
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

function PdfViewer({ source, isFocused }: { source: QueuedSource; isFocused?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  const [zoomed,    setZoomed]    = useState(false)
  const [clickPos,  setClickPos]  = useState<{ cx: number; cy: number; vx: number; vy: number } | null>(null)
  const [fileUrl,   setFileUrl]   = useState<string | null>(null)
  const [numPages,  setNumPages]  = useState(0)
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

  useEffect(() => { setZoomed(false); setClickPos(null) }, [source.id])

  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  // After zoom re-render, scroll so the clicked pixel stays under the cursor
  useLayoutEffect(() => {
    if (!containerRef.current || !clickPos) return
    const el = containerRef.current
    if (zoomed) {
      // Just zoomed in (1x → 1.75x): cx/cy are in 1x content space
      el.scrollLeft = Math.max(0, clickPos.cx * 1.75 - clickPos.vx)
      el.scrollTop  = Math.max(0, clickPos.cy * 1.75 - clickPos.vy)
    } else {
      // Just zoomed out (1.75x → 1x): cx/cy are in 1.75x content space
      el.scrollLeft = Math.max(0, clickPos.cx / 1.75 - clickPos.vx)
      el.scrollTop  = Math.max(0, clickPos.cy / 1.75 - clickPos.vy)
    }
  }, [zoomed, clickPos])

  const baseWidth = isFocused ? Math.min(containerWidth - 32, 520) : (containerWidth - 32)
  const pageWidth = zoomed ? baseWidth * 1.75 : baseWidth

  return (
    <div
      ref={containerRef}
      onMouseDown={e => {
        if (e.button === 0 && fileUrl && !loadError) {
          e.preventDefault()
          const el = containerRef.current
          if (el) {
            const rect = el.getBoundingClientRect()
            const vx = e.clientX - rect.left
            const vy = e.clientY - rect.top
            setClickPos({ cx: el.scrollLeft + vx, cy: el.scrollTop + vy, vx, vy })
          }
          setZoomed(z => !z)
        }
      }}
      style={{
        flex: 1, overflow: 'auto', background: '#070807',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        WebkitAppRegion: 'no-drag',
        userSelect: 'none',
        cursor: fileUrl && !loadError ? (zoomed ? CURSOR_OUT : CURSOR_IN) : 'default',
      } as React.CSSProperties}
    >
      {source.status === 'queued'           && <Msg>Waiting…</Msg>}
      {source.status === 'extracting'       && <Msg>Opening…</Msg>}
      {source.status === 'done' && !fileUrl && <Msg>Opening…</Msg>}
      {source.status === 'error'            && <Msg>{source.error ?? 'Failed to open.'}</Msg>}
      {source.status === 'done' && loadError && <Msg>Could not read this file.</Msg>}
      {source.status === 'done' && fileUrl && !loadError && (
        <div style={{ margin: 'auto 0', padding: '16px 0' }}>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoadError(false) }}
            onLoadError={() => setLoadError(true)}
            loading={<Msg>Opening…</Msg>}
            error={null}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', marginBottom: i < numPages - 1 ? '8px' : 0 }}>
                <Page pageNumber={i + 1} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
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
        color: active ? '#E6E2D8' : hov ? '#E6E2D8' : 'rgba(230,226,216,0.65)',
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
      fontSize: '11px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.02em',
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
      <span style={{ fontSize: '13px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  )
}
