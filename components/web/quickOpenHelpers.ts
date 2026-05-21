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

export function loadPins(workspaceId: string): string[] {
  try { return JSON.parse(localStorage.getItem(pinsKey(workspaceId)) || '[]') } catch { return [] }
}

export function savePins(workspaceId: string, pins: string[]) {
  try { localStorage.setItem(pinsKey(workspaceId), JSON.stringify(pins)) } catch {}
}

