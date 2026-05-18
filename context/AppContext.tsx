'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Project, QueuedSource, SavedResearchTab, ViewPage } from '@/lib/types'
import {
  ACTIVE_KEY, SELECTED_KEY, SELECTED_KEY_2, STACK_KEY, STACK_LIMIT,
  newProject, newSource, newNote, newUrlSource,
  loadProjects, saveProjects,
  uid,
} from '@/lib/storage'
import { storeFile, deleteFile, getFile, storeContent, getContent, deleteContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { wouldExceedLimit, STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'
import { checkIsPro, FREE_LIMITS, PRO_LIMITS } from '@/lib/entitlement'
import type { Limits } from '@/lib/entitlement'
import {
  getStoredUser, storeEntitlementCache, clearStoredSession,
  signIn as authSignIn, refreshEntitlement as authRefresh, getPortalUrl,
} from '@/lib/auth'
import type { AuthUser, SignInResult } from '@/lib/auth'


// Legacy id from the pre-refactor "floating sources" model. Kept only so
// old persisted state can be migrated on load — no new code writes it.
const INBOX_ID = '__inbox__'

interface ContextMenu { srcId: string; x: number; y: number }

interface AppState {
  mounted: boolean
  projects: Project[]
  activeId: string | null
  selectedId: string | null
  selectedId2: string | null
  selectedIds: Set<string>
  anchorId: string | null
  contextMenu: ContextMenu | null
  // derived
  activeProject: Project | null
  sources: QueuedSource[]
  allSources: QueuedSource[]
  selectedSource: QueuedSource | null
  selectedSource2: QueuedSource | null
  stackIds: string[]
  stackSources: QueuedSource[]
  stackLimit: number
  atStackLimit: boolean
  inStack: (id: string) => boolean
  // center view panes
  view1Page: ViewPage | null
  view2Page: ViewPage | null
  splitView: boolean
  setSplitView: (v: boolean) => void
  pinPageToView: (pane: 1 | 2, src: QueuedSource) => void
  pinUrlToView:  (pane: 1 | 2, url: string, title: string) => void
  clearView: (pane: 1 | 2) => void
  openDocInPane: (pane: 1 | 2, srcId: string) => void
  // auth + entitlement
  user:              AuthUser | null
  isPro:             boolean
  limits:            Limits
  signIn:            (email: string) => Promise<SignInResult>
  signOut:           () => void
  refreshEntitlement: () => Promise<void>
  openBilling:       () => Promise<void>
  // setters
  setSelectedId: (id: string | null) => void
  setSelectedId2: (id: string | null) => void
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  setContextMenu: (m: ContextMenu | null) => void
  // actions
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  updateProject: (id: string, patch: Partial<Project>) => void
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  moveSource: (srcId: string, toIndex: number) => void
  moveSourceToProject: (srcId: string, targetProjId: string) => void
  moveProject: (projId: string, toIndex: number) => void
  uploadFiles: (files: FileList | File[], targetProjId?: string) => Promise<void>
  retrySource: (srcId: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  createNote: (targetProjId?: string) => void
  addUrl: (url: string, targetProjId?: string, label?: string) => Promise<void>
  // Workspace actions
  switchWorkspace: (id: string) => void
  newWorkspace: () => void
  saveWorkspace: (name?: string) => void
  removeWorkspace: (targetId?: string) => void
  // Stack actions
  addToStack: (id: string) => void
  removeFromStack: (id: string) => void
  clearStack: () => void
  reorderStack: (fromIndex: number, toIndex: number) => void
  openInPane: (id: string) => void
}

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted]                 = useState(false)
  const [projects, setProjects]               = useState<Project[]>([])
  const [activeId, setActiveId]               = useState<string | null>(null)
  const [selectedId, setSelectedId]           = useState<string | null>(null)
  const [selectedId2, setSelectedId2]         = useState<string | null>(null)
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId]               = useState<string | null>(null)
  const [contextMenu, setContextMenu]         = useState<ContextMenu | null>(null)
  // Snapshot the last active workspace ID before effects can update it,
  // so the mount effect can restore the correct workspace on reload.
  const [lastActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
  })

  const [view1Page, setView1Page] = useState<ViewPage | null>(null)
  const [view2Page, setView2Page] = useState<ViewPage | null>(null)
  const [splitView, setSplitView] = useState(false)

  const [isPro, setIsPro] = useState(false)
  const [user,  setUser]  = useState<AuthUser | null>(null)

  const projectsRef    = useRef<Project[]>([])
  const activeIdRef    = useRef(activeId)
  const selectedIdRef  = useRef<string | null>(null)
  const selectedId2Ref = useRef<string | null>(null)
  const view1PageRef   = useRef<ViewPage | null>(null)
  const view2PageRef   = useRef<ViewPage | null>(null)
  const splitViewRef   = useRef(false)
  const isProRef       = useRef(false)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { selectedId2Ref.current = selectedId2 }, [selectedId2])
  useEffect(() => { view1PageRef.current = view1Page }, [view1Page])
  useEffect(() => { view2PageRef.current = view2Page }, [view2Page])
  useEffect(() => { splitViewRef.current = splitView }, [splitView])
  useEffect(() => { isProRef.current = isPro }, [isPro])

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
        def.name = 'Untitled'
        fixed = [def]
      }
      setProjects(fixed)

      // Drop any orphaned stack-key entry from the previous model — the
      // active project's sources are the stack now and no separate list
      // is read. Also drop the legacy two-pane image-selection key —
      // the center column is a single Source pane now, no separate
      // "image pane" state.
      try { localStorage.removeItem(STACK_KEY) } catch {}
      try { localStorage.removeItem('proof-v3-selected-image') } catch {}

      // Auto-restore the last active project (or fall back to the first one)
      // and its saved Source selection.
      const restoredId   = fixed.find(p => p.id === lastActiveId)?.id ?? fixed[0].id
      const restoredProj = fixed.find(p => p.id === restoredId)
      setActiveId(restoredId)
      try {
        const restoredSources = restoredProj?.sources ?? []
        // Prefer per-project sel1/sel2; fall back to global localStorage for migration.
        const savedSel  = restoredProj?.sel1  ?? localStorage.getItem(SELECTED_KEY)
        const savedSel2 = restoredProj?.sel2  ?? localStorage.getItem(SELECTED_KEY_2)
        if (savedSel  && restoredSources.find(s => s.id === savedSel))  setSelectedId(savedSel)
        if (savedSel2 && restoredSources.find(s => s.id === savedSel2)) setSelectedId2(savedSel2)
      } catch {}

      // Restore research tabs for the active workspace on startup.
      loadResearchTabs(restoredProj?.researchTabs ?? [])

      // Restore view page pins for the active workspace on startup.
      // Navigation is handled by ViewPane's useEffect after bounds are set.
      const v1 = restoredProj?.view1Page ?? null
      const v2 = restoredProj?.view2Page ?? null
      if (v1) setView1Page(v1)
      if (v2) setView2Page(v2)
      if (restoredProj) setSplitView(restoreSplit(restoredProj))

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
      // First launch — default Untitled workspace.
      const def = newProject(1)
      def.name = 'Untitled'
      setProjects([def])
      setActiveId(def.id)
    }
    setIsPro(checkIsPro())

    // Restore auth session and recheck subscription in background
    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
      authRefresh(storedUser.token).then(pro => {
        if (pro !== null) setIsPro(pro)
      }).catch(() => {})
    }

    setMounted(true)
  }, [])

  useEffect(() => {
    projectsRef.current = projects
    // Persist on every change AFTER mount — including empty arrays. The
    // previous `if (projects.length)` skipped the save when the user
    // deleted the last project, so the stale list survived in
    // localStorage and the deleted project resurrected on hard reload.
    if (mounted) saveProjects(projects)
  }, [projects, mounted])

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
        ...p, sel1: selectedIdRef.current, sel2: selectedId2Ref.current,
        view1Page: view1PageRef.current, view2Page: view2PageRef.current,
        splitView: splitViewRef.current,
        researchTabs,
      })
      saveProjects(snap)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else          localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])
  useEffect(() => {
    if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
    else            localStorage.removeItem(SELECTED_KEY)
  }, [selectedId])
  useEffect(() => {
    if (selectedId2) localStorage.setItem(SELECTED_KEY_2, selectedId2)
    else             localStorage.removeItem(SELECTED_KEY_2)
  }, [selectedId2])

  // Auto-save workspace state whenever key selection/view state changes.
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!mounted || !activeId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { saveWorkspace() }, 400)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedId2, view1Page, view2Page, splitView, activeId, mounted])

  // ─── Split restore helper ─────────────────────────────────────────────────────

  function restoreSplit(proj: Project): boolean {
    return proj.splitView === true && !!(proj.view2Page || proj.sel2)
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeProject       = projects.find(p => p.id === activeId) ?? null
  const sources             = activeProject?.sources ?? []
  const allSources          = projects.flatMap(p => p.sources)
  const selectedSource      = allSources.find(s => s.id === selectedId)  ?? null
  const selectedSource2     = allSources.find(s => s.id === selectedId2) ?? null
  const namedProjectCount   = projects.length

  // Stack = active project's sources. No separate storage, no separate
  // ordering — switching projects swaps the stack instantly because it's
  // a direct reference to `activeProject.sources`.
  const stackSources: QueuedSource[] = sources
  const stackIds   : string[]        = sources.map(s => s.id)
  const atStackLimit                 = sources.length >= STACK_LIMIT
  const inStack    = (id: string)    => sources.some(s => s.id === id)

  // ─── Auth + entitlement ──────────────────────────────────────────────────────

  async function signInFn(email: string): Promise<SignInResult> {
    const result = await authSignIn(email)
    if (result.ok) {
      setUser(result.user)
      setIsPro(result.isPro)
    }
    return result
  }

  function signOut() {
    clearStoredSession()
    setUser(null)
    setIsPro(checkIsPro())
  }

  async function refreshEntitlementFn() {
    if (!user) return
    const pro = await authRefresh(user.token).catch(() => null)
    if (pro !== null) setIsPro(pro)
  }

  async function openBilling() {
    if (!user?.customerId) return
    const url = await getPortalUrl(user.customerId).catch(() => null)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function needUpgrade(msg: string) {
    warn(msg)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('proof:upgrade-needed'))
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function updateProject(id: string, patch: Partial<Project>) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  // projId is kept in signature for backward compat but ignored — scans all projects
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

  function moveProject(projId: string, toIndex: number) {
    setProjects(ps => {
      const from = ps.findIndex(p => p.id === projId)
      if (from === -1) return ps
      const arr = [...ps]
      const [item] = arr.splice(from, 1)
      const clamped = Math.max(0, Math.min(toIndex, arr.length))
      arr.splice(clamped, 0, item)
      return arr
    })
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

  // ─── Actions ────────────────────────────────────────────────────────────────

  const MAX_BATCH   = 10
  const MAX_FILE_MB = 100

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

    const limits = isProRef.current ? PRO_LIMITS : FREE_LIMITS

    // Global uploaded-document count cap (PDFs and images only; Pages/notes excluded).
    if (isFinite(limits.docCount)) {
      const uploadedCount = currentAllSources.filter(
        s => s.fileType === 'pdf' || s.fileType === 'image'
      ).length
      if (uploadedCount >= limits.docCount) {
        needUpgrade('Free includes 10 Documents. Upgrade to Pro or remove uploaded Documents.')
        return
      }
      const countRoom = limits.docCount - uploadedCount
      if (list.length > countRoom) list = list.slice(0, countRoom)
    }

    // Per-project source cap.
    const targetProj  = projectsRef.current.find(p => p.id === projId)
    const room        = STACK_LIMIT - (targetProj?.sources.length ?? 0)
    if (room <= 0) { warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`); return }
    if (list.length > room) list = list.slice(0, room)

    // Storage cap — tier-specific.
    const batchBytes = list.reduce((sum, f) => sum + f.size, 0)
    if (await wouldExceedLimit(batchBytes, limits.storageBytes)) {
      needUpgrade('Storage limit reached. Upgrade to Pro or remove uploaded Documents.')
      return
    }

    const newSources = list.map(f => ({
      ...newSource(`file:${f.name}`, f.name),
      fileType: (isImage(f) ? 'image' : 'pdf') as 'pdf' | 'image',
    }))

    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, ...newSources] }
    ))

    // Open the first new source in the Source pane immediately so the
    // user sees the result of their upload without an extra click.
    if (newSources.length > 0) setSelectedId(newSources[0].id)

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

  async function retrySource(srcId: string) {
    const file = await getFile(srcId)
    if (!file) {
      patchSource('', srcId, { status: 'error', error: 'File not found — re-upload to retry.' })
      return
    }
    try {
      patchSource('', srcId, { status: 'extracting' })
      const content = await extractContent(file)
      await storeContent(srcId, content).catch(() => {})
      patchSource('', srcId, { status: 'done', content, error: null })
    } catch (err) {
      patchSource('', srcId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to process file — try again.',
      })
    }
  }

  function removeSource(srcId: string) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => s.id !== srcId),
    })))
    if (selectedId  === srcId) setSelectedId(null)
    if (selectedId2 === srcId) setSelectedId2(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    Promise.allSettled([deleteFile(srcId), deleteContent(srcId)]).then(notifyStorageChanged)
  }

  function removeSelected() {
    if (!selectedIds.size) return
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => !selectedIds.has(s.id)),
    })))
    if (selectedId  && selectedIds.has(selectedId))  setSelectedId(null)
    if (selectedId2 && selectedIds.has(selectedId2)) setSelectedId2(null)
    const ids = Array.from(selectedIds)
    Promise.allSettled(ids.flatMap(id => [deleteFile(id), deleteContent(id)]))
      .then(notifyStorageChanged)
    setSelectedIds(new Set())
    setAnchorId(null)
  }

  function createNote(targetProjId?: string) {
    const projId = targetProjId ?? activeIdRef.current
    if (!projId) { newWorkspace(); return }
    const projNow = projectsRef.current.find(p => p.id === projId)
    if (projNow && projNow.sources.length >= STACK_LIMIT) {
      warn(`Document limit reached (${STACK_LIMIT}). Remove Documents to add more.`)
      return
    }
    const note = newNote()
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, note] }
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

  // ─── Stack actions (aliases over project-scoped source ops) ───────────────

  // Drag-source-into-stack semantics: if the source already lives in the
  // active project, no-op. If it lives in another project, move it into
  // the active project (respecting the cap).
  function addToStack(id: string) {
    const projId = activeIdRef.current
    if (!projId) return
    moveSourceToProject(id, projId)
  }

  // Unpinning IS removing the source in the new model — there's no
  // separate "pinned" set to detach from, so the only meaningful
  // operation is to delete it from the project (and IDB).
  function removeFromStack(id: string) {
    removeSource(id)
  }

  // Empty out the active project. Removes every source + reaps IDB.
  function clearStack() {
    const proj = projects.find(p => p.id === activeIdRef.current)
    if (!proj || proj.sources.length === 0) return
    const ids = proj.sources.map(s => s.id)
    setProjects(ps => ps.map(p => p.id === proj.id ? { ...p, sources: [] } : p))
    setSelectedId(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    Promise.allSettled(ids.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
      .then(notifyStorageChanged)
  }

  function reorderStack(fromIndex: number, toIndex: number) {
    const proj = projects.find(p => p.id === activeIdRef.current)
    if (!proj) return
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= proj.sources.length) return
    if (toIndex   < 0 || toIndex   >  proj.sources.length) return
    setProjects(ps => ps.map(p => {
      if (p.id !== proj.id) return p
      const next = [...p.sources]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved)
      return { ...p, sources: next }
    }))
  }

  // ─── Workspace helpers ────────────────────────────────────────────────────────

  function readResearchTabs(): SavedResearchTab[] {
    try {
      const raw = JSON.parse(localStorage.getItem('proof-v3-research-tabs') || '[]')
      return Array.isArray(raw)
        ? raw.filter((t: { url?: string }) => t.url)
             .map((t: { url: string; title?: string; active?: boolean }) => ({ url: t.url, title: t.title || '', active: t.active ?? false }))
        : []
    } catch { return [] }
  }

  function loadResearchTabs(tabs: SavedResearchTab[]) {
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
      ;(window as any).electronAPI?.research?.loadWorkspace?.(tabs)
    }
  }

  function saveWorkspace(name?: string) {
    if (!activeId) return
    const researchTabs = readResearchTabs()
    setProjects(ps => ps.map(p => {
      if (p.id !== activeId) return p
      return { ...p, sel1: selectedId, sel2: selectedId2, view1Page, view2Page, splitView, researchTabs, ...(name !== undefined ? { name } : {}) }
    }))
  }

  function switchWorkspace(id: string) {
    if (id === activeId) return
    const curId   = activeId
    const curSel1 = selectedId
    const curSel2 = selectedId2
    const researchTabs = readResearchTabs()

    // Persist state of the workspace we're leaving
    setProjects(ps => ps.map(p => p.id === curId
      ? { ...p, sel1: curSel1, sel2: curSel2, view1Page, view2Page, splitView, researchTabs }
      : p))

    const newProj = projects.find(p => p.id === id)
    setActiveId(id)
    setSelectedId(newProj?.sel1 ?? null)
    setSelectedId2(newProj?.sel2 ?? null)
    setSelectedIds(new Set())
    setAnchorId(null)

    const nv1 = newProj?.view1Page ?? null
    const nv2 = newProj?.view2Page ?? null
    setView1Page(nv1)
    setView2Page(nv2)
    setSplitView(newProj ? restoreSplit(newProj) : false)
    // Clear immediately when no page; navigate handled by ViewPane useEffect when page is set.
    if (typeof window !== 'undefined') {
      if (!nv1) (window as any).electronAPI?.view?.clear?.('1')
      if (!nv2) (window as any).electronAPI?.view?.clear?.('2')
    }

    loadResearchTabs(newProj?.researchTabs ?? [])
  }

  function newWorkspace() {
    const limits = isProRef.current ? PRO_LIMITS : FREE_LIMITS
    if (!isProRef.current && projectsRef.current.length >= limits.workspaces) {
      needUpgrade('Free includes 1 workspace. Upgrade to Pro for unlimited workspaces.')
      return
    }

    const curId   = activeId
    const curSel1 = selectedId
    const curSel2 = selectedId2
    const researchTabs = readResearchTabs()

    if (curId) {
      setProjects(ps => ps.map(p => p.id === curId
        ? { ...p, sel1: curSel1, sel2: curSel2, view1Page, view2Page, splitView, researchTabs }
        : p))
    }

    const p = newProject(namedProjectCount + 1)
    const usedNames = new Set(projectsRef.current.map(w => w.name))
    let untitledName = 'Untitled'
    for (let i = 1; i <= projectsRef.current.length + 1; i++) {
      const candidate = `Untitled-${String(i).padStart(2, '0')}`
      if (!usedNames.has(candidate)) { untitledName = candidate; break }
    }
    p.name = untitledName
    setProjects(ps => [...ps, p])
    setActiveId(p.id)
    setSelectedId(null)
    setSelectedId2(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    setView1Page(null)
    setView2Page(null)
    setSplitView(false)
    if (typeof window !== 'undefined') {
      ;(window as any).electronAPI?.view?.clear?.('1')
      ;(window as any).electronAPI?.view?.clear?.('2')
    }

    loadResearchTabs([])
  }

  function removeWorkspace(targetId?: string) {
    const id = targetId ?? activeId
    if (!id) return
    if (projects.length <= 1) return
    const proj = projects.find(p => p.id === id)
    if (!proj) return

    const sourceIds = proj.sources.map(s => s.id)
    function reapSources() {
      if (sourceIds.length) {
        Promise.allSettled(sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
          .then(notifyStorageChanged)
      }
    }

    // Non-active workspace — just remove it.
    if (id !== activeId) {
      setProjects(ps => ps.filter(p => p.id !== id))
      reapSources()
      return
    }

    // Active workspace — delete it and switch to adjacent if one exists.
    const remaining = projects.filter(p => p.id !== id)
    const idx       = projects.findIndex(p => p.id === id)

    setProjects(remaining)
    setSelectedIds(new Set())
    setAnchorId(null)

    if (remaining.length === 0) {
      setActiveId(null)
      setSelectedId(null)
      setSelectedId2(null)
      setSplitView(false)
      loadResearchTabs([])
    } else {
      const nextProj = remaining[Math.max(0, idx - 1)]
      setActiveId(nextProj.id)
      setSelectedId(nextProj.sel1 ?? null)
      setSelectedId2(nextProj.sel2 ?? null)
      const rv1 = nextProj.view1Page ?? null
      const rv2 = nextProj.view2Page ?? null
      setView1Page(rv1)
      setView2Page(rv2)
      setSplitView(restoreSplit(nextProj))
      // Clear immediately when no page; navigate handled by ViewPane useEffect when page is set.
      if (typeof window !== 'undefined') {
        if (!rv1) (window as any).electronAPI?.view?.clear?.('1')
        if (!rv2) (window as any).electronAPI?.view?.clear?.('2')
      }
      loadResearchTabs(nextProj.researchTabs ?? [])
    }

    reapSources()
  }

  function openInPane(id: string) {
    const src = allSources.find(s => s.id === id)
    if (!src) return
    // URL/web sources belong to the right Browser, not the center
    // Source pane. Hand them off to the research view if Electron
    // exposes one; in the web build, fall back to opening externally.
    // Documents (PDF/note/image) load into the center Source pane.
    if (src.fileType === 'url') {
      const url = src.url ?? src.raw
      if (typeof window === 'undefined') return
      if (window.electronAPI?.research?.navigate) {
        // Hand off to RightPanel so the single navigateUrl pipeline runs:
        // pre-positions the WebContentsView before the navigate IPC, avoiding
        // the "loads only on Ctrl-R" race from calling research.navigate directly.
        window.dispatchEvent(new CustomEvent('proof:browser-navigate', { detail: url }))
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    // Single mode: always route to pane 1.
    if (!splitViewRef.current) {
      if (view1Page) { setView1Page(null); ;(window as any).electronAPI?.view?.clear?.('1') }
      setSelectedId(id)
      return
    }
    // Split mode: smart routing — fill first empty pane, otherwise replace View 1.
    // Clearing view pages ensures doc and live page don't occupy the same pane.
    if (!selectedId || selectedId === id) {
      if (view1Page) { setView1Page(null); ;(window as any).electronAPI?.view?.clear?.('1') }
      setSelectedId(id)
    } else if (!selectedId2 || selectedId2 === id) {
      if (view2Page) { setView2Page(null); ;(window as any).electronAPI?.view?.clear?.('2') }
      setSelectedId2(id)
    } else {
      if (view1Page) { setView1Page(null); ;(window as any).electronAPI?.view?.clear?.('1') }
      setSelectedId(id)
    }
  }

  function openDocInPane(pane: 1 | 2, srcId: string) {
    if (pane === 2) {
      setSplitView(true)
      if (view2PageRef.current) { setView2Page(null); ;(window as any).electronAPI?.view?.clear?.('2') }
      setSelectedId2(srcId)
    } else {
      if (view1PageRef.current) { setView1Page(null); ;(window as any).electronAPI?.view?.clear?.('1') }
      setSelectedId(srcId)
    }
  }

  function pinPageToView(pane: 1 | 2, src: QueuedSource) {
    const url   = src.url ?? src.raw
    const title = src.label ?? url
    const page: ViewPage = { url, title, srcId: src.id }
    // Navigation is handled by ViewPane's useEffect after bounds are set — not here.
    if (pane === 1) {
      setView1Page(page)
      setSelectedId(null)
    } else {
      setSplitView(true)
      setView2Page(page)
      setSelectedId2(null)
    }
  }

  function pinUrlToView(pane: 1 | 2, url: string, title: string) {
    const page: ViewPage = { url, title }
    if (pane === 1) {
      setView1Page(page)
      setSelectedId(null)
    } else {
      setSplitView(true)
      setView2Page(page)
      setSelectedId2(null)
    }
  }

  function clearView(pane: 1 | 2) {
    if (pane === 1) {
      setView1Page(null)
      ;(window as any).electronAPI?.view?.clear?.('1')
    } else {
      setView2Page(null)
      ;(window as any).electronAPI?.view?.clear?.('2')
    }
  }

  // ─── Context value ──────────────────────────────────────────────────────────

  const limits: Limits = isPro ? PRO_LIMITS : FREE_LIMITS

  const value: AppState = {
    mounted, projects, activeId, selectedId, selectedId2, selectedIds, anchorId,
    contextMenu,
    activeProject, sources, allSources, selectedSource, selectedSource2,
    stackIds, stackSources, stackLimit: STACK_LIMIT, atStackLimit, inStack,
    view1Page, view2Page, splitView, setSplitView, pinPageToView, pinUrlToView, clearView, openDocInPane,
    user, isPro, limits,
    signIn: signInFn, signOut, refreshEntitlement: refreshEntitlementFn, openBilling,
    setSelectedId, setSelectedId2, setSelectedIds, setAnchorId,
    setContextMenu,
    setProjects, updateProject, patchSource, moveSource, moveSourceToProject, moveProject,
    uploadFiles, retrySource,
    removeSource, removeSelected,
    createNote, addUrl,
    addToStack, removeFromStack, clearStack, reorderStack, openInPane,
    switchWorkspace, newWorkspace, saveWorkspace, removeWorkspace,
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
