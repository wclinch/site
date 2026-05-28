export const FREE_DOC_COUNT     = 50
export const FREE_STORAGE_MB    = 250
export const FREE_STORAGE_BYTES = FREE_STORAGE_MB * 1024 * 1024

export interface Limits {
  workspaces:   number
  docCount:     number
  storageBytes: number
}

export const LIMITS: Limits = {
  workspaces:   Infinity,
  docCount:     FREE_DOC_COUNT,
  storageBytes: FREE_STORAGE_BYTES,
}
