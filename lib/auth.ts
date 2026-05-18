// Client-side auth utilities.
// All Polar API calls go through Electron IPC — the main process holds the org token.
// In web/dev context without Electron, auth is unavailable but the app still works.

const AUTH_KEY  = 'proof-v3-auth-session'
const ENT_KEY   = 'proof-v3-entitlement'
const CREDS_KEY = 'proof-v3-credentials'

export interface AuthUser {
  email:      string
  licenseKey: string
  customerId: string
  cachedAt:   string
}

export type SignInResult =
  | { ok: true;  user: AuthUser; isPro: boolean }
  | { ok: false; error: 'invalid_key' | 'email_mismatch' | 'network_error' | 'not_configured' }

// ─── localStorage helpers ────────────────────────────────────────────────────

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    if (!u.licenseKey || !u.email) return null
    return u
  } catch { return null }
}

export function storeUser(user: AuthUser) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(user)) } catch {}
  try { localStorage.setItem(CREDS_KEY, JSON.stringify({ email: user.email, licenseKey: user.licenseKey })) } catch {}
}

export function getStoredCredentials(): { email: string; licenseKey: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c.email || !c.licenseKey) return null
    return c
  } catch { return null }
}

export function clearStoredSession() {
  try { localStorage.removeItem(AUTH_KEY) } catch {}
  try { localStorage.removeItem(ENT_KEY) } catch {}
  // credentials (email + key) are kept so re-auth is silent
}

export function storeEntitlementCache(isPro: boolean) {
  try {
    localStorage.setItem(ENT_KEY, JSON.stringify({ isPro, checkedAt: new Date().toISOString() }))
  } catch {}
}

// ─── IPC bridge ──────────────────────────────────────────────────────────────

type ElectronAuth = {
  validateKey:  (email: string, key: string) => Promise<unknown>
  getPortalUrl: (customerId: string)         => Promise<unknown>
}

function getElectronAuth(): ElectronAuth | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).electronAPI?.auth ?? null
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function signIn(email: string, key: string): Promise<SignInResult> {
  const auth = getElectronAuth()
  if (!auth) return { ok: false, error: 'not_configured' }

  const result = await auth.validateKey(email, key) as {
    ok?: boolean; error?: string; email?: string
  }

  if (!result?.ok) {
    const e = result?.error
    if (e === 'invalid_key')    return { ok: false, error: 'invalid_key' }
    if (e === 'email_mismatch') return { ok: false, error: 'email_mismatch' }
    return { ok: false, error: 'network_error' }
  }

  const user: AuthUser = {
    email:      result.email      ?? email,
    licenseKey: key,
    customerId: (result as any).customerId ?? '',
    cachedAt:   new Date().toISOString(),
  }
  storeUser(user)
  storeEntitlementCache(true)
  return { ok: true, user, isPro: true }
}

// Re-validate a stored license key to confirm subscription is still active.
export async function refreshEntitlement(email: string, key: string): Promise<boolean | null> {
  const auth = getElectronAuth()
  if (!auth) return null

  const result = await auth.validateKey(email, key) as { ok?: boolean }
  if (!result?.ok) return null
  storeEntitlementCache(true)
  return true
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
