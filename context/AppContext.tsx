'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Thread } from '@/lib/types'
import {
  ACTIVE_KEY, SELECTED_KEY, SELECTED_KEY_2, STACK_KEY,
  newThread as createThread,
  loadThreads,
  migrateStorage,
} from '@/lib/storage'
import { getFile, storeContent, getContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'
import { LIMITS } from '@/lib/entitlement'
import type { Limits } from '@/lib/entitlement'
import type { AppState } from './appTypes'
import { useSelection } from './hooks/useSelection'
import { useViewTabs, migrateToViewTabs } from './hooks/useViewTabs'
import { useWorkspacePersistence } from './hooks/useWorkspacePersistence'
import { useSources } from './hooks/useSources'
import { useWorkspaceActions } from './hooks/useWorkspaceActions'

// ─── Module-level constants ──────────────────────────────────────────────────

// Legacy id from the pre-refactor "floating sources" model. Kept only so
// old persisted state can be migrated on load — no new code writes it.
const INBOX_ID = '__inbox__'

const AppContext = createContext<AppState | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {

  // ─── State ──────────────────────────────────────────────────────────────

  const [mounted, setMounted]   = useState(false)
  const [threads, setThreads]   = useState<Thread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const { selectedIds, anchorId, contextMenu, setSelectedIds, setAnchorId, setContextMenu } = useSelection()

  // Snapshot the last active thread ID before effects can update it,
  // so the mount effect can restore the correct thread on reload.
  const [lastActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
  })

  const {
    viewTabs, activeViewTabId, activeViewTab,
    openInView, openUrlInView, closeViewTab, switchViewTab, reorderViewTabs,
    setViewTabs, setActiveViewTabId, viewTabsRef, activeViewTabIdRef,
  } = useViewTabs()

  // ─── Refs ───────────────────────────────────────────────────────────────

  const threadsRef = useRef<Thread[]>([])
  const activeIdRef = useRef(activeId)

  // Sync ref so async callbacks always see the latest activeId.
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // ─── Derived ────────────────────────────────────────────────────────────

  const activeThread      = threads.find(p => p.id === activeId) ?? null
  const selectedId        = activeViewTab?.srcId ?? null
  const namedThreadCount  = threads.length

  // ─── Hooks ──────────────────────────────────────────────────────────────

  const { saveThread, readResearchTabs, loadResearchTabs } = useWorkspacePersistence({
    threads, mounted, activeId, viewTabs, activeViewTabId,
    setThreads, threadsRef, activeIdRef, viewTabsRef, activeViewTabIdRef,
  })

  const {
    sources, allSources, selectedSource,
    updateThread, patchSource, moveSource, moveSourceToThread,
    uploadFiles, removeSource, removeSelected, restoreArchivedSource,
    addSourceToThread, addUrlToThread, removeSourceFromThread, addUrl,
  } = useSources({
    threads, activeId, selectedIds, selectedId,
    setThreads, setSelectedIds, setAnchorId,
    activeIdRef, threadsRef, viewTabsRef,
    closeViewTab, openInView,
  })

  const {
    switchThread, newThread,
    removeThread, removeThreadSoft, commitThreadRemoval, restoreThread,
  } = useWorkspaceActions({
    threads, activeId, namedThreadCount,
    setThreads, setActiveId,
    setSelectedIds, setAnchorId,
    threadsRef, viewTabsRef, activeViewTabIdRef,
    setViewTabs, setActiveViewTabId,
    readResearchTabs, loadResearchTabs,
  })

  // ─── Effects: Load / restore ────────────────────────────────────────────
  // Note: this effect crosses multiple domains (sources, view tabs, threads)
  // and is left here until those domains have their own hooks extracted.

  useEffect(() => {
    // Migrate proof-v3-* keys to site-v3-* on first run after app rename.
    migrateStorage()

    const saved = loadThreads()
    let fixed: Thread[] = []

    if (saved.length) {
      // Normalize statuses: anything that was mid-extract when the app last
      // closed gets re-queued so we don't render it as "extracting" forever.
      fixed = saved.map(proj => ({
        ...proj,
        sources: proj.sources.map(src =>
          src.status === 'extracting' ? { ...src, status: 'queued' as const } : src
        ),
      }))

      // Migration from the pre-refactor "inbox" model. If a legacy inbox
      // thread exists with sources, fold them into the first named
      // thread (or create a "Default" thread if there are none), then
      // drop the inbox entirely. New model: no floating sources.
      const inbox = fixed.find(p => p.id === INBOX_ID)
      let named   = fixed.filter(p => p.id !== INBOX_ID)
      if (inbox && inbox.sources.length > 0) {
        if (named.length > 0) {
          named = named.map((p, i) =>
            i === 0 ? { ...p, sources: [...p.sources, ...inbox.sources] } : p
          )
        } else {
          const def = createThread(1)
          def.name    = 'Default'
          def.sources = inbox.sources
          named = [def]
        }
      }
      fixed = named
      if (fixed.length === 0) {
        const def = createThread(1)
        def.name = 'New Thread'
        fixed = [def]
      }
      setThreads(fixed)

      // Drop any orphaned legacy keys.
      try { localStorage.removeItem(STACK_KEY) } catch {}
      try { localStorage.removeItem('site-v3-selected-image') } catch {}

      // Auto-restore the last active thread (or fall back to the first one)
      // and its saved view tabs.
      const restoredId   = fixed.find(p => p.id === lastActiveId)?.id ?? fixed[0].id
      const restoredProj = fixed.find(p => p.id === restoredId)
      setActiveId(restoredId)

      // Migrate legacy sel1/sel2/view1Page/view2Page to tab model.
      const { viewTabs: initTabs, activeViewTabId: initActiveId } =
        migrateToViewTabs(restoredProj, fixed.flatMap(p => p.sources))
      setViewTabs(initTabs)
      setActiveViewTabId(initActiveId)

      // Clean up legacy localStorage keys.
      try { localStorage.removeItem(SELECTED_KEY) }   catch {}
      try { localStorage.removeItem(SELECTED_KEY_2) } catch {}

      // Restore research tabs for the active thread on startup.
      loadResearchTabs(restoredProj?.researchTabs ?? [], restoredId)

      // Re-extract PDF content for any source that's `done` but missing
      // its parsed body in IDB (e.g. interrupted extraction in a prior
      // session). Notes / images / URLs are skipped.
      ;(async () => {
        for (const proj of fixed) {
          for (const src of proj.sources) {
            if (src.status !== 'done') continue
            if (src.fileType === 'image' || src.fileType === 'note' || src.fileType === 'url') continue
            try {
              let content = await getContent(src.id) as import('@/lib/types').DocContent | null
              if (!content) {
                const file = await getFile(src.id)
                if (file) {
                  content = await extractContent(file)
                  storeContent(src.id, content).catch(() => {})
                }
              }
              if (content) patchSource(proj.id, src.id, { content })
              else         patchSource(proj.id, src.id, { status: 'queued' as const, error: null })
            } catch {
              patchSource(proj.id, src.id, { status: 'queued' as const, error: null })
            }
          }
        }
      })()
    } else {
      // First launch — default thread.
      const def = createThread(1)
      def.name = 'New Thread'
      setThreads([def])
      setActiveId(def.id)
    }

    setMounted(true)
  }, [])

  // ─── Context value ──────────────────────────────────────────────────────

  const value: AppState = {
    mounted, threads, activeId, selectedId, selectedIds, anchorId,
    contextMenu,
    activeThread, sources, allSources, selectedSource,
    viewTabs, activeViewTabId, openInView, openUrlInView, closeViewTab, switchViewTab, reorderViewTabs,
    limits: LIMITS,
    setSelectedIds, setAnchorId,
    setContextMenu,
    setThreads, updateThread, patchSource, moveSource, moveSourceToThread,
    uploadFiles,
    removeSource, removeSelected, addSourceToThread, addUrlToThread, removeSourceFromThread,
    restoreArchivedSource,
    addUrl,
    switchThread, newThread, saveThread, removeThread, removeThreadSoft, commitThreadRemoval, restoreThread,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { STORAGE_LIMIT_BYTES }
export type { Limits }
