import type { Project, QueuedSource, ViewPage } from '@/lib/types'
import type { Limits } from '@/lib/entitlement'
import type { AuthUser, SignInResult } from '@/lib/auth'

export interface ContextMenu { srcId: string; x: number; y: number }

export interface AppState {
  mounted: boolean
  projects: Project[]
  activeId: string | null
  selectedId: string | null
  selectedId2: string | null
  selectedIds: Set<string>
  anchorId: string | null
  contextMenu: ContextMenu | null
  // derived
  activeProject: Project | null
  sources: QueuedSource[]
  allSources: QueuedSource[]
  selectedSource: QueuedSource | null
  selectedSource2: QueuedSource | null
  stackIds: string[]
  stackSources: QueuedSource[]
  stackLimit: number
  atStackLimit: boolean
  inStack: (id: string) => boolean
  // center view panes
  view1Page: ViewPage | null
  view2Page: ViewPage | null
  splitView: boolean
  setSplitView: (v: boolean) => void
  pinPageToView: (pane: 1 | 2, src: QueuedSource) => void
  pinUrlToView:  (pane: 1 | 2, url: string, title: string) => void
  clearView: (pane: 1 | 2) => void
  openDocInPane: (pane: 1 | 2, srcId: string) => void
  // auth + entitlement
  user:              AuthUser | null
  isPro:             boolean
  limits:            Limits
  signIn:            (email: string, key: string) => Promise<SignInResult>
  signOut:           () => void
  refreshEntitlement: () => Promise<void>
  openBilling:       () => Promise<void>
  // setters
  setSelectedId: (id: string | null) => void
  setSelectedId2: (id: string | null) => void
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
  restoreArchivedSource: (srcId: string, projectId: string) => void
  permanentlyDeleteArchived: (srcId: string, projectId: string) => void
  createNote: (targetProjId?: string) => void
  addUrl: (url: string, targetProjId?: string, label?: string) => Promise<void>
  // Workspace actions
  switchWorkspace: (id: string) => void
  newWorkspace: () => void
  duplicateWorkspace: (id: string) => void
  pinWorkspace: (id: string) => void
  saveWorkspace: (name?: string) => void
  removeWorkspace: (targetId?: string) => void
  // Stack actions
  addToStack: (id: string) => void
  removeFromStack: (id: string) => void
  clearStack: () => void
  reorderStack: (fromIndex: number, toIndex: number) => void
  openInPane: (id: string) => void
}
