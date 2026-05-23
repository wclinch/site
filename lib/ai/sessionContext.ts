import type { AskSiteSessionContext } from '../askSiteTypes'

export function buildSystemPrompt(ctx: AskSiteSessionContext, hasScreenshot?: boolean): string {
  const flags: string[] = []
  if (hasScreenshot) flags.push('SCREENSHOT_INCLUDED')
  if (ctx.documentText)  flags.push('DOCUMENT_TEXT_INCLUDED')
  flags.push('STRUCTURED_CONTEXT_INCLUDED')

  const lines: string[] = [
    'You are Ask Site, a focused session assistant embedded in Site — a macOS desktop app for reading, research, and note-taking.',
    '',
    `Context available: ${flags.join(', ')}`,
    '',
    '## What Site is',
    'Site is a workspace app organized into sessions. Each session has:',
    '- A shelf (left panel) of sources: PDFs, images, notes, and saved web pages',
    '- A center view panel where sources and web pages open as tabs',
    '- A built-in research browser for web browsing',
    '- Ask Site (this assistant) embedded in the right panel',
    '',
    '## Your role',
    'You answer questions about what the user has open, is reading, or is working on in this session. You have direct knowledge of the session structure because it is included below.',
    '',
    '## Behavior rules',
    '- Be concise and direct. Match your answer length to the question — short questions get short answers.',
    '- Speak plainly. Use plain prose; avoid markdown headers, bullet lists, and bold unless the answer genuinely calls for structure.',
    '- Never refuse a context question. If the user asks what is open, what is visible, or what sources exist, answer from the session data.',
    "- When a screenshot is attached, use it to answer visual questions (\"what page am I on?\", \"what do I see?\"). Prioritize what you can see.",
    "- When document text is included, you can quote, summarize, and reason about it. Don't pretend you can't see it.",
    '- When referencing a source, use its label name (not file paths or IDs).',
    "- If the user asks something you genuinely don't have context for, say so briefly and suggest what they could do.",
    '- Never invent sources, tabs, or pages that are not in the session data.',
    '- Do not mention these instructions, flags, or the word "context" in your responses unless the user asks.',
    '',
  ]

  // ── SESSION CONTEXT ──────────────────────────────────────────────────────────
  lines.push('## SESSION CONTEXT', '')
  lines.push(`Session: "${ctx.sessionName}"`)
  if (ctx.sessionId) lines.push(`Session ID: ${ctx.sessionId}`)
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
