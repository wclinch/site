'use client'
import { useEffect, useRef, Dispatch, SetStateAction, RefObject } from 'react'
import type { Thread, SavedResearchTab, ViewTab } from '@/lib/types'
import { ACTIVE_KEY, saveThreads } from '@/lib/storage'

interface PersistenceParams {
  threads: Thread[]
  mounted: boolean
  activeId: string | null
  viewTabs: ViewTab[]
  activeViewTabId: string | null
  setThreads: Dispatch<SetStateAction<Thread[]>>
  threadsRef: RefObject<Thread[]>
  activeIdRef: RefObject<string | null>
  viewTabsRef: RefObject<ViewTab[]>
  activeViewTabIdRef: RefObject<string | null>
}

export interface PersistenceResult {
  saveThread: (name?: string) => void
  readResearchTabs: () => SavedResearchTab[]
  loadResearchTabs: (tabs: SavedResearchTab[], threadId?: string) => void
}

export function useWorkspacePersistence({
  threads, mounted, activeId,
  viewTabs, activeViewTabId,
  setThreads,
  threadsRef, activeIdRef, viewTabsRef, activeViewTabIdRef,
}: PersistenceParams): PersistenceResult {
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function readResearchTabs(): SavedResearchTab[] {
    try {
      const raw = JSON.parse(localStorage.getItem('site-v3-research-tabs') || '[]')
      return Array.isArray(raw)
        ? raw
            .filter((t: { url?: string }) => t.url)
            .map((t: { url: string; title?: string; active?: boolean }) => ({
              url: t.url, title: t.title || '', active: t.active ?? false,
            }))
        : []
    } catch { return [] }
  }

  function loadResearchTabs(tabs: SavedResearchTab[], threadId?: string) {
    try {
      if (tabs.length > 0) {
        localStorage.setItem(
          'site-v3-research-tabs',
          JSON.stringify(tabs.map((t, i) => ({ id: `tab-A-r${i}`, url: t.url }))),
        )
      } else {
        localStorage.removeItem('site-v3-research-tabs')
      }
    } catch {}
    if (typeof window !== 'undefined') {
      ;(window as any).electronAPI?.research?.loadWorkspace?.({ workspaceId: threadId ?? '', tabs })
    }
  }

  function saveThread(name?: string) {
    if (!activeId) return
    const researchTabs = readResearchTabs()
    setThreads(ps => ps.map(p => {
      if (p.id !== activeId) return p
      return { ...p, viewTabs, activeViewTabId, researchTabs, ...(name !== undefined ? { name } : {}) }
    }))
  }

  // Persist threads to localStorage on every change after mount.
  useEffect(() => {
    threadsRef.current = threads
    if (mounted) saveThreads(threads)
  }, [threads, mounted])

  // Snapshot full thread state before unload so nothing is lost on close.
  useEffect(() => {
    function onBeforeUnload() {
      let researchTabs: SavedResearchTab[] = []
      try {
        const raw = JSON.parse(localStorage.getItem('site-v3-research-tabs') || '[]')
        researchTabs = Array.isArray(raw)
          ? raw.filter((t: { url?: string }) => t.url)
               .map((t: { url: string; title?: string; active?: boolean }) => ({
                 url: t.url, title: t.title || '', active: t.active ?? false,
               }))
          : []
      } catch {}
      const curId = activeIdRef.current
      const snap  = threadsRef.current.map(p => p.id !== curId ? p : {
        ...p,
        viewTabs: viewTabsRef.current,
        activeViewTabId: activeViewTabIdRef.current,
        researchTabs,
      })
      saveThreads(snap)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Keep the active thread key in sync so the Electron layer can read it.
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else          localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])

  // Debounced auto-save whenever view tab state or active thread changes.
  useEffect(() => {
    if (!mounted || !activeId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { saveThread() }, 400)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // saveThread intentionally omitted — it reads from closure, not a stable ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTabs, activeViewTabId, activeId, mounted])

  return { saveThread, readResearchTabs, loadResearchTabs }
}
