import type { Thread } from './types'

const STORAGE_KEY  = 'site-v3-projects'
export const ACTIVE_KEY          = 'site-v3-active'
export const SELECTED_KEY        = 'site-v3-selected'
export const SELECTED_KEY_2      = 'site-v3-selected-2'
// Legacy localStorage key from the pre-refactor model where the stack
// was a separately-stored pinned-ID list. The new project-scoped model
// derives the stack from the active project's sources directly, so this
// key is no longer written. Exported only so AppContext can wipe stale
// entries on first load after the migration.
export const STACK_KEY           = 'site-v3-stack'
// Per-thread source cap. 12 was the old "stack" limit; reusing it here
// because the panel is sized for ~12 rows visible without scroll.
export const STACK_LIMIT         = 12

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function newThread(n: number): Thread {
  return {
    id: uid(),
    name: `Thread ${n}`,
    sources: [],
  }
}

export function newSource(raw: string, label?: string): import('./types').Source {
  return { id: uid(), raw, status: 'queued', error: null, label }
}

export function newNote(): import('./types').Source {
  return { id: uid(), raw: 'page', label: 'Page', status: 'done', error: null, fileType: 'note', noteContent: '' }
}

export function newUrlSource(url: string, title?: string): import('./types').Source {
  let label = title ?? ''
  if (!label) {
    try { label = new URL(url).hostname.replace(/^www\./, '') } catch { label = url }
  }
  return { id: uid(), raw: url, url, label, status: 'done', error: null, fileType: 'url' }
}


export function loadThreads(): Thread[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? []
  } catch {
    return []
  }
}

export function saveThreads(ps: Thread[]) {
  try {
    // Strip extracted content — stored separately in IndexedDB to keep
    // localStorage small and prevent quota failures on large PDFs.
    const stripped = ps.map(p => ({
      ...p,
      sources: p.sources.map(s => ({ ...s, content: undefined })),
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped))
  } catch {
    window.dispatchEvent(new CustomEvent('site-storage-warning', {
      detail: 'Storage full. Changes may not be saved.',
    }))
  }
}

// Migrates proof-v3-* and proof-* localStorage keys to site-* equivalents.
// Runs once on startup before loadThreads(). Safe to call multiple times.
export function migrateStorage() {
  if (typeof window === 'undefined') return
  const simple: [string, string][] = [
    ['proof-v3-projects',      'site-v3-projects'],
    ['proof-v3-active',        'site-v3-active'],
    ['proof-v3-research-tabs', 'site-v3-research-tabs'],
    ['proof-v3-auth-session',  'site-v3-auth-session'],
    ['proof-v3-entitlement',   'site-v3-entitlement'],
    ['proof-v3-credentials',   'site-v3-credentials'],
    ['proof-activity-log',     'site-activity-log'],
    ['proof-modal-open',       'site-modal-open'],
  ]
  for (const [from, to] of simple) {
    try {
      const val = localStorage.getItem(from)
      if (val !== null && localStorage.getItem(to) === null) localStorage.setItem(to, val)
      localStorage.removeItem(from)
    } catch {}
  }
  // Pattern-based: proof-archive-* and proof-layout:*
  try {
    for (const key of [...Object.keys(localStorage)]) {
      if (key.startsWith('proof-archive-')) {
        const to  = 'site-archive-' + key.slice('proof-archive-'.length)
        const val = localStorage.getItem(key)
        if (val !== null && localStorage.getItem(to) === null) localStorage.setItem(to, val)
        localStorage.removeItem(key)
      } else if (key.startsWith('proof-layout:')) {
        const to  = 'site-layout:' + key.slice('proof-layout:'.length)
        const val = localStorage.getItem(key)
        if (val !== null && localStorage.getItem(to) === null) localStorage.setItem(to, val)
        localStorage.removeItem(key)
      } else if (
        key === 'proof-v3-stack' || key === 'proof-v3-selected' ||
        key === 'proof-v3-selected-2' || key === 'proof-v3-selected-image'
      ) {
        localStorage.removeItem(key)
      }
    }
  } catch {}
}
