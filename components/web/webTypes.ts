export type TabState = {
  id: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  pinned?: boolean
}

export type TabStatus = { failedLoad?: boolean; authBlocked?: boolean }

const AUTH_BLOCKED_TITLE_PATTERNS = [
  "couldn't sign you in",
  "this browser or app may not be secure",
  "access blocked",
  "authentication failed",
  "sign in blocked",
]

export function isAuthUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    const p = u.pathname.toLowerCase()
    return h === 'accounts.google.com' ||
      p.includes('/oauth') || p.includes('/login') || p.includes('/signin') ||
      p.includes('/auth/') || p.includes('/callback') || p.includes('/sso/')
  } catch { return false }
}

export function isAuthBlockedTitle(title: string): boolean {
  const t = title.toLowerCase()
  return AUTH_BLOCKED_TITLE_PATTERNS.some(p => t.includes(p))
}

declare global {
  interface Window {
    electronAPI?: {
      openExternal?: (url: string) => Promise<void>
      research: {
        navigate:         (pid: string, url: string) => void
        setBounds:        (pid: string, rect: { x: number; y: number; width: number; height: number; innerWidth: number; innerHeight: number }) => void
        goBack:           (pid: string) => void
        goForward:        (pid: string) => void
        reload:           (pid: string) => void
        newTab:           (pid: string, url?: string) => void
        closeTab:         (pid: string, id: string) => void
        switchTab:        (pid: string, id: string) => void
        getState:         (pid: string) => Promise<{ url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean }>
        getTabs:          (pid: string) => Promise<{ tabs: TabState[]; activeTabId: string }>
        onUrlChanged:     (pid: string, cb: (url: string, back: boolean, fwd: boolean) => void) => () => void
        onTitleChanged:   (pid: string, cb: (title: string) => void) => () => void
        onLoadingChanged: (pid: string, cb: (loading: boolean) => void) => () => void
        onCanNavigate:    (pid: string, cb: (back: boolean, fwd: boolean) => void) => () => void
        onTabUpdated:     (pid: string, cb: (id: string, state: Partial<TabState>) => void) => () => void
        onTabsChanged:    (pid: string, cb: (tabs: TabState[], activeTabId: string) => void) => () => void
        onBoundsRecalc:   (cb: () => void) => () => void
        onFailLoad?:      (pid: string, cb: (id: string, code: number) => void) => () => void
        loadWorkspace:    (tabs: Array<{ url: string; title: string; active?: boolean; zoom?: number }>) => void
      }
    }
  }
}
