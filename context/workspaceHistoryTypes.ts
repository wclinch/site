import type { ViewPage, SavedResearchTab } from '@/lib/types'

export interface WorkspaceSnapshot {
  id: string
  workspaceId: string
  workspaceName: string
  timestamp: number
  view1Page: ViewPage | null
  view2Page: ViewPage | null
  splitView: boolean
  researchTabs: SavedResearchTab[]
}
