export type ShortcutSection = { label: string; shortcuts: [string, string][] }

export const HOME_SECTIONS: ShortcutSection[] = [
  { label: 'AI', shortcuts: [
    ['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['perplexity', 'Perplexity'],
    ['gemini', 'Gemini'], ['grok', 'Grok'], ['mistral', 'Mistral'],
  ]},
  { label: 'Google', shortcuts: [
    ['gmail', 'Gmail'], ['docs', 'Docs'], ['drive', 'Drive'], ['sheets', 'Sheets'],
    ['slides', 'Slides'], ['calendar', 'Calendar'], ['meet', 'Meet'], ['maps', 'Maps'],
  ]},
  { label: 'Search', shortcuts: [
    ['google', 'Google'], ['wikipedia', 'Wikipedia'], ['reddit', 'Reddit'],
    ['hn', 'HN'], ['scholar', 'Scholar'],
  ]},
  { label: 'Dev', shortcuts: [
    ['github', 'GitHub'], ['stackoverflow', 'Stack Overflow'], ['mdn', 'MDN'],
    ['npm', 'npm'], ['vercel', 'Vercel'], ['linear', 'Linear'],
  ]},
  { label: 'Design', shortcuts: [
    ['figma', 'Figma'], ['canva', 'Canva'], ['framer', 'Framer'],
    ['webflow', 'Webflow'], ['dribbble', 'Dribbble'], ['unsplash', 'Unsplash'],
  ]},
  { label: 'Work', shortcuts: [
    ['notion', 'Notion'], ['airtable', 'Airtable'], ['slack', 'Slack'],
    ['zoom', 'Zoom'], ['loom', 'Loom'], ['dropbox', 'Dropbox'],
  ]},
  { label: 'Social', shortcuts: [
    ['youtube', 'YouTube'], ['x', 'X'], ['linkedin', 'LinkedIn'],
    ['instagram', 'Instagram'], ['discord', 'Discord'], ['spotify', 'Spotify'],
  ]},
  { label: 'News', shortcuts: [
    ['medium', 'Medium'], ['substack', 'Substack'], ['bbc', 'BBC'], ['reuters', 'Reuters'],
  ]},
  { label: 'Other', shortcuts: [
    ['amazon', 'Amazon'], ['stripe', 'Stripe'], ['canvas', 'Canvas'],
  ]},
]

export const HOME_SHORTCUTS: [string, string][] = HOME_SECTIONS.flatMap(s => s.shortcuts)
