import { HOME_SHORTCUTS } from './quickOpenDefaults'

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pinsKey(workspaceId: string) { return `proof-quickopen-pins:${workspaceId}` }
export function shuffleKey(workspaceId: string) { return `proof-quickopen-shuffle:${workspaceId}` }

export function loadPins(workspaceId: string): string[] {
  try { return JSON.parse(localStorage.getItem(pinsKey(workspaceId)) || '[]') } catch { return [] }
}

export function savePins(workspaceId: string, pins: string[]) {
  try { localStorage.setItem(pinsKey(workspaceId), JSON.stringify(pins)) } catch {}
}

export function loadShuffleOrder(workspaceId: string): [string, string][] {
  try {
    const saved = JSON.parse(localStorage.getItem(shuffleKey(workspaceId)) || '[]') as string[]
    if (!saved.length) return []
    const map = new Map(HOME_SHORTCUTS)
    const seen = new Set<string>()
    const ordered: [string, string][] = []
    for (const k of saved) {
      if (map.has(k)) { ordered.push([k, map.get(k)!]); seen.add(k) }
    }
    for (const [k, l] of HOME_SHORTCUTS) {
      if (!seen.has(k)) ordered.push([k, l])
    }
    return ordered
  } catch { return [] }
}

export function saveShuffleOrder(workspaceId: string, order: [string, string][]) {
  try { localStorage.setItem(shuffleKey(workspaceId), JSON.stringify(order.map(([k]) => k))) } catch {}
}

export function getOrCreateShuffle(workspaceId: string): [string, string][] {
  const saved = loadShuffleOrder(workspaceId)
  if (saved.length) return saved
  const fresh = shuffleArray(HOME_SHORTCUTS)
  saveShuffleOrder(workspaceId, fresh)
  return fresh
}
