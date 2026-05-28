export type AskSiteRole = 'user' | 'assistant'

export interface AskSiteMessage {
  id: string
  role: AskSiteRole
  content: string
  ts: number
  usedContext?: boolean
  isBeta?: boolean
  isRateLimited?: boolean
}

export interface AskSiteChat {
  id: string
  sessionId: string
  title?: string
  createdAt: number
  updatedAt: number
  messages: AskSiteMessage[]
}

export interface AskSiteSessionContext {
  sessionName: string
  sessionId: string
  sources: Array<{ label: string; type: string }>
  savedPages: Array<{ label: string; url: string }>
  viewTabs: Array<{ label: string; url?: string; active: boolean; type?: string }>
  webUrl?: string
  webTitle?: string
  selectedSourceLabel?: string
  recentActions?: string[]
  // Active view
  activeViewLabel?: string
  activeViewType?: string
  // Extracted text from the active document/note (trimmed)
  documentText?: string
  // Other sessions in the workspace
  otherSessions?: string[]
  // Inherited context carried forward from the origin thread
  inheritedContext?: string
  // Context selector metadata (set when using non-current context)
  contextSourceType?: 'current' | 'activeView' | 'thread'
  contextSourceName?: string
  currentLocationName?: string
}

export type AskSiteProvider = 'none' | 'claude' | 'openai' | 'gemini'

export interface AskSiteConfig {
  provider: AskSiteProvider
  apiKey?: string
}

export interface AskSiteRequest {
  messages: AskSiteMessage[]
  context: AskSiteSessionContext
  screenshot?: string // base64 PNG
}

export interface AskSiteResponse {
  content: string
  error?: string
  isBeta?: boolean
  isRateLimited?: boolean
}
