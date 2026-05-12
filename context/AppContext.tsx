'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Project, QueuedSource, Clip, Fragment } from '@/lib/types'
import {
  ACTIVE_KEY, SELECTED_KEY, SELECTED_IMAGE_KEY, STACK_KEY, STACK_LIMIT,
  newProject, newSource, newNote, newUrlSource,
  loadProjects, saveProjects,
} from '@/lib/storage'
import { storeFile, deleteFile, getFile, storeContent, getContent, deleteContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { wouldExceedLimit, STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'

// Legacy id from the pre-refactor "floating sources" model. Kept exported
// only so old persisted state can be migrated on load — no new code
// should reference it. New model: every source lives in exactly one
// project, and there's no inbox.
export const INBOX_ID      = '__inbox__'
// No project ceiling — users can create as many projects as the 250 MB
// storage cap allows. PROJECT_LIMIT and `atProjectLimit` remain in the
// surface for API stability but always read as "no limit reached".
export const PROJECT_LIMIT = Number.POSITIVE_INFINITY

interface ContextMenu     { srcId: string; x: number; y: number }
interface ProjContextMenu { projId: string; x: number; y: number }

interface AppState {
  mounted: boolean
  projects: Project[]
  activeId: string | null
  selectedId: string | null
  selectedIds: Set<string>
  anchorId: string | null
  showProjects: boolean
  contextMenu: ContextMenu | null
  projContextMenu: ProjContextMenu | null
  // derived
  activeProject: Project | null
  sources: QueuedSource[]
  allSources: QueuedSource[]
  selectedSource: QueuedSource | null
  selectedImageId: string | null
  selectedImageSource: QueuedSource | null
  // Stack is now project-scoped: it IS the active project's source list.
  // `stackSources` = active project's sources (in order). `stackIds` is
  // derived from that. `addToStack` / `removeFromStack` / `clearStack` are
  // semantic aliases for source operations against the active project —
  // sources can't exist without a project anymore, so "pinning" is just
  // "adding to the active project."
  stackIds: string[]
  stackSources: QueuedSource[]
  stackLimit: number          // max sources per project
  atStackLimit: boolean       // active project at the cap
  inStack: (id: string) => boolean
  namedProjectCount: number
  atProjectLimit: boolean
  // setters
  setShowProjects: (v: boolean | ((prev: boolean) => boolean)) => void
  setSelectedId: (id: string | null) => void
  setSelectedImageId: (id: string | null) => void
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  setContextMenu: (m: ContextMenu | null) => void
  setProjContextMenu: (m: ProjContextMenu | null) => void
  // actions
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  updateProject: (id: string, patch: Partial<Project>) => void
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  addClip: (srcId: string, clip: Clip) => void
  removeClip: (srcId: string, clipId: string) => void
  updateClip: (srcId: string, clipId: string, patch: Partial<Clip>) => void
  reorderClips: (srcId: string, fromId: string, afterId: string | null) => void
  addFragment: (fragment: Fragment) => void
  insertFragment: (fragment: Fragment, afterId: string | null) => void
  removeFragment: (fragmentId: string) => void
  updateFragment: (fragmentId: string, patch: Partial<Fragment>) => void
  moveFragment: (id: string, afterId: string | null) => void
  clearFragments: () => void
  moveSource: (srcId: string, toIndex: number) => void
  moveSourceToProject: (srcId: string, targetProjId: string) => void
  moveProject: (projId: string, toIndex: number) => void
  uploadFiles: (files: FileList | File[], targetProjId?: string) => Promise<void>
  retrySource: (srcId: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  createNote: (targetProjId?: string) => void
  addUrl: (url: string, targetProjId?: string) => Promise<void>
  createProject: (name?: string) => boolean
  switchProject: (id: string) => void
  deleteProject: (id: string) => void
  // Stack actions — aliases over the project-scoped source ops.
  // `addToStack` is the entry point for drag-source-into-stack: if the
  // source is already in the active project, no-op; otherwise it's
  // moved from its current project into the active one.
  addToStack: (id: string) => void
  removeFromStack: (id: string) => void   // alias for removeSource
  clearStack: () => void                   // clears the active project
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
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId]               = useState<string | null>(null)
  const [showProjects, setShowProjects]       = useState(false)
  const [contextMenu, setContextMenu]         = useState<ContextMenu | null>(null)
  const [projContextMenu, setProjContextMenu] = useState<ProjContextMenu | null>(null)

  const projectsRef = useRef<Project[]>([])
  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProjects(false); setProjContextMenu(null); setContextMenu(null)
      }
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
    if (!projContextMenu) return
    const handler = () => setProjContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [projContextMenu])

  useEffect(() => { setProjContextMenu(null) }, [showProjects])

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
      setProjects(fixed)

      // Drop any orphaned stack-key entry from the previous model — the
      // active project's sources are the stack now and no separate list
      // is read.
      try { localStorage.removeItem(STACK_KEY) } catch {}

      // Hydrate active project + viewer selection from prior session.
      const savedActive = localStorage.getItem(ACTIVE_KEY)
      const match       = fixed.find(p => p.id === savedActive) ?? fixed[0] ?? null
      setActiveId(match?.id ?? null)

      const allSrc = fixed.flatMap(p => p.sources)
      const savedSelected      = localStorage.getItem(SELECTED_KEY)
      const savedSelectedImage = localStorage.getItem(SELECTED_IMAGE_KEY)
      if (savedSelected      && allSrc.find(s => s.id === savedSelected))      setSelectedId(savedSelected)
      if (savedSelectedImage && allSrc.find(s => s.id === savedSelectedImage)) setSelectedImageId(savedSelectedImage)

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
      // No prior state. activeId stays null until the user creates a project.
      setProjects([])
      setActiveId(null)
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
      // Save on unload regardless of length so a final delete-the-last-
      // project before close also persists.
      saveProjects(projectsRef.current)
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
    if (selectedImageId) localStorage.setItem(SELECTED_IMAGE_KEY, selectedImageId)
    else                 localStorage.removeItem(SELECTED_IMAGE_KEY)
  }, [selectedImageId])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeProject       = projects.find(p => p.id === activeId) ?? null
  const sources             = activeProject?.sources ?? []
  const allSources          = projects.flatMap(p => p.sources)
  const selectedSource      = allSources.find(s => s.id === selectedId)      ?? null
  const selectedImageSource = allSources.find(s => s.id === selectedImageId) ?? null
  const namedProjectCount   = projects.length
  const atProjectLimit      = namedProjectCount >= PROJECT_LIMIT

  // Stack = active project's sources. No separate storage, no separate
  // ordering — switching projects swaps the stack instantly because it's
  // a direct reference to `activeProject.sources`.
  const stackSources: QueuedSource[] = sources
  const stackIds   : string[]        = sources.map(s => s.id)
  const atStackLimit                 = sources.length >= STACK_LIMIT
  const inStack    = (id: string)    => sources.some(s => s.id === id)

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

  function addClip(srcId: string, clip: Clip) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s =>
        s.id !== srcId ? s : { ...s, clips: [...s.clips, clip] }
      ),
    })))
  }

  function updateClip(srcId: string, clipId: string, patch: Partial<Clip>) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s =>
        s.id !== srcId ? s : { ...s, clips: s.clips.map(c => c.id !== clipId ? c : { ...c, ...patch }) }
      ),
    })))
  }

  function reorderClips(srcId: string, fromId: string, afterId: string | null) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s => {
        if (s.id !== srcId) return s
        const clips  = s.clips
        const idx    = clips.findIndex(c => c.id === fromId)
        if (idx === -1) return s
        const moved  = clips[idx]
        const rest   = clips.filter(c => c.id !== fromId)
        if (afterId === null) return { ...s, clips: [moved, ...rest] }
        const afterIdx = rest.findIndex(c => c.id === afterId)
        if (afterIdx === -1) return { ...s, clips: [...rest, moved] }
        const result = [...rest]
        result.splice(afterIdx + 1, 0, moved)
        return { ...s, clips: result }
      }),
    })))
  }

  function removeClip(srcId: string, clipId: string) {
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.map(s =>
        s.id !== srcId ? s : { ...s, clips: s.clips.filter(c => c.id !== clipId) }
      ),
    })))
  }

  function addFragment(fragment: Fragment) {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, fragments: [...(p.fragments ?? []), fragment] }
    ))
  }

  function insertFragment(fragment: Fragment, afterId: string | null) {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p => {
      if (p.id !== projId) return p
      const frags = p.fragments ?? []
      if (afterId === null) return { ...p, fragments: [fragment, ...frags] }
      const idx = frags.findIndex(f => f.id === afterId)
      if (idx === -1) return { ...p, fragments: [...frags, fragment] }
      const result = [...frags]
      result.splice(idx + 1, 0, fragment)
      return { ...p, fragments: result }
    }))
  }

  function removeFragment(fragmentId: string) {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, fragments: (p.fragments ?? []).filter(f => f.id !== fragmentId) }
    ))
  }

  function updateFragment(fragmentId: string, patch: Partial<Fragment>) {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : {
        ...p,
        fragments: (p.fragments ?? []).map(f => f.id !== fragmentId ? f : { ...f, ...patch }),
      }
    ))
  }

  function moveFragment(id: string, afterId: string | null) {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p => {
      if (p.id !== projId) return p
      const frags = p.fragments ?? []
      const idx = frags.findIndex(f => f.id === id)
      if (idx === -1) return p
      const moved = frags[idx]
      const rest  = frags.filter(f => f.id !== id)
      if (afterId === null) return { ...p, fragments: [moved, ...rest] }
      const afterIdx = rest.findIndex(f => f.id === afterId)
      if (afterIdx === -1) return { ...p, fragments: [...rest, moved] }
      const result = [...rest]
      result.splice(afterIdx + 1, 0, moved)
      return { ...p, fragments: result }
    }))
  }

  function clearFragments() {
    const projId = activeIdRef.current
    if (!projId) return
    setProjects(ps => ps.map(p => p.id !== projId ? p : { ...p, fragments: [] }))
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
        warn(`Project full. ${STACK_LIMIT} sources maximum.`)
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
    if (!projId) { warn('Create a project first.'); return }

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

    // Per-project source cap.
    const targetProj  = projectsRef.current.find(p => p.id === projId)
    const room        = STACK_LIMIT - (targetProj?.sources.length ?? 0)
    if (room <= 0) { warn(`Project full. ${STACK_LIMIT} sources maximum.`); return }
    if (list.length > room) list = list.slice(0, room)

    // 250 MB cap: reject the whole batch if it would push storage over the limit.
    const batchBytes = list.reduce((sum, f) => sum + f.size, 0)
    if (await wouldExceedLimit(batchBytes)) {
      warn('Storage limit reached.')
      return
    }

    const newSources = list.map(f => ({
      ...newSource(`file:${f.name}`, f.name),
      fileType: (isImage(f) ? 'image' : 'pdf') as 'pdf' | 'image',
    }))

    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, ...newSources] }
    ))

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
    if (selectedId === srcId) setSelectedId(null)
    if (selectedImageId === srcId) setSelectedImageId(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    Promise.allSettled([deleteFile(srcId), deleteContent(srcId)])
      .then(notifyStorageChanged)
  }

  function removeSelected() {
    if (!selectedIds.size) return
    setProjects(ps => ps.map(p => ({
      ...p,
      sources: p.sources.filter(s => !selectedIds.has(s.id)),
    })))
    if (selectedId && selectedIds.has(selectedId)) setSelectedId(null)
    if (selectedImageId && selectedIds.has(selectedImageId)) setSelectedImageId(null)
    const ids = Array.from(selectedIds)
    Promise.allSettled(ids.flatMap(id => [deleteFile(id), deleteContent(id)]))
      .then(notifyStorageChanged)
    setSelectedIds(new Set())
    setAnchorId(null)
  }

  function createNote(targetProjId?: string) {
    const projId = targetProjId ?? activeIdRef.current
    if (!projId) { warn('Create a project first.'); return }
    const projNow = projectsRef.current.find(p => p.id === projId)
    if (projNow && projNow.sources.length >= STACK_LIMIT) {
      warn(`Project full. ${STACK_LIMIT} sources maximum.`)
      return
    }
    const note = newNote()
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, note] }
    ))
  }

  async function addUrl(url: string, targetProjId?: string) {
    const projId = targetProjId ?? activeIdRef.current
    if (!projId) { warn('Create a project first.'); return }
    const projNow = projectsRef.current.find(p => p.id === projId)
    if (projNow && projNow.sources.length >= STACK_LIMIT) {
      warn(`Project full. ${STACK_LIMIT} sources maximum.`)
      return
    }
    const src = newUrlSource(url)
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, src] }
    ))
  }

  function createProject(name?: string): boolean {
    // No project-count ceiling — only the 250 MB storage cap and the
    // 12-source per-project cap bound the workspace.
    const trimmed = name?.trim() ?? ''
    if (trimmed) {
      const dup = projects.some(p =>
        p.name.trim().toLowerCase() === trimmed.toLowerCase()
      )
      if (dup) return false
    }
    const p = newProject(namedProjectCount + 1)
    if (trimmed) p.name = trimmed
    setProjects(ps => [...ps, p])
    setActiveId(p.id)
    setSelectedId(null)
    setSelectedImageId(null)
    return true
  }

  function switchProject(id: string) {
    if (id === activeId) return
    setActiveId(id)
    // Drop viewer state when the active project changes — the previously
    // selected source belonged to a different project and shouldn't keep
    // showing in the panes.
    setSelectedId(null)
    setSelectedImageId(null)
    setSelectedIds(new Set())
    setAnchorId(null)
  }

  function deleteProject(id: string) {
    // Reap the project's source files from IDB so storage isn't leaked.
    const doomed    = projects.find(p => p.id === id)
    if (!doomed) return
    const sourceIds = doomed.sources.map(s => s.id)

    const remaining = projects.filter(p => p.id !== id)
    setProjects(remaining)
    setSelectedId(null)
    setSelectedImageId(null)
    setSelectedIds(new Set())
    setAnchorId(null)

    if (activeId === id) {
      // Move to first remaining project if any, else clear active state.
      setActiveId(remaining[0]?.id ?? null)
      setShowProjects(false)
    }

    if (sourceIds.length) {
      Promise.allSettled(
        sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)])
      ).then(notifyStorageChanged)
    }
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
    setSelectedImageId(null)
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

  function openInPane(id: string) {
    const src = allSources.find(s => s.id === id)
    if (!src) return
    if (src.fileType === 'image') setSelectedImageId(id)
    else setSelectedId(id)
  }

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: AppState = {
    mounted, projects, activeId, selectedId, selectedIds, anchorId,
    showProjects, contextMenu, projContextMenu,
    activeProject, sources, allSources, selectedSource, selectedImageId, selectedImageSource,
    stackIds, stackSources, stackLimit: STACK_LIMIT, atStackLimit, inStack,
    namedProjectCount, atProjectLimit,
    setShowProjects, setSelectedId, setSelectedImageId, setSelectedIds, setAnchorId,
    setContextMenu, setProjContextMenu,
    setProjects, updateProject, patchSource, moveSource, moveSourceToProject, moveProject,
    addClip, removeClip, updateClip, reorderClips,
    addFragment, insertFragment, removeFragment, updateFragment, moveFragment, clearFragments,
    uploadFiles, retrySource,
    removeSource, removeSelected,
    createNote, addUrl, createProject, switchProject, deleteProject,
    addToStack, removeFromStack, clearStack, reorderStack, openInPane,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { STORAGE_LIMIT_BYTES }
