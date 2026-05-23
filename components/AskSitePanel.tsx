'use client'
import { useState, useEffect, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import type { AskSiteChat, AskSiteMessage, AskSiteSessionContext } from '@/lib/askSiteTypes'
import type { DocContent } from '@/lib/types'
import { loadChats, saveChats, createChat } from '@/lib/askSiteStorage'
import { askSiteAI } from '@/lib/askSiteService'
import { captureWindow } from '@/lib/ai/screenCapture'
import { getContent } from '@/lib/idb'

const T = '#E6E2D8', M = 'rgba(230,226,216,0.65)', F = 'rgba(230,226,216,0.45)'
const S = '#151615', BG = '#070807', BR = 'rgba(230,226,216,0.1)'

const ALL_SUGGESTIONS = [
  'What am I looking at?',
  'Summarize this session',
  'What am I looking at in the View?',
  'What sources are here?',
  'What should I read next?',
  'Turn this session into an outline',
  'What page am I on?',
  'What tabs do I have open?',
  "What's saved in this session?",
  'How are these sources related?',
  'What should I focus on first?',
  "What's in the View tab?",
  'What do I have open?',
  'Give me a reading order for my sources',
  'What have I been working on?',
  'Describe this session in one sentence',
  'What documents do I have?',
  "What's the current web page about?",
  'List everything open right now',
  'Where should I start?',
  'Am I missing anything obvious?',
  "What's open in my View?",
]

const SHOWN = 7

function pickSuggestions(): string[] {
  const pool = [...ALL_SUGGESTIONS]
  const out: string[] = []
  while (out.length < SHOWN && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

const _web = { url: '', title: '' }

// ─── Context builder ──────────────────────────────────────────────────────────

function docContentToText(content: DocContent, maxChars = 3000): string {
  const parts: string[] = []
  let total = 0
  for (const block of content.blocks) {
    for (const s of block.sentences) {
      if (total + s.text.length > maxChars) {
        const remaining = maxChars - total
        if (remaining > 0) parts.push(s.text.slice(0, remaining) + '…')
        return parts.join(' ')
      }
      parts.push(s.text)
      total += s.text.length + 1
    }
  }
  return parts.join(' ')
}

async function buildContext(app: ReturnType<typeof useApp>): Promise<AskSiteSessionContext> {
  const { activeId, projects, stackSources, selectedSource, viewTabs, activeViewTabId, allSources } = app
  const project = projects.find(p => p.id === activeId)
  const docs  = stackSources.filter(s => s.fileType !== 'url')
  const pages = stackSources.filter(s => s.fileType === 'url')

  const activeTab = viewTabs.find(t => t.id === activeViewTabId) ?? null
  const activeSrc = activeTab?.srcId ? allSources.find(s => s.id === activeTab.srcId) ?? null : null

  // Label and type of the active view
  let activeViewLabel: string | undefined
  let activeViewType: string | undefined
  if (activeTab) {
    if (activeSrc) {
      activeViewLabel = activeSrc.label || activeSrc.raw || 'Document'
      activeViewType  = activeSrc.fileType || 'doc'
    } else if (activeTab.url) {
      activeViewLabel = activeTab.title || (() => { try { return new URL(activeTab.url!).hostname.replace(/^www\./, '') } catch { return activeTab.url! } })()
      activeViewType  = 'web'
    }
  }

  // Extracted text from the active document
  let documentText: string | undefined
  if (activeSrc) {
    if (activeSrc.fileType === 'note' && activeSrc.noteContent) {
      documentText = activeSrc.noteContent.slice(0, 3000) || undefined
    } else if (activeSrc.fileType === 'pdf' || activeSrc.fileType === 'image') {
      const stored = await getContent(activeSrc.id)
      if (stored) {
        const text = docContentToText(stored as DocContent)
        if (text) documentText = text
      }
    }
  }

  // Other sessions (excluding current)
  const otherSessions = projects
    .filter(p => p.id !== activeId)
    .map(p => p.name)
    .filter(Boolean)

  return {
    sessionName: project?.name || 'Untitled Session',
    sessionId:   activeId ?? '',
    sources:     docs.map(s => ({ label: s.label || s.raw || 'Untitled', type: s.fileType || 'doc' })),
    savedPages:  pages.map(s => ({ label: s.label || s.raw || '', url: s.raw || '' })),
    viewTabs: viewTabs.map(tab => {
      const src = tab.srcId ? allSources.find(s => s.id === tab.srcId) : null
      const label = src
        ? (src.label || src.raw || 'Document')
        : tab.title || (tab.url ? (() => { try { return new URL(tab.url!).hostname.replace(/^www\./, '') } catch { return tab.url! } })() : 'View')
      const type = src ? (src.fileType || 'doc') : (tab.url ? 'web' : undefined)
      return { label, url: tab.url, active: tab.id === activeViewTabId, type }
    }),
    webUrl:   _web.url,
    webTitle: _web.title,
    selectedSourceLabel: selectedSource?.label || selectedSource?.raw || undefined,
    recentActions: [],
    activeViewLabel,
    activeViewType,
    documentText,
    otherSessions: otherSessions.length > 0 ? otherSessions : undefined,
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Chat row with arm-to-delete ─────────────────────────────────────────────

function ChatRow({ chat, active, last, onSelect, onDelete }: {
  chat: AskSiteChat; active: boolean; last: boolean
  onSelect: () => void; onDelete: () => void
}) {
  const [hov,   setHov]   = useState(false)
  const [armed, setArmed] = useState(false)
  const [xHov,  setXHov]  = useState(false)

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!armed) { setArmed(true); return }
    setArmed(false); onDelete()
  }

  return (
    <div
      onClick={() => { if (!armed) onSelect() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setArmed(false) }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        padding: '8px 8px 8px 12px',
        background: active || hov ? S : 'transparent',
        borderBottom: last ? 'none' : `1px solid ${S}`,
        borderLeft: `2px solid ${active ? M : hov ? S : 'transparent'}`,
        cursor: armed ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px', color: active || hov ? T : M, lineHeight: 1.45,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          opacity: armed ? 0.4 : 1,
          textDecoration: armed ? 'line-through' : 'none',
          transition: 'opacity 0.15s, color 0.1s',
        }}>
          {chat.title || 'Untitled chat'}
        </div>
        <div style={{ fontSize: '12px', color: F, marginTop: '1px', letterSpacing: '0.02em' }}>
          {timeAgo(chat.updatedAt)}
        </div>
      </div>
      <button
        onClick={handleDeleteClick}
        onMouseEnter={() => setXHov(true)}
        onMouseLeave={() => setXHov(false)}
        title={armed ? 'Click again to delete' : 'Delete chat'}
        style={{
          width: '20px', height: '20px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: '3px',
          cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
          color: armed ? T : xHov ? T : F,
          opacity: armed || hov || active ? 1 : 0,
          pointerEvents: armed || hov || active ? 'auto' : 'none',
          transition: 'color 0.1s, opacity 0.12s',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M1 1L8 8M8 1L1 8"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Shared header buttons ────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: '22px', height: '22px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none', border: 'none', borderRadius: '3px',
      cursor: 'pointer', color: F, lineHeight: 0, transition: 'color 0.1s',
    }}
      onMouseEnter={e => (e.currentTarget.style.color = T)}
      onMouseLeave={e => (e.currentTarget.style.color = F)}
    >{children}</button>
  )
}

function PlusIcon() {
  return <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>
}
function CloseIcon() {
  return <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 1L8 8M8 1L1 8"/></svg>
}
function SendIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="10" x2="6" y2="2"/><polyline points="2,6 6,2 10,6"/></svg>
}

// ─── Suggested prompt — row style matching StackRow exactly ───────────────────

function PromptRow({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', width: '100%',
        padding: '8px 12px',
        background: hov ? S : 'none',
        border: 'none',
        borderLeft: `2px solid ${hov ? M : 'transparent'}`,
        color: hov ? T : M,
        fontSize: '12px', letterSpacing: '0.01em', fontWeight: 400,
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        userSelect: 'none',
        transition: 'background 0.1s, border-color 0.1s, color 0.1s',
      }}
    >{label}</button>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: T, fontWeight: 500 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ fontFamily: 'monospace', fontSize: '11px', background: S, padding: '0 3px', borderRadius: '2px' }}>{part.slice(1, -1)}</code>
    return part
  })
}

function MdText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Numbered list: collect consecutive items
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+(.+)/)
        if (!m) break
        items.push(m[1])
        i++
      }
      nodes.push(
        <ol key={nodes.length} style={{ margin: '4px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }

    // Bullet list: - or * or •
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/)
    if (bulletMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*•]\s+(.+)/)
        if (!m) break
        items.push(m[1])
        i++
      }
      nodes.push(
        <ul key={nodes.length} style={{ margin: '4px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    // Blank line → spacer
    if (trimmed === '') {
      if (nodes.length > 0) nodes.push(<div key={nodes.length} style={{ height: '5px' }} />)
      i++
      continue
    }

    // Heading (# ## ###) — strip hashes, render bold
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      nodes.push(
        <div key={nodes.length} style={{ color: T, fontWeight: 500, marginTop: '4px' }}>
          {renderInline(headingMatch[1])}
        </div>
      )
      i++
      continue
    }

    // Regular paragraph
    nodes.push(<span key={nodes.length}>{renderInline(trimmed)}{'\n'}</span>)
    i++
  }

  return <>{nodes}</>
}

// ─── Message rows ─────────────────────────────────────────────────────────────

function MessageRow({ msg, last }: { msg: AskSiteMessage; last: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      padding: '9px 10px 9px 12px',
      borderBottom: last ? 'none' : `1px solid ${S}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: F, letterSpacing: '0.03em' }}>
          {isUser ? 'You' : 'Site'}
        </span>
        {!isUser && msg.isRateLimited && (
          <span style={{ fontSize: '9px', color: F, padding: '1px 4px', border: `1px solid ${S}`, borderRadius: '2px', letterSpacing: '0.04em' }}>limit</span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: M, lineHeight: 1.6, wordBreak: 'break-word' }}>
        {isUser ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span> : <MdText text={msg.content} />}
      </div>
      <div style={{ fontSize: '12px', color: F, marginTop: '3px', letterSpacing: '0.02em' }}>
        {timeAgo(msg.ts)}
      </div>
    </div>
  )
}

function LoadingRow({ label, bright }: { label?: string; bright?: boolean }) {
  return (
    <div style={{ padding: '9px 10px 9px 12px' }}>
      <div style={{ fontSize: '12px', color: bright ? T : F, letterSpacing: '0.03em', marginBottom: '3px' }}>Site</div>
      <div style={{ fontSize: '12px', color: bright ? M : F }}>{label ?? 'Thinking…'}</div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function AskSitePanel() {
  const app = useApp()
  const { activeId, isPro } = app

  const [chats,        setChats]        = useState<AskSiteChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [capturing,    setCapturing]    = useState(false)
  const [showHistory,  setShowHistory]  = useState(false)
  const [suggestions,  setSuggestions]  = useState<string[]>(() => pickSuggestions())
  const [, forceUpdate] = useState(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onWebState(e: Event) {
      const { url, title } = (e as CustomEvent).detail as { url: string; title: string }
      _web.url = url; _web.title = title; forceUpdate(n => n + 1)
    }
    window.addEventListener('proof:web-state', onWebState)
    return () => window.removeEventListener('proof:web-state', onWebState)
  }, [])

  useEffect(() => {
    if (!activeId) return
    const loaded = loadChats(activeId)
    setChats(loaded); setActiveChatId(null); setInput(''); setShowHistory(false)
    setSuggestions(pickSuggestions())
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats, activeChatId, loading])

  const activeChat = chats.find(c => c.id === activeChatId) ?? null

  function deleteChat(chatId: string) {
    setChats(prev => {
      const next = prev.filter(c => c.id !== chatId)
      if (activeId) saveChats(activeId, next)
      if (next.length === 0) setShowHistory(false) // exit history when empty
      return next
    })
    if (activeChatId === chatId) setActiveChatId(null)
  }

  function startNewChat() {
    setActiveChatId(null); setInput(''); setShowHistory(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function handleSend(msg?: string) {
    const content = (msg ?? input).trim()
    if (!content || loading || capturing || !activeId) return
    setInput(''); setShowHistory(false)

    const userMsg: AskSiteMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user', content, ts: Date.now(), usedContext: true,
    }

    let chat = activeChat ?? createChat(activeId)
    const isNew = !activeChat
    const chatWithUser: AskSiteChat = {
      ...chat,
      messages: [...chat.messages, userMsg],
      updatedAt: Date.now(),
      title: chat.title ?? content.slice(0, 60),
    }

    setActiveChatId(chatWithUser.id)
    setChats(prev => {
      const next = isNew ? [chatWithUser, ...prev] : prev.map(c => c.id === chatWithUser.id ? chatWithUser : c)
      saveChats(activeId, next); return next
    })

    // Always capture the window — Ask Site is screen-aware for every question
    setCapturing(true)
    const cap = await captureWindow()
    const screenshot = cap ?? undefined
    setCapturing(false)

    setLoading(true)
    const ctx = await buildContext(app)
    const res = await askSiteAI({ messages: chatWithUser.messages, context: ctx, screenshot }, { provider: 'none', isPro: app.isPro })

    const assistantMsg: AskSiteMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'assistant',
      content: res.content || res.error || 'Something went wrong.',
      ts: Date.now(), usedContext: !res.isBeta && !res.isRateLimited, isBeta: res.isBeta, isRateLimited: res.isRateLimited,
    }

    setChats(prev => {
      const next = prev.map(c =>
        c.id !== chatWithUser.id ? c : { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
      )
      saveChats(activeId, next); return next
    })
    setLoading(false)
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      border: `1px solid ${BR}`, borderRadius: '4px',
      background: BG, overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: '44px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 10px', borderBottom: `1px solid ${BR}`,
        userSelect: 'none', gap: '6px',
      }}>
        <span
          onClick={() => { if (activeChatId || showHistory) startNewChat() }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            height: '28px', padding: '0 12px', marginRight: 'auto',
            borderRadius: '4px', background: S,
            border: `1px solid ${(capturing || loading) ? 'rgba(230,226,216,0.35)' : BR}`,
            fontSize: '13px', color: T, letterSpacing: '0.01em',
            userSelect: 'none', flexShrink: 0,
            cursor: activeChatId || showHistory ? 'pointer' : 'default',
            transition: 'border-color 0.2s',
          }}
        >
          Ask Site
          {(capturing || loading) && (
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: capturing ? 'rgba(230,226,216,0.9)' : 'rgba(230,226,216,0.5)',
              animation: 'pulse-dot 1.4s ease-in-out infinite',
              display: 'inline-block',
            }} />
          )}
        </span>

        {chats.length > 0 && (
          <>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                background: 'none', border: 'none', padding: 0, height: '22px',
                fontSize: '12px', cursor: 'pointer', fontWeight: 400,
                fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'color 0.1s',
                color: showHistory ? T : F,
              }}
              onMouseEnter={e => { if (!showHistory) e.currentTarget.style.color = T }}
              onMouseLeave={e => { if (!showHistory) e.currentTarget.style.color = F }}
            >{showHistory ? 'Done' : 'Chats'}</button>
            <div style={{ width: '1px', height: '10px', background: 'rgba(230,226,216,0.2)', flexShrink: 0 }} />
          </>
        )}

        {(activeChatId !== null || showHistory) && (
          <IconBtn onClick={startNewChat} title="New chat"><PlusIcon /></IconBtn>
        )}
      </div>

      {/* ── Status bar ── */}
      {(capturing || loading) && (
        <div style={{
          height: '2px', flexShrink: 0,
          background: capturing ? 'rgba(230,226,216,0.9)' : 'rgba(230,226,216,0.45)',
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }} />
      )}

      {/* ── Body ── */}
      {showHistory ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {chats.map((chat, i) => (
            <ChatRow
              key={chat.id} chat={chat}
              active={chat.id === activeChatId}
              last={i === chats.length - 1}
              onSelect={() => { setActiveChatId(chat.id); setShowHistory(false); setInput('') }}
              onDelete={() => deleteChat(chat.id)}
            />
          ))}
        </div>

      ) : activeChat && activeChat.messages.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {activeChat.messages.map((msg, i) => (
            <MessageRow key={msg.id} msg={msg} last={i === activeChat.messages.length - 1 && !loading} />
          ))}
          {capturing && <LoadingRow label="Reading screen…" bright />}
          {loading && !capturing && <LoadingRow />}
          <div ref={bottomRef} />
        </div>

      ) : (
        // Empty state — minimal, input-focused
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '12px', color: F, letterSpacing: '0.02em' }}>Ask the current session.</span>
        </div>
      )}

      {/* ── Footer — locked for Free, input for Pro ── */}
      <div style={{ flexShrink: 0, padding: '6px 8px 8px' }}>
        {isPro ? (
          <InputRow inputRef={inputRef} input={input} loading={loading} setInput={setInput} handleSend={handleSend} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: '30px', padding: '0 10px',
            background: S, border: `1px solid ${BR}`, borderRadius: '4px',
          }}>
            <span style={{ fontSize: '12px', color: F, letterSpacing: '0.01em' }}>Ask Site is included with Pro.</span>
            <button
              onClick={() => window.dispatchEvent(new Event('proof:upgrade-needed'))}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '11px', color: M, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em',
                transition: 'color 0.1s', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T)}
              onMouseLeave={e => (e.currentTarget.style.color = M)}
            >Upgrade →</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared input row (used in empty state + chat/history footer) ─────────────
function InputRow({ inputRef, input, loading, setInput, handleSend }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  input: string; loading: boolean
  setInput: (v: string) => void
  handleSend: () => void
}) {
  const S = '#151615', T = '#E6E2D8', F = 'rgba(230,226,216,0.45)', BR = 'rgba(230,226,216,0.1)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
        placeholder="Ask about what's open, visible, or saved here…"
        disabled={loading}
        spellCheck={false}
        style={{
          flex: 1, height: '30px',
          background: S, border: `1px solid ${BR}`,
          borderRadius: '4px', color: T,
          fontSize: '12px', padding: '0 10px',
          outline: 'none', fontFamily: 'inherit', letterSpacing: '0.01em',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.25)')}
        onBlur={e  => (e.currentTarget.style.borderColor = BR)}
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || loading}
        style={{
          width: '30px', height: '30px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: input.trim() && !loading ? S : 'none',
          border: `1px solid ${input.trim() && !loading ? BR : 'transparent'}`,
          borderRadius: '4px',
          color: input.trim() && !loading ? T : F,
          cursor: input.trim() && !loading ? 'pointer' : 'default',
          lineHeight: 0,
          transition: 'color 0.12s, background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.borderColor = 'rgba(230,226,216,0.25)' }}
        onMouseLeave={e => { if (input.trim() && !loading) e.currentTarget.style.borderColor = BR }}
      ><SendIcon /></button>
    </div>
  )
}
