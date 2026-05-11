// License gate.
//
// One license key per purchase, issued by Polar. On first launch the user
// pastes the key and the app validates once against Polar's public
// validation endpoint. The result is cached in localStorage so subsequent
// launches don't require network — the app stays fully local after the
// initial activation.
//
// This is a soft gate. A determined user can patch the binary or edit
// localStorage to bypass it; that isn't what the gate exists for. The
// gate exists to make casual sharing — "here's the .app, run xattr and
// you're in" — fail by default. The friend's machine has no cached
// license, the modal opens, the friend can't continue.
//
// The activation cache stores only:
//   key              — the entered license key (so we can re-validate later)
//   validatedAt      — ISO timestamp of the successful validation
//   keyId / customerId — opaque IDs from Polar's response, if returned
//
// No PII beyond what the buyer typed in. No license server of our own.

const KEY = 'proof-v3-license'

// Polar's public license-key validation endpoint. Replace ORG_ID with
// the organization-id from polar.sh dashboard before shipping a
// licensed build. (If left as the placeholder, validation returns a
// clear error so it can't silently succeed.)
const POLAR_ENDPOINT      = 'https://api.polar.sh/v1/customer-portal/license-keys/validate'
const POLAR_ORGANIZATION  = 'ef60cd00-9e07-4db8-83e8-bda9a2afa313' // dashboard → Settings → General → ID

export interface LicenseState {
  key: string
  validatedAt: string
  keyId?: string
  customerId?: string
}

export function loadLicense(): LicenseState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LicenseState
    if (typeof parsed?.key !== 'string' || typeof parsed?.validatedAt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function saveLicense(state: LicenseState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

export function clearLicense() {
  try { localStorage.removeItem(KEY) } catch {}
}

export type ValidateResult =
  | { ok: true;  state: LicenseState }
  | { ok: false; reason: string }

// Calls Polar's validation endpoint. Network-only — no fallback path
// because the whole point is to confirm the key against the issuer.
// Errors are surfaced verbatim to the user in the gate so they can
// distinguish "wrong key" from "no internet".
export async function validateLicense(rawKey: string): Promise<ValidateResult> {
  const key = rawKey.trim()
  if (!key) return { ok: false, reason: 'Enter a license key.' }

  if (POLAR_ORGANIZATION === 'REPLACE_WITH_POLAR_ORG_ID') {
    return { ok: false, reason: 'License validation is not configured. Contact support.' }
  }

  let res: Response
  try {
    res = await fetch(POLAR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        organization_id: POLAR_ORGANIZATION,
      }),
    })
  } catch {
    return { ok: false, reason: 'Network unavailable. Try again when online.' }
  }

  if (res.status === 404) return { ok: false, reason: 'License key not recognized.' }
  if (res.status === 422 || res.status === 403) return { ok: false, reason: 'License key is no longer valid.' }
  if (!res.ok) return { ok: false, reason: `Validation failed (${res.status}).` }

  let body: { id?: string; customer_id?: string } | null = null
  try { body = await res.json() } catch {}

  const state: LicenseState = {
    key,
    validatedAt: new Date().toISOString(),
    keyId:      body?.id,
    customerId: body?.customer_id,
  }
  saveLicense(state)
  return { ok: true, state }
}
