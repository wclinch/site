import { getStoredFilesSize } from './idb'

// Storage usage caps for Site's local-only mode.
//
// 250 MB ceiling. We count only the bytes the user actually uploaded
// (summed from the IndexedDB PDF/image store), not browser overhead
// or our derived extracted-text JSON. That way an empty workspace
// reads 0 MB and the limit math matches user intuition.

export const STORAGE_LIMIT_BYTES = 250 * 1024 * 1024

// Sum the size of every file stored in IDB. Falls back to 0 in any
// non-browser/unsupported context (server render, private modes, etc.) —
// the safe permissive default for a local tool.
export async function getStorageUsage(): Promise<number> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return 0
  try {
    return await getStoredFilesSize()
  } catch {
    return 0
  }
}

// True if adding `additionalBytes` would exceed the cap.
export async function wouldExceedLimit(additionalBytes: number): Promise<boolean> {
  const used = await getStorageUsage()
  return used + additionalBytes > STORAGE_LIMIT_BYTES
}

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
