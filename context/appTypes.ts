import type { Project, QueuedSource, ViewTab } from '@/lib/types'
import type { Limits } from '@/lib/entitlement'
import type { AuthUser, SignInResult } from '@/lib/auth'

export interface ContextMenu { srcId: string; x: number; y: number }

export interface AppState {
  mounted: boolean
  projects: Project[]
  activeId: string | null
  selectedId: string | null   // derived: active tab's srcId
  selectedIds: Set<string>
  anchorId: string | null
  contextMenu: ContextMenu | null
  // derived
  activeProject: Project | null
  sources: QueuedSource[]
  allSources: QueuedSource[]
  selectedSource: QueuedSource | null
  stackIds: string[]
  stackSources: QueuedSource[]
  // center view tabs
  viewTabs: ViewTab[]
  activeViewTabId: string | null
  openInView: (srcId: string) => void
  openUrlInView: (url: string, title: string, srcId?: string) => void
  closeViewTab: (tabId: string) => void
  switchViewTab: (tabId: string) => void
  reorderViewTabs: (fromId: string, toId: string) => void
  // auth + entitlement
  user:              AuthUser | null
  isPro:             boolean
  limits:            Limits
  signIn:            (email: string, key: string) => Promise<SignInResult>
  signOut:           () => void
  refreshEntitlement: () => Promise<void>
  openBilling:       () => Promise<void>
  // setters
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  setContextMenu: (m: ContextMenu | null) => void
  // actions
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  updateProject: (id: string, patch: Partial<Project>) => void
  patchSource: (projId: string, srcId: string, patch: Partial<QueuedSource>) => void
  moveSource: (srcId: string, toIndex: number) => void
  moveSourceToProject: (srcId: string, targetProjId: string) => void
  moveProject: (projId: string, toIndex: number) => void
  uploadFiles: (files: FileList | File[], targetProjId?: string) => Promise<void>
  retrySource: (srcId: string) => Promise<void>
  removeSource: (srcId: string) => void
  removeSelected: () => void
  addSourceToSession: (srcId: string, toProjectId: string) => string | null
  addUrlToSession: (projectId: string, url: string, title: string) => { name: string | null; srcId: string } | null
  removeSourceFromProject: (srcId: string, projId: string) => void
  restoreArchivedSource: (srcId: string, projectId: string) => void
  permanentlyDeleteArchived: (srcId: string, projectId: string) => void
  addUrl: (url: string, targetProjId?: string, label?: string) => Promise<void>
  // Workspace actions
  switchWorkspace: (id: string) => void
  newWorkspace: () => void
  saveWorkspace: (name?: string) => void
  removeWorkspace: (targetId?: string) => void
  removeWorkspaceSoft: (targetId: string) => void
  commitWorkspaceRemoval: (proj: Project) => void
  restoreWorkspace: (proj: Project, insertIdx: number) => void
  // Stack actions
  addToStack: (id: string) => void
  removeFromStack: (id: string) => void
  clearStack: () => void
  reorderStack: (fromIndex: number, toIndex: number) => void
  openInPane: (id: string) => void
}
