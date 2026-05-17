// Client-side auth utilities.
// All Polar API calls go through Electron IPC — the main process holds the org token.
// In web/dev context without Electron, auth is unavailable but the app still works.

const AUTH_KEY    = 'proof-v3-auth-session'
const ENT_KEY     = 'proof-v3-entitlement'

export interface AuthUser {
  email:      string
  customerId: string
  token:      string      // Polar customer session token
  expiresAt:  string      // ISO datetime
  cachedAt:   string
}

export interface EntitlementCache {
  isPro:     boolean
  checkedAt: string
}

export type SignInResult =
  | { ok: true;  user: AuthUser; isPro: boolean }
  | { ok: false; error: 'no_account' | 'network_error' | 'polar_error' | 'not_configured' }

// ─── localStorage helpers ────────────────────────────────────────────────────

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    if (!u.token || !u.email) return null
    if (u.expiresAt && new Date(u.expiresAt) < new Date()) {
      clearStoredSession()
      return null
    }
    return u
  } catch { return null }
}

export function storeUser(user: AuthUser) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(user)) } catch {}
}

export function clearStoredSession() {
  try { localStorage.removeItem(AUTH_KEY) } catch {}
  try { localStorage.removeItem(ENT_KEY) } catch {}
}

export function getEntitlementCache(): EntitlementCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ENT_KEY)
    return raw ? (JSON.parse(raw) as EntitlementCache) : null
  } catch { return null }
}

export function storeEntitlementCache(isPro: boolean) {
  try {
    localStorage.setItem(ENT_KEY, JSON.stringify({
      isPro,
      checkedAt: new Date().toISOString(),
    }))
  } catch {}
}

// ─── IPC bridge ──────────────────────────────────────────────────────────────

type ElectronAuth = {
  getSession:          (email: string)    => Promise<unknown>
  checkSubscriptions:  (token: string)    => Promise<unknown>
  getPortalUrl:        (customerId: string) => Promise<unknown>
}

function getElectronAuth(): ElectronAuth | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).electronAPI?.auth ?? null
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function signIn(email: string): Promise<SignInResult> {
  const auth = getElectronAuth()
  if (!auth) return { ok: false, error: 'not_configured' }

  const result = await auth.getSession(email) as {
    ok?: boolean; error?: string
    token?: string; expiresAt?: string
    customerId?: string; email?: string; isPro?: boolean
  }

  if (!result?.ok) {
    const e = result?.error
    if (e === 'no_account')    return { ok: false, error: 'no_account' }
    if (e === 'network_error') return { ok: false, error: 'network_error' }
    return { ok: false, error: 'polar_error' }
  }

  const user: AuthUser = {
    email:      result.email      ?? email,
    customerId: result.customerId ?? '',
    token:      result.token      ?? '',
    expiresAt:  result.expiresAt  ?? '',
    cachedAt:   new Date().toISOString(),
  }
  storeUser(user)
  storeEntitlementCache(result.isPro ?? false)
  return { ok: true, user, isPro: result.isPro ?? false }
}

// Returns updated isPro, or null if offline / unavailable.
export async function refreshEntitlement(token: string): Promise<boolean | null> {
  const auth = getElectronAuth()
  if (!auth) return null

  const result = await auth.checkSubscriptions(token) as { ok?: boolean; isPro?: boolean }
  if (!result?.ok) return null
  storeEntitlementCache(result.isPro ?? false)
  return result.isPro ?? false
}

export async function getPortalUrl(customerId: string): Promise<string | null> {
  const auth = getElectronAuth()
  if (!auth) return null

  const result = await auth.getPortalUrl(customerId) as { ok?: boolean; portalUrl?: string }
  if (!result?.ok || !result.portalUrl) return null
  return result.portalUrl
}

export function getCheckoutUrl(email?: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: string = (window as any).electronAPI?.POLAR_CHECKOUT_URL
    ?? process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL
    ?? ''
  if (!base) return ''
  return email ? `${base}?prefill_email=${encodeURIComponent(email)}` : base
}
