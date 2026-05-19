import type { WorkspaceSnapshot } from './workspaceHistoryTypes'
import type { ViewPage, SavedResearchTab } from '@/lib/types'
import { loadWorkspaceHistory, HISTORY_THROTTLE_MS } from './workspaceHistoryStorage'

function isRealUrl(url: string): boolean {
  return !!(url && url !== 'about:blank')
}

// A state is meaningful if it has at least one View, Split View is on,
// or at least one Web tab has a real URL.
export function isMeaningfulState(
  view1Page: ViewPage | null,
  view2Page: ViewPage | null,
  splitView: boolean,
  researchTabs: SavedResearchTab[],
): boolean {
  if (view1Page) return true
  if (view2Page) return true
  if (splitView) return true
  return researchTabs.some(t => isRealUrl(t.url))
}

export function isMeaningfulSnapshot(snap: WorkspaceSnapshot): boolean {
  return isMeaningfulState(snap.view1Page, snap.view2Page, snap.splitView, snap.researchTabs)
}

// Produces a stable string for dedup — only covers the fields we restore.
function stateKey(
  view1Page: ViewPage | null,
  view2Page: ViewPage | null,
  splitView: boolean,
  researchTabs: SavedResearchTab[],
): string {
  return JSON.stringify({ v1: view1Page, v2: view2Page, split: splitView, tabs: researchTabs })
}

// Returns true when a new snapshot should be saved.
// force = true (manual save / beforeunload) skips the throttle but not the other checks.
export function shouldSaveSnapshot(
  workspaceId: string,
  view1Page: ViewPage | null,
  view2Page: ViewPage | null,
  splitView: boolean,
  researchTabs: SavedResearchTab[],
  force: boolean,
): boolean {
  if (!isMeaningfulState(view1Page, view2Page, splitView, researchTabs)) return false

  const history = loadWorkspaceHistory(workspaceId)
  const currentKey = stateKey(view1Page, view2Page, splitView, researchTabs)

  if (history.length === 0) return true

  const lastKey = stateKey(
    history[0].view1Page, history[0].view2Page,
    history[0].splitView, history[0].researchTabs,
  )
  if (currentKey === lastKey) return false

  if (!force) {
    const elapsed = Date.now() - history[0].timestamp
    if (elapsed < HISTORY_THROTTLE_MS) return false
  }

  return true
}

export function buildSnapshot(
  workspaceId: string,
  workspaceName: string,
  view1Page: ViewPage | null,
  view2Page: ViewPage | null,
  splitView: boolean,
  researchTabs: SavedResearchTab[],
): WorkspaceSnapshot {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId,
    workspaceName,
    timestamp: Date.now(),
    view1Page,
    view2Page,
    splitView,
    researchTabs,
  }
}

export function describeSnapshot(snap: WorkspaceSnapshot): string {
  const parts: string[] = []

  if (snap.view1Page && snap.view2Page) parts.push('View 1 + View 2')
  else if (snap.view1Page) parts.push('View 1')
  else if (snap.view2Page) parts.push('View 2')

  if (snap.splitView) parts.push('Split View')

  const realTabs = snap.researchTabs.filter(t => isRealUrl(t.url))
  if (realTabs.length === 1) parts.push('1 Web tab')
  else if (realTabs.length > 1) parts.push(`${realTabs.length} Web tabs`)

  return parts.join(' + ')
}

export function formatSnapshotTime(timestamp: number): string {
  const diff    = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(diff / 3_600_000)
  const days    = Math.floor(diff / 86_400_000)
  if (minutes < 1)   return 'Just now'
  if (minutes < 60)  return `${minutes}m ago`
  if (hours   < 24)  return `${hours}h ago`
  if (days    === 1) return 'Yesterday'
  return `${days}d ago`
}
