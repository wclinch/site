const DB_NAME       = 'proof-files'
const PDF_STORE     = 'pdfs'
const CONTENT_STORE = 'contents'
const VERSION       = 5   // v4 added visualclips store; v5 removes it

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PDF_STORE))     db.createObjectStore(PDF_STORE)
      if (!db.objectStoreNames.contains(CONTENT_STORE)) db.createObjectStore(CONTENT_STORE)
      if (db.objectStoreNames.contains('visualclips'))  db.deleteObjectStore('visualclips')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function storeFile(id: string, file: File): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(PDF_STORE, 'readwrite').objectStore(PDF_STORE).put(file, id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function getFile(id: string): Promise<File | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(PDF_STORE, 'readonly').objectStore(PDF_STORE).get(id)
    req.onsuccess = () => resolve((req.result as File) ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(PDF_STORE, 'readwrite').objectStore(PDF_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function storeContent(id: string, content: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(CONTENT_STORE, 'readwrite').objectStore(CONTENT_STORE).put(content, id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function getContent(id: string): Promise<unknown | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(CONTENT_STORE, 'readonly').objectStore(CONTENT_STORE).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function deleteContent(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(CONTENT_STORE, 'readwrite').objectStore(CONTENT_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// Wipe every entry from both stores. Used by the "Reset all data" path
// in StorageBadge — handy for clearing orphaned files left behind by
// older builds (early versions of deleteProject didn't reap their
// sources) and for users who just want a clean slate.
export async function clearAllStored(): Promise<void> {
  const db = await openDb()
  await Promise.all([PDF_STORE, CONTENT_STORE].map(store =>
    new Promise<void>((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).clear()
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  ))
}

// Sum byte-size of every File/Blob in the PDF store. This is the figure we
// surface to the user — it counts only files they uploaded, not the IDB
// database overhead or extracted-text JSON. So an empty workspace reads as
// 0 MB instead of the ~0.1 MB baseline that `navigator.storage.estimate()`
// reports.
export async function getStoredFilesSize(): Promise<number> {
  const db = await openDb()
  async function sumStore(store: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let total = 0
      const req = db.transaction(store, 'readonly').objectStore(store).openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          const val = cursor.value as Blob | undefined
          if (val && typeof val.size === 'number') total += val.size
          cursor.continue()
        } else {
          resolve(total)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }
  return sumStore(PDF_STORE)
}
