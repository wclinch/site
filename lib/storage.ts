import type { Project, HistoryEntry } from './types'

const STORAGE_KEY  = 'proof-v3-projects'
export const ACTIVE_KEY          = 'proof-v3-active'
export const SELECTED_KEY        = 'proof-v3-selected'
export const SELECTED_KEY_2      = 'proof-v3-selected-2'
// Legacy localStorage key from the pre-refactor model where the stack
// was a separately-stored pinned-ID list. The new project-scoped model
// derives the stack from the active project's sources directly, so this
// key is no longer written. Exported only so AppContext can wipe stale
// entries on first load after the migration.
export const STACK_KEY           = 'proof-v3-stack'
// Per-project source cap. 12 was the old "stack" limit; reusing it here
// because the panel is sized for ~12 rows visible without scroll.
export const STACK_LIMIT         = 12

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function newProject(n: number): Project {
  return {
    id: uid(),
    name: `Workspace ${n}`,
    sources: [],
  }
}

export function newSource(raw: string, label?: string): import('./types').QueuedSource {
  return { id: uid(), raw, status: 'queued', error: null, label }
}

export function newNote(): import('./types').QueuedSource {
  return { id: uid(), raw: 'page', label: 'Page', status: 'done', error: null, fileType: 'note', noteContent: '' }
}

export function newUrlSource(url: string, title?: string): import('./types').QueuedSource {
  let label = title ?? ''
  if (!label) {
    try { label = new URL(url).hostname.replace(/^www\./, '') } catch { label = url }
  }
  return { id: uid(), raw: url, url, label, status: 'done', error: null, fileType: 'url' }
}

const HISTORY_KEY = 'proof-v3-history'
const MAX_HISTORY_PER_WS = 20

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null') ?? []
  } catch { return [] }
}

export function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {}
}

export function addHistoryEntry(entry: HistoryEntry) {
  const all = loadHistory()
  // Skip if identical to most recent entry for this workspace
  const latest = [...all].reverse().find(e => e.wsId === entry.wsId)
  if (latest) {
    const same =
      latest.wsName === entry.wsName &&
      latest.sel1 === entry.sel1 &&
      latest.sel2 === entry.sel2 &&
      latest.splitView === entry.splitView &&
      JSON.stringify(latest.view1) === JSON.stringify(entry.view1) &&
      JSON.stringify(latest.view2) === JSON.stringify(entry.view2) &&
      JSON.stringify(latest.docs.map(d => d.id).sort()) === JSON.stringify(entry.docs.map(d => d.id).sort()) &&
      JSON.stringify(latest.pages.map(p => p.id).sort()) === JSON.stringify(entry.pages.map(p => p.id).sort())
    if (same) return
  }
  const wsEntries = all.filter(e => e.wsId === entry.wsId)
  const otherEntries = all.filter(e => e.wsId !== entry.wsId)
  const trimmed = [...wsEntries.slice(-(MAX_HISTORY_PER_WS - 1)), entry]
  saveHistory([...otherEntries, ...trimmed])
}

export function deleteHistoryEntry(id: string) {
  saveHistory(loadHistory().filter(e => e.id !== id))
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
      detail: 'Storage full. Changes may not be saved.',
    }))
  }
}
