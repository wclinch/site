export const SHORTCUTS: Record<string, string> = {
  chatgpt:      'https://chatgpt.com',
  claude:       'https://claude.ai',
  gemini:       'https://gemini.google.com',
  docs:         'https://docs.google.com',
  'google docs':'https://docs.google.com',
  gmail:        'https://mail.google.com',
  youtube:      'https://youtube.com',
  notion:       'https://notion.so',
  figma:        'https://figma.com',
  github:       'https://github.com',
}

export const SHORTCUT_LABELS: Record<string, string> = {
  chatgpt:      'ChatGPT',
  claude:       'Claude',
  gemini:       'Gemini',
  docs:         'Google Docs',
  'google docs':'Google Docs',
  gmail:        'Gmail',
  youtube:      'YouTube',
  notion:       'Notion',
  figma:        'Figma',
  github:       'GitHub',
}

function googleSearch(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

// Resolution order:
// 1. trim / empty → no-op
// 2. ? or g prefix → force Google search
// 3. full URL → direct
// 4. domain-like → direct with https://
// 5. known shortcut → direct
// 6. fallback → Google search
export function resolveCommandToUrl(input: string): string {
  const s = input.trim()
  if (!s) return ''
  if (/^[?g]\s+/.test(s)) return googleSearch(s.replace(/^[?g]\s+/, ''))
  if (/^https?:\/\//i.test(s)) return s
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}(\/.*)?$/.test(s)) return `https://${s}`
  const lower = s.toLowerCase()
  if (SHORTCUTS[lower]) return SHORTCUTS[lower]
  return googleSearch(s)
}

// Returns a one-line hint when input exactly matches a known shortcut, null otherwise.
export function getShortcutHint(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const label = SHORTCUT_LABELS[s]
  if (!label) return null
  return `Enter opens ${label}  ·  ? ${s} searches Google`
}
