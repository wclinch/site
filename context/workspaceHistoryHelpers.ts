import type { WorkspaceSnapshot } from './workspaceHistoryTypes'
import type { ViewPage, SavedResearchTab } from '@/lib/types'
import { loadWorkspaceHistory, HISTORY_THROTTLE_MS } from './workspaceHistoryStorage'

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
// force = true (manual save) skips the throttle but still skips identical state.
export function shouldSaveSnapshot(
  workspaceId: string,
  view1Page: ViewPage | null,
  view2Page: ViewPage | null,
  splitView: boolean,
  researchTabs: SavedResearchTab[],
  force: boolean,
): boolean {
  const history = loadWorkspaceHistory(workspaceId)
  const currentKey = stateKey(view1Page, view2Page, splitView, researchTabs)

  if (history.length === 0) return true

  const lastKey = stateKey(
    history[0].view1Page, history[0].view2Page,
    history[0].splitView, history[0].researchTabs,
  )
  if (currentKey === lastKey) return false          // identical — skip always

  if (!force) {
    const elapsed = Date.now() - history[0].timestamp
    if (elapsed < HISTORY_THROTTLE_MS) return false // too soon
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
  if (snap.researchTabs.length > 0)
    parts.push(`${snap.researchTabs.length} tab${snap.researchTabs.length === 1 ? '' : 's'}`)
  if (snap.view1Page && snap.view2Page) parts.push('Split view')
  else if (snap.view1Page || snap.view2Page) parts.push('View pinned')
  else if (snap.splitView) parts.push('Split view')
  return parts.length > 0 ? parts.join(' · ') : 'No active content'
}

export function formatSnapshotTime(timestamp: number): string {
  const diff    = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(diff / 3_600_000)
  const days    = Math.floor(diff / 86_400_000)
  if (minutes < 1)  return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours   < 24) return `${hours}h ago`
  if (days    === 1) return 'Yesterday'
  return `${days}d ago`
}
