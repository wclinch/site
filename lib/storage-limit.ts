import { getStoredFilesSize } from './idb'
import { FREE_STORAGE_BYTES } from './entitlement'

// Legacy 250 MB constant kept for backward compat with any remaining imports.
// Actual enforced limit is tier-dependent — callers should pass limitBytes explicitly.
export const STORAGE_LIMIT_BYTES = 250 * 1024 * 1024  // Free tier

export async function getStorageUsage(): Promise<number> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return 0
  try { return await getStoredFilesSize() } catch { return 0 }
}

// True if adding `additionalBytes` would exceed `limitBytes`.
// Defaults to the Free tier cap when no limit is passed.
export async function wouldExceedLimit(
  additionalBytes: number,
  limitBytes = FREE_STORAGE_BYTES,
): Promise<boolean> {
  const used = await getStorageUsage()
  return used + additionalBytes > limitBytes
}

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
