import type { Project } from './types'

const STORAGE_KEY  = 'proof-v3-projects'
export const ACTIVE_KEY          = 'proof-v3-active'
export const SELECTED_KEY        = 'proof-v3-selected'
export const SELECTED_IMAGE_KEY  = 'proof-v3-selected-image'
// Source Stack — the pinned ingestion queue at the bottom of the sidebar.
// Stores an ordered list of source IDs (NOT sources themselves); the
// resolved sources are derived from `allSources` so deletes flow through
// automatically. Capped at STACK_LIMIT to keep the panel scrollable.
export const STACK_KEY           = 'proof-v3-stack'
export const STACK_LIMIT         = 12

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function newProject(n: number): Project {
  return {
    id: uid(),
    name: `Untitled-${n}`,
    sources: [],
    draft: '',
    draftTitle: '',
    fragments: [],
    scratchpad: '',
    projectDraft: '',
  }
}

export function newSource(raw: string, label?: string): import('./types').QueuedSource {
  return { id: uid(), raw, status: 'queued', error: null, label, clips: [] }
}

export function newNote(): import('./types').QueuedSource {
  return { id: uid(), raw: 'page', label: 'Page', status: 'done', error: null, fileType: 'note', noteContent: '', clips: [] }
}

export function newUrlSource(url: string, title?: string): import('./types').QueuedSource {
  let label = title ?? ''
  if (!label) {
    try { label = new URL(url).hostname.replace(/^www\./, '') } catch { label = url }
  }
  return { id: uid(), raw: url, url, label, status: 'done', error: null, fileType: 'url', clips: [] }
}

export function loadProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? []
  } catch {
    return []
  }
}

export function saveProjects(ps: Project[]) {
  try {
    // Strip extracted content — stored separately in IndexedDB to keep
    // localStorage small and prevent quota failures on large PDFs.
    const stripped = ps.map(p => ({
      ...p,
      sources: p.sources.map(s => ({ ...s, content: undefined })),
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped))
  } catch {
    window.dispatchEvent(new CustomEvent('proof-storage-warning', {
      detail: 'Storage full — changes may not be saved.',
    }))
  }
}
