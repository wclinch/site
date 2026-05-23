import type { AskSiteChat } from './askSiteTypes'

const PREFIX = 'site-ask-chats:'
const MAX_CHATS = 20

export function loadChats(sessionId: string): AskSiteChat[] {
  try { return JSON.parse(localStorage.getItem(PREFIX + sessionId) || '[]') } catch { return [] }
}

export function saveChats(sessionId: string, chats: AskSiteChat[]): void {
  try { localStorage.setItem(PREFIX + sessionId, JSON.stringify(chats.slice(0, MAX_CHATS))) } catch {}
}

export function clearChats(sessionId: string): void {
  try { localStorage.removeItem(PREFIX + sessionId) } catch {}
}

export function createChat(sessionId: string): AskSiteChat {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  }
}
