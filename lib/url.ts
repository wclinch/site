export const SHORTCUTS: Record<string, string> = {
  // Core Google
  google:       'https://google.com',
  gmail:        'https://mail.google.com',
  youtube:      'https://youtube.com',
  docs:         'https://docs.google.com',
  'google docs':'https://docs.google.com',
  drive:        'https://drive.google.com',
  sheets:       'https://sheets.google.com',
  slides:       'https://slides.google.com',
  maps:         'https://maps.google.com',
  calendar:     'https://calendar.google.com',
  meet:         'https://meet.google.com',
  scholar:      'https://scholar.google.com',
  canvas:       'https://canvas.instructure.com',
  // AI
  chatgpt:      'https://chatgpt.com',
  claude:       'https://claude.ai',
  gemini:       'https://gemini.google.com',
  perplexity:   'https://perplexity.ai',
  grok:         'https://x.ai',
  mistral:      'https://mistral.ai',
  // Reference
  wikipedia:    'https://wikipedia.org',
  reddit:       'https://reddit.com',
  hn:           'https://news.ycombinator.com',
  'hacker news':'https://news.ycombinator.com',
  mdn:          'https://developer.mozilla.org',
  stackoverflow:'https://stackoverflow.com',
  // Social
  x:            'https://x.com',
  twitter:      'https://x.com',
  linkedin:     'https://linkedin.com',
  instagram:    'https://instagram.com',
  discord:      'https://discord.com',
  slack:        'https://slack.com',
  // Work / building
  github:       'https://github.com',
  notion:       'https://notion.so',
  figma:        'https://figma.com',
  linear:       'https://linear.app',
  vercel:       'https://vercel.com',
  canva:        'https://canva.com',
  framer:       'https://framer.com',
  webflow:      'https://webflow.com',
  airtable:     'https://airtable.com',
  // Communication
  zoom:         'https://zoom.us',
  loom:         'https://loom.com',
  // Writing / reading
  medium:       'https://medium.com',
  substack:     'https://substack.com',
  // News
  bbc:          'https://bbc.com',
  reuters:      'https://reuters.com',
  // Shopping
  amazon:       'https://amazon.com',
  // Media / focus
  spotify:      'https://open.spotify.com',
  // Design assets
  unsplash:     'https://unsplash.com',
  dribbble:     'https://dribbble.com',
  // Finance / dev
  stripe:       'https://stripe.com',
  npm:          'https://npmjs.com',
  // Storage
  dropbox:      'https://dropbox.com',
}

export const SHORTCUT_LABELS: Record<string, string> = {
  google:       'Google',
  gmail:        'Gmail',
  youtube:      'YouTube',
  docs:         'Docs',
  'google docs':'Docs',
  drive:        'Drive',
  sheets:       'Sheets',
  slides:       'Slides',
  maps:         'Maps',
  calendar:     'Calendar',
  meet:         'Meet',
  scholar:      'Scholar',
  canvas:       'Canvas',
  chatgpt:      'ChatGPT',
  claude:       'Claude',
  gemini:       'Gemini',
  perplexity:   'Perplexity',
  grok:         'Grok',
  mistral:      'Mistral',
  wikipedia:    'Wikipedia',
  reddit:       'Reddit',
  hn:           'HN',
  'hacker news':'Hacker News',
  mdn:          'MDN',
  stackoverflow:'Stack Overflow',
  x:            'X',
  twitter:      'X',
  linkedin:     'LinkedIn',
  instagram:    'Instagram',
  discord:      'Discord',
  slack:        'Slack',
  github:       'GitHub',
  notion:       'Notion',
  figma:        'Figma',
  linear:       'Linear',
  vercel:       'Vercel',
  canva:        'Canva',
  framer:       'Framer',
  webflow:      'Webflow',
  airtable:     'Airtable',
  zoom:         'Zoom',
  loom:         'Loom',
  medium:       'Medium',
  substack:     'Substack',
  bbc:          'BBC',
  reuters:      'Reuters',
  amazon:       'Amazon',
  spotify:      'Spotify',
  unsplash:     'Unsplash',
  dribbble:     'Dribbble',
  stripe:       'Stripe',
  npm:          'npm',
  dropbox:      'Dropbox',
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
