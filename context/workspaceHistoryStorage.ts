import type { WorkspaceSnapshot } from './workspaceHistoryTypes'

export const MAX_SNAPSHOTS     = 10
export const HISTORY_THROTTLE_MS = 5 * 60 * 1000  // 5 minutes

const KEY_PREFIX = 'proof-workspace-history:'

export function historyStorageKey(workspaceId: string): string {
  return `${KEY_PREFIX}${workspaceId}`
}

// Returns snapshots newest-first.
export function loadWorkspaceHistory(workspaceId: string): WorkspaceSnapshot[] {
  try {
    const raw = localStorage.getItem(historyStorageKey(workspaceId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// Persists snapshots newest-first, capped at MAX_SNAPSHOTS.
export function saveWorkspaceHistory(workspaceId: string, history: WorkspaceSnapshot[]): void {
  try {
    localStorage.setItem(historyStorageKey(workspaceId), JSON.stringify(history.slice(0, MAX_SNAPSHOTS)))
  } catch {}
}

// Prepends snapshot and trims to cap.
export function appendWorkspaceSnapshot(workspaceId: string, snapshot: WorkspaceSnapshot): void {
  const history = loadWorkspaceHistory(workspaceId)
  saveWorkspaceHistory(workspaceId, [snapshot, ...history])
}

export function clearWorkspaceHistoryStorage(workspaceId: string): void {
  try { localStorage.removeItem(historyStorageKey(workspaceId)) } catch {}
}
