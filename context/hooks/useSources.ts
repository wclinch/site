'use client'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import type { Thread, Source, ViewTab } from '@/lib/types'
import {
  STACK_LIMIT, newSource, newUrlSource,
} from '@/lib/storage'
import { LIMITS } from '@/lib/entitlement'
import { storeFile, deleteFile, storeContent, deleteContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { wouldExceedLimit } from '@/lib/storage-limit'

const MAX_BATCH   = 10
const MAX_FILE_MB = 100

function warn(msg: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('site-storage-warning', { detail: msg }))
}

function notifyStorageChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('site-storage-changed'))
}

interface SourcesParams {
  threads: Thread[]
  activeId: string | null
  selectedIds: Set<string>
  selectedId: string | null
  setThreads: Dispatch<SetStateAction<Thread[]>>
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  activeIdRef: RefObject<string | null>
  threadsRef: RefObject<Thread[]>
  viewTabsRef: RefObject<ViewTab[]>
  closeViewTab: (tabId: string) => void
  openInView: (srcId: string) => void
}

export interface SourcesResult {
  sources: Source[]
  allSources: Source[]
  selectedSource: Source | null
  updateThread: (id: string, patch: Partial<Thread>) => void
  patchSource: (threadId: string, srcId: string, patch: Partial<Source>) => void
  moveSource: (srcId: string, toIndex: number) => void
  moveSourceToThread: (srcId: string, targetThreadId: string) => void
  uploadFiles: (files: FileList | File[], targetThreadId?: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  restoreArchivedSource: (srcId: string, threadId: string) => void
  addSourceToThread: (srcId: string, toThreadId: string) => string | null
  addUrlToThread: (threadId: string, url: string, title: string) => { name: string | null; srcId: string } | null
  removeSourceFromThread: (srcId: string, threadId: string) => void
  addUrl: (url: string, targetThreadId?: string, label?: string) => Promise<void>
}

export function useSources({
  threads, activeId, selectedIds, selectedId,
  setThreads, setSelectedIds, setAnchorId,
  activeIdRef, threadsRef, viewTabsRef,
  closeViewTab, openInView,
}: SourcesParams): SourcesResult {

  // ─── Derived reads ────────────────────────────────────────────────────────────

  const activeThread   = threads.find(p => p.id === activeId) ?? null
  const sources        = activeThread?.sources ?? []
  const allSources     = threads.flatMap(p => p.sources)
  const selectedSource = allSources.find(s => s.id === selectedId) ?? null

  // ─── Thread / source helpers ──────────────────────────────────────────────────

  function updateThread(id: string, patch: Partial<Thread>) {
    setThreads(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  // threadId is kept in signature for backward compat but ignored — scans all threads.
  function patchSource(_threadId: string, srcId: string, patch: Partial<Source>) {
    setThreads(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s => s.id === srcId ? { ...s, ...patch } : s),
    })))
  }

  function moveSource(srcId: string, toIndex: number) {
    setThreads(ps => ps.map(p => {
      if (!p.sources.some(s => s.id === srcId)) return p
      const from = p.sources.findIndex(s => s.id === srcId)
      if (from === -1) return p
      const arr = [...p.sources]
      const [item] = arr.splice(from, 1)
      arr.splice(toIndex, 0, item)
      return { ...p, sources: arr }
    }))
  }

  function moveSourceToThread(srcId: string, targetThreadId: string) {
    setThreads(ps => {
      const src = ps.flatMap(p => p.sources).find(s => s.id === srcId)
      if (!src) return ps
      const currentThread = ps.find(p => p.sources.some(s => s.id === srcId))
      if (currentThread?.id === targetThreadId) return ps
      const target = ps.find(p => p.id === targetThreadId)
      if (target && target.sources.length >= STACK_LIMIT) {
        warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`)
        return ps
      }
      return ps.map(p => {
        if (p.sources.some(s => s.id === srcId)) return { ...p, sources: p.sources.filter(s => s.id !== srcId) }
        if (p.id === targetThreadId)              return { ...p, sources: [...p.sources, src] }
        return p
      })
    })
  }

  // ─── Document actions ─────────────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[], targetThreadId?: string) {
    const threadId = targetThreadId ?? activeIdRef.current
    if (!threadId) return

    const isImage = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
    const isPdf   = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')

    let list = Array.from(files).filter(f => isPdf(f) || isImage(f)).slice(0, MAX_BATCH)

    const currentAllSources = threadsRef.current.flatMap(p => p.sources)
    list = list.filter(f => !currentAllSources.some(s => s.label === f.name))
    if (!list.length) return

    if (isFinite(LIMITS.docCount)) {
      const uploadedCount = currentAllSources.filter(
        s => s.fileType === 'pdf' || s.fileType === 'image'
      ).length
      if (uploadedCount >= LIMITS.docCount) {
        warn(`Document limit reached (${LIMITS.docCount}). Remove some to add more.`)
        return
      }
      const countRoom = LIMITS.docCount - uploadedCount
      if (list.length > countRoom) list = list.slice(0, countRoom)
    }

    const targetThread = threadsRef.current.find(p => p.id === threadId)
    const room         = STACK_LIMIT - (targetThread?.sources.length ?? 0)
    if (room <= 0) { warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`); return }
    if (list.length > room) list = list.slice(0, room)

    const batchBytes = list.reduce((sum, f) => sum + f.size, 0)
    if (await wouldExceedLimit(batchBytes, LIMITS.storageBytes)) {
      warn(`Storage limit reached (${Math.round(LIMITS.storageBytes / 1024 / 1024)}MB). Remove Documents to free space.`)
      return
    }

    const newSources = list.map(f => ({
      ...newSource(`file:${f.name}`, f.name),
      fileType: (isImage(f) ? 'image' : 'pdf') as 'pdf' | 'image',
      fileSize: f.size,
    }))

    setThreads(ps => ps.map(p =>
      p.id !== threadId ? p : { ...p, sources: [...p.sources, ...newSources] }
    ))

    if (threadId === activeIdRef.current && newSources.length > 0) {
      openInView(newSources[0].id)
    }

    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      const src  = newSources[i]
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        patchSource(threadId, src.id, { status: 'error', error: `File too large (max ${MAX_FILE_MB}MB)` })
        continue
      }
      try {
        await storeFile(src.id, file)
        notifyStorageChanged()
        if (src.fileType === 'image') {
          patchSource(threadId, src.id, { status: 'done' })
        } else {
          patchSource(threadId, src.id, { status: 'extracting' })
          const content = await extractContent(file)
          await storeContent(src.id, content).catch(() => {})
          patchSource(threadId, src.id, { status: 'done', content })
        }
      } catch (err) {
        patchSource(threadId, src.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to process file — try again.',
        })
      }
    }
  }

  function removeSource(srcId: string) {
    let srcThreadId: string | null = null
    let src: Source | undefined
    for (const p of threadsRef.current) {
      const found = p.sources.find(s => s.id === srcId)
      if (found) { src = found; srcThreadId = p.id; break }
    }
    if (src && srcThreadId) {
      try {
        const key = `site-archive-${srcThreadId}`
        const archived = JSON.parse(localStorage.getItem(key) || '[]')
        archived.unshift({ source: src, threadId: srcThreadId, deletedAt: Date.now() })
        localStorage.setItem(key, JSON.stringify(archived.slice(0, 50)))
      } catch {}
    }
    setThreads(ps => ps.map(p => ({ ...p, sources: p.sources.filter(s => s.id !== srcId) })))
    const removedTab = viewTabsRef.current.find(t => t.srcId === srcId)
    if (removedTab) closeViewTab(removedTab.id)
    setSelectedIds(new Set())
    setAnchorId(null)
    Promise.allSettled([deleteFile(srcId), deleteContent(srcId)]).then(notifyStorageChanged)
  }

  function removeSelected() {
    if (!selectedIds.size) return
    setThreads(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => !selectedIds.has(s.id)),
    })))
    const removedTabs = viewTabsRef.current.filter(t => t.srcId && selectedIds.has(t.srcId))
    removedTabs.forEach(t => closeViewTab(t.id))
    const ids = Array.from(selectedIds)
    Promise.allSettled(ids.flatMap(id => [deleteFile(id), deleteContent(id)])).then(notifyStorageChanged)
    setSelectedIds(new Set())
    setAnchorId(null)
  }

  function restoreArchivedSource(srcId: string, threadId: string) {
    const key = `site-archive-${threadId}`
    try {
      const archived: Array<{ source: Source; threadId: string; deletedAt: number }> =
        JSON.parse(localStorage.getItem(key) || '[]')
      const entry = archived.find(e => e.source.id === srcId)
      if (!entry) return
      setThreads(ps => ps.map(p =>
        p.id !== threadId ? p : { ...p, sources: [...p.sources, entry.source] }
      ))
      localStorage.setItem(key, JSON.stringify(archived.filter(e => e.source.id !== srcId)))
    } catch {}
  }

  // Adds a source reference to another thread — same ID, shared IDB data, stays in origin too.
  function addSourceToThread(srcId: string, toThreadId: string): string | null {
    let src: Source | undefined
    for (const p of threadsRef.current) {
      const found = p.sources.find(s => s.id === srcId)
      if (found) { src = found; break }
    }
    if (!src) return null
    const toThread = threadsRef.current.find(p => p.id === toThreadId)
    if (!toThread) return null
    if (toThread.sources.some(s => s.id === srcId)) return toThread.name || 'Thread'
    const captured = src
    setThreads(ps => ps.map(p =>
      p.id !== toThreadId ? p : { ...p, sources: [...p.sources, captured] }
    ))
    if (toThreadId === activeIdRef.current && captured.fileType !== 'url') {
      openInView(srcId)
    }
    return toThread.name || 'Thread'
  }

  function addUrlToThread(threadId: string, url: string, title: string): { name: string | null; srcId: string } | null {
    const toThread = threadsRef.current.find(p => p.id === threadId)
    if (!toThread) return null
    const src = newUrlSource(url, title)
    setThreads(ps => ps.map(p =>
      p.id !== threadId ? p : { ...p, sources: [...p.sources, src] }
    ))
    return { name: toThread.name || 'Thread', srcId: src.id }
  }

  function removeSourceFromThread(srcId: string, threadId: string) {
    setThreads(ps => ps.map(p =>
      p.id !== threadId ? p : { ...p, sources: p.sources.filter(s => s.id !== srcId) }
    ))
  }

  async function addUrl(url: string, targetThreadId?: string, label?: string) {
    const threadId = targetThreadId ?? activeIdRef.current
    if (!threadId) return
    const threadNow = threadsRef.current.find(p => p.id === threadId)
    if (threadNow && threadNow.sources.length >= STACK_LIMIT) {
      warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`)
      return
    }
    const src = newUrlSource(url, label)
    setThreads(ps => ps.map(p =>
      p.id !== threadId ? p : { ...p, sources: [...p.sources, src] }
    ))
  }

  return {
    sources, allSources, selectedSource,
    updateThread, patchSource, moveSource, moveSourceToThread,
    uploadFiles, removeSource, removeSelected, restoreArchivedSource,
    addSourceToThread, addUrlToThread, removeSourceFromThread, addUrl,
  }
}
