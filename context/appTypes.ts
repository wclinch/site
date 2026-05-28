import type { Thread, Source, ViewTab } from '@/lib/types'
import type { Limits } from '@/lib/entitlement'

export interface ContextMenu { srcId: string; x: number; y: number }

export interface ThreadInheritOpts {
  originThreadId: string
  originThreadTitle: string
  inheritedContextSummary: string
}

export interface AppState {
  mounted: boolean
  threads: Thread[]
  activeId: string | null
  selectedId: string | null   // derived: active tab's srcId
  selectedIds: Set<string>
  anchorId: string | null
  contextMenu: ContextMenu | null
  // derived
  activeThread: Thread | null
  sources: Source[]
  allSources: Source[]
  selectedSource: Source | null
  // center view tabs
  viewTabs: ViewTab[]
  activeViewTabId: string | null
  openInView: (srcId: string) => void
  openUrlInView: (url: string, title: string, srcId?: string) => void
  closeViewTab: (tabId: string) => void
  switchViewTab: (tabId: string) => void
  reorderViewTabs: (fromId: string, toId: string) => void
  limits: Limits
  // setters
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  setContextMenu: (m: ContextMenu | null) => void
  // actions
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  updateThread: (id: string, patch: Partial<Thread>) => void
  patchSource: (threadId: string, srcId: string, patch: Partial<Source>) => void
  moveSource: (srcId: string, toIndex: number) => void
  moveSourceToThread: (srcId: string, targetThreadId: string) => void
  uploadFiles: (files: FileList | File[], targetThreadId?: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  addSourceToThread: (srcId: string, toThreadId: string) => string | null
  addUrlToThread: (threadId: string, url: string, title: string) => { name: string | null; srcId: string } | null
  removeSourceFromThread: (srcId: string, threadId: string) => void
  restoreArchivedSource: (srcId: string, threadId: string) => void
  addUrl: (url: string, targetThreadId?: string, label?: string) => Promise<void>
  // Thread actions
  switchThread: (id: string) => void
  newThread: (opts?: ThreadInheritOpts) => void
  saveThread: (name?: string) => void
  removeThread: (targetId?: string) => void
  removeThreadSoft: (targetId: string) => void
  commitThreadRemoval: (thread: Thread) => void
  restoreThread: (thread: Thread, insertIdx: number) => void
}
