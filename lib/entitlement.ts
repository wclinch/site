// Entitlement model — Free vs Pro.
//
// Free: 1 workspace, 10 uploaded Documents, 150 MB.
// Pro:  unlimited workspaces, unlimited Documents, 5 GB.
//
// Pages (saved URLs) are always unlimited and do not count toward storage.
// Tier is determined by whether a valid license key is cached in localStorage.

import { loadLicense, saveLicense, clearLicense } from './license'
import type { LicenseState } from './license'

export const FREE_WORKSPACES    = 1
export const FREE_DOC_COUNT     = 10
export const FREE_STORAGE_MB    = 150
export const FREE_STORAGE_BYTES = FREE_STORAGE_MB * 1024 * 1024

export const PRO_DOC_COUNT    = Infinity
export const PRO_STORAGE_MB   = 5120
export const PRO_STORAGE_BYTES = PRO_STORAGE_MB * 1024 * 1024

export interface Limits {
  workspaces:   number   // Infinity = unlimited
  docCount:     number   // Infinity = unlimited
  storageBytes: number
}

export const FREE_LIMITS: Limits = {
  workspaces:   FREE_WORKSPACES,
  docCount:     FREE_DOC_COUNT,
  storageBytes: FREE_STORAGE_BYTES,
}

export const PRO_LIMITS: Limits = {
  workspaces:   Infinity,
  docCount:     Infinity,
  storageBytes: PRO_STORAGE_BYTES,
}

export function checkIsPro(): boolean {
  if (typeof window === 'undefined') return false
  // Subscription entitlement cache (written by Polar session check)
  try {
    const raw = localStorage.getItem('proof-v3-entitlement')
    if (raw) {
      const { isPro } = JSON.parse(raw) as { isPro?: boolean }
      if (typeof isPro === 'boolean') return isPro
    }
  } catch {}
  // Fall back to legacy license key (existing beta users)
  return loadLicense() !== null
}

export { loadLicense, saveLicense, clearLicense }
export type { LicenseState }
