'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Project, QueuedSource, SavedResearchTab, ViewTab } from '@/lib/types'
import {
  ACTIVE_KEY, SELECTED_KEY, SELECTED_KEY_2, STACK_KEY, STACK_LIMIT,
  newProject, newSource, newUrlSource,
  loadProjects, saveProjects,
  uid,
} from '@/lib/storage'
import { storeFile, deleteFile, getFile, storeContent, getContent, deleteContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { wouldExceedLimit, STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'
import { LIMITS } from '@/lib/entitlement'
import type { Limits } from '@/lib/entitlement'
import type { AppState, ContextMenu } from './appTypes'

// ─── Module-level constants ──────────────────────────────────────────────────

// Legacy id from the pre-refactor "floating sources" model. Kept only so
// old persisted state can be migrated on load — no new code writes it.
const INBOX_ID = '__inbox__'

const MAX_BATCH   = 10   // max files accepted in a single drop/pick
const MAX_FILE_MB = 100  // per-file size cap before we skip with an error

const AppContext = createContext<AppState | null>(null)

// Dispatches a transient warning toast (consumed by app/app/page.tsx).
function warn(msg: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('proof-storage-warning', { detail: msg }))
}

// Fires after any IDB write/delete so storage-aware UI (the badge) can re-poll.
function notifyStorageChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('proof-storage-changed'))
}

// ─── Migration helper ────────────────────────────────────────────────────────

function migrateToViewTabs(
  proj: Project | undefined,
  allSrcs: QueuedSource[] = [],
): { viewTabs: ViewTab[]; activeViewTabId: string | null } {
  if (!proj) return { viewTabs: [], activeViewTabId: null }
  // Already on the new model
  if (proj.viewTabs !== undefined) {
    return {
      viewTabs: proj.viewTabs ?? [],
      activeViewTabId: proj.activeViewTabId ?? proj.viewTabs?.[0]?.id ?? null,
    }
  }
  // Migrate from legacy sel1/sel2/view1Page/view2Page
  const tabs: ViewTab[] = []
  let firstId: string | null = null
  function add(tab: ViewTab) { tabs.push(tab); if (!firstId) firstId = tab.id }
  if (proj.view1Page) {
    add({ id: uid(), url: proj.view1Page.url, title: proj.view1Page.title, srcId: proj.view1Page.srcId })
  } else if (proj.sel1 && allSrcs.find(s => s.id === proj.sel1)) {
    add({ id: uid(), srcId: proj.sel1 })
  }
  if (proj.view2Page) {
    add({ id: uid(), url: proj.view2Page.url, title: proj.view2Page.title, srcId: proj.view2Page.srcId })
  } else if (proj.sel2 && allSrcs.find(s => s.id === proj.sel2)) {
    add({ id: uid(), srcId: proj.sel2 })
  }
  return { viewTabs: tabs, activeViewTabId: firstId }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {

  // ─── State ──────────────────────────────────────────────────────────────

  const [mounted, setMounted]         = useState(false)
  const [projects, setProjects]       = useState<Project[]>([])
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId]       = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  // Snapshot the last active workspace ID before effects can update it,
  // so the mount effect can restore the correct workspace on reload.
  const [lastActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
  })

  // Center view tabs
  const [viewTabs, setViewTabs]               = useState<ViewTab[]>([])
  const [activeViewTabId, setActiveViewTabId] = useState<string | null>(null)


  // ─── Refs ───────────────────────────────────────────────────────────────

  const projectsRef        = useRef<Project[]>([])
  const activeIdRef        = useRef(activeId)
  const viewTabsRef        = useRef<ViewTab[]>([])
  const activeViewTabIdRef = useRef<string | null>(null)
  const autoSaveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync refs on every render so async callbacks always see the latest values.
  useEffect(() => { activeIdRef.current = activeId },              [activeId])
  useEffect(() => { viewTabsRef.current = viewTabs },              [viewTabs])
  useEffect(() => { activeViewTabIdRef.current = activeViewTabId }, [activeViewTabId])

  // ─── Derived ────────────────────────────────────────────────────────────

  const activeProject     = projects.find(p => p.id === activeId) ?? null
  const sources           = activeProject?.sources ?? []
  const allSources        = projects.flatMap(p => p.sources)
  const activeViewTab     = viewTabs.find(t => t.id === activeViewTabId) ?? null
  const selectedId        = activeViewTab?.srcId ?? null
  const selectedSource    = allSources.find(s => s.id === selectedId) ?? null
  const namedProjectCount = projects.length

  // ─── Effects: UI events ─────────────────────────────────────────────────

  // Close context menu on Escape or any click outside.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // ─── Effects: Load / restore ────────────────────────────────────────────

  useEffect(() => {
    const saved = loadProjects()
    let fixed: Project[] = []

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
      // project exists with sources, fold them into the first named
      // project (or create a "Default" project if there are none), then
      // drop the inbox entirely. New model: no floating sources.
      const inbox = fixed.find(p => p.id === INBOX_ID)
      let named   = fixed.filter(p => p.id !== INBOX_ID)
      if (inbox && inbox.sources.length > 0) {
        if (named.length > 0) {
          named = named.map((p, i) =>
            i === 0 ? { ...p, sources: [...p.sources, ...inbox.sources] } : p
          )
        } else {
          const def = newProject(1)
          def.name    = 'Default'
          def.sources = inbox.sources
          named = [def]
        }
      }
      fixed = named
      if (fixed.length === 0) {
        const def = newProject(1)
        def.name = 'New Thread'
        fixed = [def]
      }
      setProjects(fixed)

      // Drop any orphaned stack-key entry from the previous model — the
      // active project's sources are the stack now and no separate list
      // is read. Also drop the legacy two-pane image-selection key.
      try { localStorage.removeItem(STACK_KEY) } catch {}
      try { localStorage.removeItem('proof-v3-selected-image') } catch {}

      // Auto-restore the last active project (or fall back to the first one)
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

      // Restore research tabs for the active workspace on startup.
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
      // First launch — default session.
      const def = newProject(1)
      def.name = 'New Thread'
      setProjects([def])
      setActiveId(def.id)
    }

    setMounted(true)
  }, [])

  // ─── Effects: Persistence ───────────────────────────────────────────────

  // Persist projects on every change after mount — including empty arrays. The
  // previous `if (projects.length)` skipped the save when the user deleted
  // the last project, letting the stale list resurrect on hard reload.
  useEffect(() => {
    projectsRef.current = projects
    if (mounted) saveProjects(projects)
  }, [projects, mounted])

  // Snapshot the full workspace state (tabs, view pins, selection) just
  // before the page unloads so nothing is lost on close/refresh.
  useEffect(() => {
    function onBeforeUnload() {
      let researchTabs: SavedResearchTab[] = []
      try {
        const raw = JSON.parse(localStorage.getItem('proof-v3-research-tabs') || '[]')
        researchTabs = Array.isArray(raw)
          ? raw.filter((t: { url?: string }) => t.url)
               .map((t: { url: string; title?: string; active?: boolean }) => ({ url: t.url, title: t.title || '', active: t.active ?? false }))
          : []
      } catch {}
      const curId = activeIdRef.current
      const snap  = projectsRef.current.map(p => p.id !== curId ? p : {
        ...p,
        viewTabs: viewTabsRef.current,
        activeViewTabId: activeViewTabIdRef.current,
        researchTabs,
      })
      saveProjects(snap)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Keep active workspace key in sync so other tabs / the Electron layer can read it.
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else          localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])

  // Auto-save workspace state whenever tab state changes.
  useEffect(() => {
    if (!mounted || !activeId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { saveWorkspace() }, 400)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTabs, activeViewTabId, activeId, mounted])

  // ─── Workspace helpers ──────────────────────────────────────────────────

  function readResearchTabs(): SavedResearchTab[] {
    try {
      const raw = JSON.parse(localStorage.getItem('proof-v3-research-tabs') || '[]')
      return Array.isArray(raw)
        ? raw.filter((t: { url?: string }) => t.url)
             .map((t: { url: string; title?: string; active?: boolean }) => ({ url: t.url, title: t.title || '', active: t.active ?? false }))
        : []
    } catch { return [] }
  }

  function loadResearchTabs(tabs: SavedResearchTab[], workspaceId?: string) {
    try {
      if (tabs.length > 0) {
        localStorage.setItem('proof-v3-research-tabs', JSON.stringify(
          tabs.map((t, i) => ({ id: `tab-A-r${i}`, url: t.url }))
        ))
      } else {
        localStorage.removeItem('proof-v3-research-tabs')
      }
    } catch {}
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).electronAPI?.research?.loadWorkspace?.({ workspaceId: workspaceId ?? '', tabs })
    }
  }

  // ─── Workspace actions ──────────────────────────────────────────────────

  function saveWorkspace(name?: string) {
    if (!activeId) return
    const researchTabs = readResearchTabs()
    setProjects(ps => ps.map(p => {
      if (p.id !== activeId) return p
      return { ...p, viewTabs, activeViewTabId, researchTabs, ...(name !== undefined ? { name } : {}) }
    }))
  }

  function switchWorkspace(id: string) {
    if (id === activeId) return
    const curId        = activeId
    const curTabs      = viewTabsRef.current
    const curActiveTab = curTabs.find(t => t.id === activeViewTabIdRef.current)
    const researchTabs = readResearchTabs()

    // Persist state of the workspace we're leaving.
    setProjects(ps => ps.map(p => p.id === curId
      ? { ...p, viewTabs: curTabs, activeViewTabId: activeViewTabIdRef.current, researchTabs }
      : p))

    const newProj = projects.find(p => p.id === id)
    setActiveId(id)
    setSelectedIds(new Set())
    setAnchorId(null)

    // Clear electron view when leaving a URL tab or when new workspace has no tabs.
    const { viewTabs: newTabs, activeViewTabId: newActiveId } =
      migrateToViewTabs(newProj, projects.flatMap(p => p.sources))
    setViewTabs(newTabs)
    setActiveViewTabId(newActiveId)

    if (typeof window !== 'undefined') {
      const newActiveTab = newTabs.find(t => t.id === newActiveId)
      if (curActiveTab?.url || !newActiveTab?.url) {
        ;(window as any).electronAPI?.view?.clear?.('1')
      }
    }

    loadResearchTabs(newProj?.researchTabs ?? [], id)
  }

  function newWorkspace() {
    const curId        = activeId
    const curTabs      = viewTabsRef.current
    const researchTabs = readResearchTabs()

    if (curId) {
      setProjects(ps => ps.map(p => p.id === curId
        ? { ...p, viewTabs: curTabs, activeViewTabId: activeViewTabIdRef.current, researchTabs }
        : p))
    }

    const p = newProject(namedProjectCount + 1)
    const usedNames = new Set(projectsRef.current.map(w => w.name))
    let sessionName = 'New Thread'
    if (usedNames.has(sessionName)) {
      for (let i = 2; i <= projectsRef.current.length + 2; i++) {
        const candidate = `New Thread ${i}`
        if (!usedNames.has(candidate)) { sessionName = candidate; break }
      }
    }
    p.name = sessionName
    setProjects(ps => [...ps, p])
    setActiveId(p.id)
    setViewTabs([])
    setActiveViewTabId(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    if (typeof window !== 'undefined') {
      ;(window as any).electronAPI?.view?.clear?.('1')
    }

    loadResearchTabs([], p.id)
  }


  function _removeWorkspaceCore(id: string, reap: boolean) {
    if (projects.length <= 1) return
    const proj = projects.find(p => p.id === id)
    if (!proj) return

    const sourceIds = proj.sources.map(s => s.id)
    function reapSources() {
      if (reap && sourceIds.length) {
        Promise.allSettled(sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
          .then(notifyStorageChanged)
      }
    }

    if (id !== activeId) {
      setProjects(ps => ps.filter(p => p.id !== id))
      reapSources()
      return
    }

    const remaining = projects.filter(p => p.id !== id)
    const idx       = projects.findIndex(p => p.id === id)

    setProjects(remaining)
    setSelectedIds(new Set())
    setAnchorId(null)

    if (remaining.length === 0) {
      setActiveId(null)
      setViewTabs([])
      setActiveViewTabId(null)
      if (typeof window !== 'undefined') (window as any).electronAPI?.view?.clear?.('1')
      loadResearchTabs([])
    } else {
      const nextProj = remaining[Math.max(0, idx - 1)]
      setActiveId(nextProj.id)
      const { viewTabs: nTabs, activeViewTabId: nActiveId } =
        migrateToViewTabs(nextProj, projectsRef.current.flatMap(p => p.sources))
      setViewTabs(nTabs)
      setActiveViewTabId(nActiveId)
      if (typeof window !== 'undefined') {
        const newActiveTab = nTabs.find(t => t.id === nActiveId)
        if (!newActiveTab?.url) (window as any).electronAPI?.view?.clear?.('1')
      }
      loadResearchTabs(nextProj.researchTabs ?? [], nextProj.id)
    }

    reapSources()
  }

  function removeWorkspace(targetId?: string) {
    const id = targetId ?? activeId
    if (!id) return
    _removeWorkspaceCore(id, true)
  }

  function removeWorkspaceSoft(targetId: string) {
    _removeWorkspaceCore(targetId, false)
  }

  function commitWorkspaceRemoval(proj: import('@/lib/types').Project) {
    const sourceIds = proj.sources.map(s => s.id)
    if (sourceIds.length) {
      Promise.allSettled(sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
        .then(notifyStorageChanged)
    }
  }

  function restoreWorkspace(proj: import('@/lib/types').Project, insertIdx: number) {
    setProjects(ps => {
      const next = [...ps]
      next.splice(insertIdx, 0, proj)
      return next
    })
    setActiveId(proj.id)
    const { viewTabs: rTabs, activeViewTabId: rActiveId } =
      migrateToViewTabs(proj, projectsRef.current.flatMap(p => p.sources))
    setViewTabs(rTabs)
    setActiveViewTabId(rActiveId)
    loadResearchTabs(proj.researchTabs ?? [], proj.id)
  }

  // ─── Project / source helpers ───────────────────────────────────────────

  function updateProject(id: string, patch: Partial<Project>) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  // projId is kept in signature for backward compat but ignored — scans all projects.
  function patchSource(_projId: string, srcId: string, patch: Partial<QueuedSource>) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s => s.id === srcId ? { ...s, ...patch } : s),
    })))
  }

  function moveSource(srcId: string, toIndex: number) {
    setProjects(ps => ps.map(p => {
      if (!p.sources.some(s => s.id === srcId)) return p
      const from = p.sources.findIndex(s => s.id === srcId)
      if (from === -1) return p
      const arr = [...p.sources]
      const [item] = arr.splice(from, 1)
      arr.splice(toIndex, 0, item)
      return { ...p, sources: arr }
    }))
  }

  function moveSourceToProject(srcId: string, targetProjId: string) {
    setProjects(ps => {
      const src = ps.flatMap(p => p.sources).find(s => s.id === srcId)
      if (!src) return ps
      // No-op if the source already lives in the target project.
      const currentProj = ps.find(p => p.sources.some(s => s.id === srcId))
      if (currentProj?.id === targetProjId) return ps
      // Target project must have room.
      const target = ps.find(p => p.id === targetProjId)
      if (target && target.sources.length >= STACK_LIMIT) {
        warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`)
        return ps
      }
      return ps.map(p => {
        if (p.sources.some(s => s.id === srcId)) {
          return { ...p, sources: p.sources.filter(s => s.id !== srcId) }
        }
        if (p.id === targetProjId) {
          return { ...p, sources: [...p.sources, src] }
        }
        return p
      })
    })
  }

  // ─── Document actions ───────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[], targetProjId?: string) {
    const projId = targetProjId ?? activeIdRef.current
    if (!projId) { newWorkspace(); return }

    const isImage = (f: File) =>
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
    const isPdf = (f: File) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')

    let list = Array.from(files)
      .filter(f => isPdf(f) || isImage(f))
      .slice(0, MAX_BATCH)

    const currentAllSources = projectsRef.current.flatMap(p => p.sources)
    list = list.filter(f => !currentAllSources.some(s => s.label === f.name))
    if (!list.length) return

    // Global uploaded-document count cap.
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

    // Per-project source cap.
    const targetProj  = projectsRef.current.find(p => p.id === projId)
    const room        = STACK_LIMIT - (targetProj?.sources.length ?? 0)
    if (room <= 0) { warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`); return }
    if (list.length > room) list = list.slice(0, room)

    // Storage cap.
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

    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, ...newSources] }
    ))

    // Auto-open the first uploaded file in the View
    if (projId === activeIdRef.current && newSources.length > 0) {
      openInView(newSources[0].id)
    }

    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      const src  = newSources[i]

      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        patchSource(projId, src.id, { status: 'error', error: `File too large (max ${MAX_FILE_MB}MB)` })
        continue
      }

      try {
        await storeFile(src.id, file)
        notifyStorageChanged()
        if (src.fileType === 'image') {
          patchSource(projId, src.id, { status: 'done' })
        } else {
          patchSource(projId, src.id, { status: 'extracting' })
          const content = await extractContent(file)
          await storeContent(src.id, content).catch(() => {})
          patchSource(projId, src.id, { status: 'done', content })
        }
      } catch (err) {
        patchSource(projId, src.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to process file — try again.',
        })
      }
    }
  }

  function removeSource(srcId: string) {
    // Find source + its project for per-session archiving
    let srcProjectId: string | null = null
    let src: QueuedSource | undefined
    for (const p of projectsRef.current) {
      const found = p.sources.find(s => s.id === srcId)
      if (found) { src = found; srcProjectId = p.id; break }
    }
    if (src && srcProjectId) {
      try {
        const key = `proof-archive-${srcProjectId}`
        const archived = JSON.parse(localStorage.getItem(key) || '[]')
        archived.unshift({ source: src, projectId: srcProjectId, deletedAt: Date.now() })
        localStorage.setItem(key, JSON.stringify(archived.slice(0, 50)))
      } catch {}
    }
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => s.id !== srcId),
    })))
    // Close any view tab that was showing the removed source.
    const removedTab = viewTabsRef.current.find(t => t.srcId === srcId)
    if (removedTab) closeViewTab(removedTab.id)
    setSelectedIds(new Set())
    setAnchorId(null)
    Promise.allSettled([deleteFile(srcId), deleteContent(srcId)]).then(notifyStorageChanged)
  }

  function restoreArchivedSource(srcId: string, projectId: string) {
    const key = `proof-archive-${projectId}`
    try {
      const archived: Array<{ source: QueuedSource; projectId: string; deletedAt: number }> =
        JSON.parse(localStorage.getItem(key) || '[]')
      const entry = archived.find(e => e.source.id === srcId)
      if (!entry) return
      // Re-add to the project
      setProjects(ps => ps.map(p =>
        p.id !== projectId ? p : { ...p, sources: [...p.sources, entry.source] }
      ))
      // Remove from archive
      localStorage.setItem(key, JSON.stringify(archived.filter(e => e.source.id !== srcId)))
    } catch {}
  }

  function removeSelected() {
    if (!selectedIds.size) return
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => !selectedIds.has(s.id)),
    })))
    // Close any view tabs showing removed sources.
    const removedTabs = viewTabsRef.current.filter(t => t.srcId && selectedIds.has(t.srcId))
    removedTabs.forEach(t => closeViewTab(t.id))
    const ids = Array.from(selectedIds)
    Promise.allSettled(ids.flatMap(id => [deleteFile(id), deleteContent(id)]))
      .then(notifyStorageChanged)
    setSelectedIds(new Set())
    setAnchorId(null)
  }

  // Adds a source reference to another session — same ID, shared IDB data, stays in origin too.
  function addSourceToSession(srcId: string, toProjectId: string): string | null {
    let src: QueuedSource | undefined
    for (const p of projectsRef.current) {
      const found = p.sources.find(s => s.id === srcId)
      if (found) { src = found; break }
    }
    if (!src) return null
    const toProj = projectsRef.current.find(p => p.id === toProjectId)
    if (!toProj) return null
    // Skip if already in destination
    if (toProj.sources.some(s => s.id === srcId)) return toProj.name || 'Session'
    const captured = src
    setProjects(ps => ps.map(p =>
      p.id !== toProjectId ? p : { ...p, sources: [...p.sources, captured] }
    ))
    if (toProjectId === activeIdRef.current && captured.fileType !== 'url') {
      openInView(srcId)
    }
    return toProj.name || 'Session'
  }

  function addUrlToSession(projectId: string, url: string, title: string): { name: string | null; srcId: string } | null {
    const toProj = projectsRef.current.find(p => p.id === projectId)
    if (!toProj) return null
    const src = newUrlSource(url, title)
    setProjects(ps => ps.map(p =>
      p.id !== projectId ? p : { ...p, sources: [...p.sources, src] }
    ))
    return { name: toProj.name || 'Session', srcId: src.id }
  }

  function removeSourceFromProject(srcId: string, projId: string) {
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: p.sources.filter(s => s.id !== srcId) }
    ))
  }

  async function addUrl(url: string, targetProjId?: string, label?: string) {
    const projId = targetProjId ?? activeIdRef.current
    if (!projId) { newWorkspace(); return }
    const projNow = projectsRef.current.find(p => p.id === projId)
    if (projNow && projNow.sources.length >= STACK_LIMIT) {
      warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`)
      return
    }
    const src = newUrlSource(url, label)
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, src] }
    ))
    // URLs do not open in the center Source pane — that pane is for
    // documents only. Save behavior stays as-is: the source lands in
    // the Stack, the right Browser keeps showing whatever it had.
  }

  // ─── Library (stack) actions ────────────────────────────────────────────

  // ─── View tab actions ───────────────────────────────────────────────────

  function openInView(srcId: string) {
    const tabs = viewTabsRef.current
    const activeTab = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (activeTab && !activeTab.srcId && !activeTab.url) {
      // Reuse empty active tab
      setViewTabs(ts => ts.map(t => t.id === activeTab.id
        ? { id: t.id, srcId }
        : t))
      return
    }
    const tabId = uid()
    setViewTabs(ts => [...ts, { id: tabId, srcId }])
    setActiveViewTabId(tabId)
    // Clear any live URL view so the doc pane is visible
    ;(window as any).electronAPI?.view?.clear?.('1')
  }

  function openUrlInView(url: string, title: string, srcId?: string) {
    const tabs = viewTabsRef.current
    const existing = tabs.find(t => t.url === url)
    if (existing) {
      setActiveViewTabId(existing.id)
      return
    }
    const activeTab = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (activeTab && !activeTab.srcId && !activeTab.url) {
      setViewTabs(ts => ts.map(t => t.id === activeTab.id
        ? { id: t.id, url, title, srcId }
        : t))
      return
    }
    const tabId = uid()
    setViewTabs(ts => [...ts, { id: tabId, url, title, srcId }])
    setActiveViewTabId(tabId)
  }

  function closeViewTab(tabId: string) {
    const tabs = viewTabsRef.current
    const idx = tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    const closedTab = tabs[idx]
    const newTabs = tabs.filter(t => t.id !== tabId)
    setViewTabs(newTabs)
    if (activeViewTabIdRef.current === tabId) {
      const newActiveId = newTabs[Math.max(0, idx - 1)]?.id ?? null
      setActiveViewTabId(newActiveId)
      const newActiveTab = newTabs.find(t => t.id === newActiveId)
      if (closedTab.url && !newActiveTab?.url) {
        ;(window as any).electronAPI?.view?.clear?.('1')
      }
    }
  }

  function reorderViewTabs(fromId: string, toId: string) {
    setViewTabs(tabs => {
      const from = tabs.findIndex(t => t.id === fromId)
      const to   = tabs.findIndex(t => t.id === toId)
      if (from === -1 || to === -1 || from === to) return tabs
      const next = [...tabs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function switchViewTab(tabId: string) {
    const tabs = viewTabsRef.current
    const target = tabs.find(t => t.id === tabId)
    if (!target) return
    const current = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (current?.url && !target.url) {
      ;(window as any).electronAPI?.view?.clear?.('1')
    }
    setActiveViewTabId(tabId)
  }

  // ─── Context value ──────────────────────────────────────────────────────

  const value: AppState = {
    mounted, projects, activeId, selectedId, selectedIds, anchorId,
    contextMenu,
    activeProject, sources, allSources, selectedSource,
    viewTabs, activeViewTabId, openInView, openUrlInView, closeViewTab, switchViewTab, reorderViewTabs,
    limits: LIMITS,
    setSelectedIds, setAnchorId,
    setContextMenu,
    setProjects, updateProject, patchSource, moveSource, moveSourceToProject,
    uploadFiles,
    removeSource, removeSelected, addSourceToSession, addUrlToSession, removeSourceFromProject,
    restoreArchivedSource,
    addUrl,
    switchWorkspace, newWorkspace, saveWorkspace, removeWorkspace, removeWorkspaceSoft, commitWorkspaceRemoval, restoreWorkspace,
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
