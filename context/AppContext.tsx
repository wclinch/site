'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Project, QueuedSource, Clip, Fragment } from '@/lib/types'
import {
  ACTIVE_KEY, SELECTED_KEY, SELECTED_IMAGE_KEY,
  newProject, newSource, newNote, newUrlSource,
  loadProjects, saveProjects,
} from '@/lib/storage'
import { storeFile, deleteFile, getFile, storeContent, getContent, deleteContent } from '@/lib/idb'
import { extractContent } from '@/lib/extract'
import { wouldExceedLimit, STORAGE_LIMIT_BYTES } from '@/lib/storage-limit'

export const INBOX_ID = '__inbox__'
export const PROJECT_LIMIT = 3

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
  uploadFiles: (files: FileList | File[], targetProjId?: string) => Promise<void>
  retrySource: (srcId: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  createNote: (targetProjId?: string) => void
  addUrl: (url: string, targetProjId?: string) => Promise<void>
  createProject: (name?: string) => boolean
  switchProject: (id: string) => void
  deleteProject: (id: string) => void
}

const AppContext = createContext<AppState | null>(null)

function makeInbox(): Project {
  return {
    id: INBOX_ID,
    name: '',
    sources: [],
    draft: '',
    draftTitle: '',
    fragments: [],
    scratchpad: '',
    projectDraft: '',
  }
}

// Dispatches a transient warning toast (consumed by app/app/page.tsx).
function warn(msg: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('proof-storage-warning', { detail: msg }))
}

// Fires after any IDB write/delete so storage-aware UI (the badge) can re-poll.
// `navigator.storage.estimate()` is approximate and lags briefly after deletes,
// so listeners should be tolerant of the first reading being slightly stale.
function notifyStorageChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('proof-storage-changed'))
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted]           = useState(false)
  const [projects, setProjects]         = useState<Project[]>([])
  const [activeId, setActiveId]         = useState<string | null>(null)
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId]         = useState<string | null>(null)
  const [showProjects, setShowProjects] = useState(false)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)
  const [projContextMenu, setProjContextMenu] = useState<ProjContextMenu | null>(null)

  const projectsRef    = useRef<Project[]>([])

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
    if (saved.length) {
      let fixed = saved.map(proj => ({
        ...proj,
        sources: proj.sources.map(src =>
          src.status === 'extracting' ? { ...src, status: 'queued' as const } : src
        ),
      }))
      // Ensure inbox project always exists
      if (!fixed.some(p => p.id === INBOX_ID)) {
        fixed = [makeInbox(), ...fixed]
      }
      setProjects(fixed)

      const savedActive   = localStorage.getItem(ACTIVE_KEY)
      const match         = fixed.find(p => p.id === savedActive) ?? fixed.find(p => p.id !== INBOX_ID) ?? fixed[0]
      setActiveId(match.id)
      const savedSelected = localStorage.getItem(SELECTED_KEY)
      const allSrc = fixed.flatMap(p => p.sources)
      if (savedSelected && allSrc.find(s => s.id === savedSelected)) {
        setSelectedId(savedSelected)
      }
      const savedSelectedImage = localStorage.getItem(SELECTED_IMAGE_KEY)
      if (savedSelectedImage && allSrc.find(s => s.id === savedSelectedImage)) {
        setSelectedImageId(savedSelectedImage)
      }

      ;(async () => {
        for (const proj of fixed) {
          for (const src of proj.sources) {
            if (src.status !== 'done') continue
            if (src.fileType === 'image') continue
            if (src.fileType === 'note')  continue
            if (src.fileType === 'url')   continue
            try {
              let content = await getContent(src.id) as import('@/lib/types').DocContent | null
              if (!content) {
                const file = await getFile(src.id)
                if (file) {
                  content = await extractContent(file)
                  storeContent(src.id, content).catch(() => {})
                }
              }
              if (content) {
                patchSource(proj.id, src.id, { content })
              } else {
                patchSource(proj.id, src.id, { status: 'queued' as const, error: null })
              }
            } catch {
              patchSource(proj.id, src.id, { status: 'queued' as const, error: null })
            }
          }
        }
      })()
    } else {
      const inbox = makeInbox()
      setProjects([inbox])
      setActiveId(inbox.id)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    projectsRef.current = projects
    if (projects.length) saveProjects(projects)
  }, [projects])

  useEffect(() => {
    function onBeforeUnload() {
      if (projectsRef.current.length) saveProjects(projectsRef.current)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => { if (activeId) localStorage.setItem(ACTIVE_KEY, activeId) }, [activeId])
  useEffect(() => {
    if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
    else localStorage.removeItem(SELECTED_KEY)
  }, [selectedId])
  useEffect(() => {
    if (selectedImageId) localStorage.setItem(SELECTED_IMAGE_KEY, selectedImageId)
    else localStorage.removeItem(SELECTED_IMAGE_KEY)
  }, [selectedImageId])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeProject       = projects.find(p => p.id === activeId) ?? null
  const sources             = activeProject?.sources ?? []
  const allSources          = projects.flatMap(p => p.sources)
  const selectedSource      = allSources.find(s => s.id === selectedId) ?? null
  const selectedImageSource = allSources.find(s => s.id === selectedImageId) ?? null
  const namedProjectCount   = projects.filter(p => p.id !== INBOX_ID).length
  const atProjectLimit      = namedProjectCount >= PROJECT_LIMIT

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

  function moveSourceToProject(srcId: string, targetProjId: string) {
    setProjects(ps => {
      const src = ps.flatMap(p => p.sources).find(s => s.id === srcId)
      if (!src) return ps
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
    const projId = targetProjId ?? INBOX_ID

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

    // 250 MB cap: reject the whole batch if it would push storage over the limit.
    const batchBytes = list.reduce((sum, f) => sum + f.size, 0)
    if (await wouldExceedLimit(batchBytes)) {
      warn('Storage limit reached. Delete files to continue.')
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
        // Fire the storage event the moment the file lands in IDB — not
        // after PDF extraction (which can take a couple of seconds and
        // would make the badge feel laggy for the user).
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
    // Fire the storage-changed event only after both IDB deletes complete,
    // so the badge re-poll sees the freed bytes (otherwise the estimate is stale).
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
    const projId = targetProjId ?? INBOX_ID
    const note = newNote()
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, note] }
    ))
  }

  async function addUrl(url: string, targetProjId?: string) {
    const projId = targetProjId ?? INBOX_ID
    const src = newUrlSource(url)
    setProjects(ps => ps.map(p =>
      p.id !== projId ? p : { ...p, sources: [...p.sources, src] }
    ))
    // Title fetch removed — local-only mode. Hostname-derived label
    // is already set inside newUrlSource().
  }

  function createProject(name?: string): boolean {
    // Enforce 3-project ceiling.
    if (namedProjectCount >= PROJECT_LIMIT) {
      warn(`Project limit reached (${PROJECT_LIMIT}/${PROJECT_LIMIT}). Delete a project to add more.`)
      return false
    }
    const p = newProject(namedProjectCount + 1)
    if (name) p.name = name
    setProjects(ps => [...ps, p])
    setActiveId(p.id)
    setSelectedId(null)
    return true
  }

  function switchProject(id: string) {
    setActiveId(id)
    setSelectedId(null)
  }

  function deleteProject(id: string) {
    if (id === INBOX_ID) return

    // Reap the project's source files from IDB. Without this, deleting a
    // project would leak its PDFs/images — the UI forgets them but the
    // bytes stay on disk, so the storage badge wouldn't budge and the
    // 250 MB cap would slowly fill with orphaned data.
    //
    // We delete by source id for every source the project owned. Notes
    // and URLs have no IDB entry; deleteFile/deleteContent on a missing
    // key is a successful no-op, so the broad sweep is safe.
    const doomed   = projects.find(p => p.id === id)
    const sourceIds = doomed?.sources.map(s => s.id) ?? []

    const updated = projects.filter(p => p.id !== id)
    setSelectedId(null)
    setSelectedIds(new Set())
    if (!updated.some(p => p.id !== INBOX_ID)) {
      // Only inbox left — that's fine, just keep it
      setProjects(updated)
      setActiveId(INBOX_ID)
      setShowProjects(false)
    } else {
      setProjects(updated)
      if (activeId === id) {
        const next = updated.find(p => p.id !== INBOX_ID) ?? updated[0]
        setActiveId(next.id)
      }
    }

    if (sourceIds.length) {
      Promise.allSettled(
        sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)])
      ).then(notifyStorageChanged)
    }
  }

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: AppState = {
    mounted, projects, activeId, selectedId, selectedIds, anchorId,
    showProjects, contextMenu, projContextMenu,
    activeProject, sources, allSources, selectedSource, selectedImageId, selectedImageSource,
    namedProjectCount, atProjectLimit,
    setShowProjects, setSelectedId, setSelectedImageId, setSelectedIds, setAnchorId,
    setContextMenu, setProjContextMenu,
    setProjects, updateProject, patchSource, moveSource, moveSourceToProject,
    addClip, removeClip, updateClip, reorderClips,
    addFragment, insertFragment, removeFragment, updateFragment, moveFragment, clearFragments,
    uploadFiles, retrySource,
    removeSource, removeSelected,
    createNote, addUrl, createProject, switchProject, deleteProject,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// Re-exported for components that just need the cap value.
export { STORAGE_LIMIT_BYTES }
