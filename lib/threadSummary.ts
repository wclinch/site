import type { Thread } from './types'
import { loadChats } from './askSiteStorage'

// Builds a compact deterministic summary for a thread.
// Used when creating a new thread that inherits context from an existing one.
// No AI call — purely from stored data.
export function buildThreadSummary(thread: Thread): string {
  const parts: string[] = [`Thread: "${thread.name}"`]

  const docs  = thread.sources.filter(s => s.fileType !== 'url')
  const pages = thread.sources.filter(s => s.fileType === 'url')

  if (docs.length > 0) {
    const labels = docs.map(s => s.label || s.raw).filter(Boolean).join(', ')
    parts.push(`Documents: ${labels}`)
  }
  if (pages.length > 0) {
    const labels = pages.map(s => s.label || s.raw).filter(Boolean).join(', ')
    parts.push(`Saved pages: ${labels}`)
  }

  // Include the last few user questions from Ask Site chat history as a signal
  // of what the user was working on.
  try {
    const chats = loadChats(thread.id)
    const userMessages = chats
      .flatMap(c => c.messages)
      .filter(m => m.role === 'user')
      .slice(-4)
      .map(m => m.content.replace(/\s+/g, ' ').trim().slice(0, 120))
      .filter(Boolean)
    if (userMessages.length > 0) {
      parts.push(`Recent questions: ${userMessages.join(' | ')}`)
    }
  } catch {}

  return parts.join('\n')
}
