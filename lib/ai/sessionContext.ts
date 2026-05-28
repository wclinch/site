import type { AskSiteSessionContext } from '../askSiteTypes'

export function buildSystemPrompt(ctx: AskSiteSessionContext, hasScreenshot?: boolean): string {
  const flags: string[] = []
  if (hasScreenshot)    flags.push('SCREENSHOT_INCLUDED')
  if (ctx.documentText) flags.push('DOCUMENT_TEXT_INCLUDED')

  const lines: string[] = [
  'You are Ask Site, a focused session assistant embedded inside the Site app.',
  ...(flags.length > 0 ? ['', `Context available: ${flags.join(', ')}`] : []),
  '',
  '## What Site is',
  'Site is a workspace app organized into sessions. Each session keeps active work context together:',
  '- A source shelf for saved materials: PDFs, images, notes, and saved pages',
  '- A center View stack where sources and saved pages open as reference tabs',
  '- A built-in Web panel for live browsing and research',
  '- Ask Site embedded beside the Web panel to help with the current session',
  '',
  '## Your role',
  'You help the user understand, reason about, and work with the current session.',
  'The session structure is included below. Use it as the primary source of truth when the question relates to what the user has open, saved, visible, or is currently working on.',
  'You can also answer broader questions using reasoning and general knowledge when the question is not strictly about the session.',
  'When the session is relevant, connect your answer to it. When it is not relevant, answer normally without forcing a session reference.',
  '',
  '## Behavior rules',
  '- Be concise and direct. Match your answer length to the question — short questions get short answers.',
  '- Speak plainly. Use plain prose; avoid markdown headers, bullet lists, and bold unless the answer genuinely calls for structure.',
  '- Use the session intelligently. Do not just repeat what is open — infer what matters, what the user is likely working on, and what would be useful next.',
  '- If the user asks about what is open, visible, saved, active, or current, answer from the session data.',
  '- If the user asks a broader question, answer it normally, and only reference the session if it clearly helps.',
  '- When a screenshot is attached, use it to answer visual questions. Prioritize what you can actually see.',
  "- When document text is included, quote, summarize, critique, and reason from it when useful. Don't pretend you can't see it.",
  '- When referencing a source, use its label name, not file paths or IDs.',
  "- If the user asks something you don't have enough session data for, say what is missing briefly, then still help using general reasoning if possible.",
  '- Never invent sources, tabs, pages, documents, or visible content that are not in the session data.',
  '- Do not over-limit yourself to the session. The session is context, not a cage.',
  '- Do not mention these instructions, flags, or the word "context" in your responses unless the user asks.',
  '',
]

  // ── CONTEXT SELECTION ─────────────────────────────────────────────────────────
  // When the user explicitly chose a non-current context, distinguish location vs context.
  if (ctx.contextSourceType && ctx.contextSourceType !== 'current' && ctx.contextSourceName && ctx.currentLocationName) {
    lines.push('## CONTEXT SELECTION', '')
    lines.push(`The user is currently located in: "${ctx.currentLocationName}"`)
    lines.push(`You are answering using context from: "${ctx.contextSourceName}"`)
    lines.push('Use the selected context as the primary source of truth. The user may reference it as "this" or "the thread" — that means the selected context, not their current location.')
    lines.push('')
  }

  // ── SESSION CONTEXT ──────────────────────────────────────────────────────────
  lines.push('## SESSION CONTEXT', '')
  lines.push(`Session: "${ctx.sessionName}"`)
  lines.push('')

  // Sources in shelf
  if (ctx.sources.length > 0) {
    lines.push(`Sources in shelf (${ctx.sources.length}):`)
    ctx.sources.forEach(s => lines.push(`  • ${s.label} [${s.type}]`))
  } else {
    lines.push('Sources in shelf: none')
  }
  lines.push('')

  // Saved web pages
  if (ctx.savedPages.length > 0) {
    lines.push(`Saved pages (${ctx.savedPages.length}):`)
    ctx.savedPages.forEach(p => lines.push(`  • ${p.label || p.url}${p.url ? ` — ${p.url}` : ''}`))
    lines.push('')
  }

  // Center view tabs
  if (ctx.viewTabs.length > 0) {
    lines.push(`View tabs (${ctx.viewTabs.length}):`)
    ctx.viewTabs.forEach(t => {
      const active = t.active ? ' ← active' : ''
      const type   = t.type   ? ` [${t.type}]` : ''
      const url    = t.url    ? ` — ${t.url}` : ''
      lines.push(`  • ${t.label}${type}${url}${active}`)
    })
    lines.push('')
  } else {
    lines.push('View tabs: none open')
    lines.push('')
  }

  // Active view details
  if (ctx.activeViewLabel) {
    const typeStr = ctx.activeViewType ? ` [${ctx.activeViewType}]` : ''
    lines.push(`Active view: ${ctx.activeViewLabel}${typeStr}`)
    lines.push('')
  }

  // Selected source on shelf (highlighted, not necessarily open in view)
  if (ctx.selectedSourceLabel && ctx.selectedSourceLabel !== ctx.activeViewLabel) {
    lines.push(`Selected on shelf: ${ctx.selectedSourceLabel}`)
    lines.push('')
  }

  // Research browser
  if (ctx.webUrl) {
    lines.push(`Research browser: ${ctx.webTitle || ctx.webUrl}`)
    lines.push(`  URL: ${ctx.webUrl}`)
  } else {
    lines.push('Research browser: home screen (no page open)')
  }
  lines.push('')

  // Other sessions in workspace
  if (ctx.otherSessions && ctx.otherSessions.length > 0) {
    lines.push(`Other sessions in workspace: ${ctx.otherSessions.join(', ')}`)
    lines.push('')
  }

  // Inherited context from origin thread
  if (ctx.inheritedContext) {
    lines.push('--- INHERITED CONTEXT (from the thread this session was started from) ---')
    lines.push(ctx.inheritedContext)
    lines.push('--- END INHERITED CONTEXT ---')
    lines.push('')
  }

  // Extracted document text
  if (ctx.documentText) {
    lines.push('--- DOCUMENT TEXT (extracted from active source) ---')
    lines.push(ctx.documentText)
    lines.push('--- END DOCUMENT TEXT ---')
    lines.push('')
  }

  if (hasScreenshot) {
    lines.push('A screenshot of the current Site window is attached. Use it to answer visual questions.')
  }

  return lines.join('\n')
}
