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

export type AskContextSelection =
  | { type: 'current' }
  | { type: 'activeView' }
  | { type: 'thread'; threadId: string; threadName: string }

export async function buildContext(
  app: ReturnType<typeof useApp>,
  selection: AskContextSelection = { type: 'current' },
): Promise<AskSiteSessionContext> {
  const { activeId, threads, sources, selectedSource, viewTabs, activeViewTabId, allSources } = app
  const currentThread = threads.find(p => p.id === activeId)
  const currentLocationName = currentThread?.name || 'Untitled'

  // Decide the SOURCE thread for the context payload.
  // For 'current' and 'activeView' → current thread.
  // For 'thread'                   → the selected thread.
  let sourceThread = currentThread
  if (selection.type === 'thread') {
    sourceThread = threads.find(p => p.id === selection.threadId) ?? currentThread
  }

  const sourceThreadSources = sourceThread?.sources ?? []
  const docs  = sourceThreadSources.filter(s => s.fileType !== 'url')
  const pages = sourceThreadSources.filter(s => s.fileType === 'url')

  // View tabs: only meaningful for current/activeView; for another thread, fall back to its persisted tabs.
  const usingCurrent = sourceThread?.id === currentThread?.id
  const effectiveViewTabs = usingCurrent ? viewTabs : (sourceThread?.viewTabs ?? [])
  const effectiveActiveTabId = usingCurrent ? activeViewTabId : (sourceThread?.activeViewTabId ?? null)
  const activeTab = effectiveViewTabs.find(t => t.id === effectiveActiveTabId) ?? null
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

  // Extracted text from the active document — only when we have a real active source.
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

  // For 'activeView': trim payload to just the active view + its text. Drop shelf/saved pages.
  const isActiveViewOnly = selection.type === 'activeView'

  // Other sessions (excluding the source thread)
  const otherSessions = threads
    .filter(p => p.id !== sourceThread?.id)
    .map(p => p.name)
    .filter(Boolean)

  // Selection labels for prompt
  let contextSourceType: 'current' | 'activeView' | 'thread' = 'current'
  let contextSourceName = currentLocationName
  if (selection.type === 'activeView') {
    contextSourceType = 'activeView'
    contextSourceName = activeViewLabel || 'Current View'
  } else if (selection.type === 'thread') {
    contextSourceType = 'thread'
    contextSourceName = selection.threadName
  }

  return {
    sessionName: sourceThread?.name || 'Untitled',
    sessionId:   sourceThread?.id ?? '',
    sources:     isActiveViewOnly ? [] : docs.map(s => ({ label: s.label || s.raw || 'Untitled', type: s.fileType || 'doc' })),
    savedPages:  isActiveViewOnly ? [] : pages.map(s => ({ label: s.label || s.raw || '', url: s.raw || '' })),
    viewTabs: effectiveViewTabs.map(tab => {
      const src = tab.srcId ? allSources.find(s => s.id === tab.srcId) : null
      const label = src
        ? (src.label || src.raw || 'Document')
        : tab.title || (tab.url ? (() => { try { return new URL(tab.url!).hostname.replace(/^www\./, '') } catch { return tab.url! } })() : 'View')
      const type = src ? (src.fileType || 'doc') : (tab.url ? 'web' : undefined)
      return { label, url: tab.url, active: tab.id === effectiveActiveTabId, type }
    }),
    webUrl:   usingCurrent ? _web.url   : '',
    webTitle: usingCurrent ? _web.title : '',
    selectedSourceLabel: usingCurrent ? (selectedSource?.label || selectedSource?.raw || undefined) : undefined,
    recentActions: [],
    activeViewLabel,
    activeViewType,
    documentText,
    otherSessions:    otherSessions.length > 0 ? otherSessions : undefined,
    inheritedContext: sourceThread?.inheritedContextSummary || undefined,
    contextSourceType,
    contextSourceName,
    currentLocationName,
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Context tab chip ─────────────────────────────────────────────────────────

function CtxTab({ label, active, onClick, onRemove }: { label: string; active: boolean; onClick: () => void; onRemove?: () => void }) {
  const [hov, setHov] = useState(false)
  const [armed, setArmed] = useState(false)
  const [xHov, setXHov] = useState(false)

  function handleX(e: React.MouseEvent) {
    e.stopPropagation()
    if (!armed) { setArmed(true); return }
    setArmed(false)
    onRemove?.()
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setArmed(false) }}
      style={{
        height: '28px', padding: onRemove ? '0 6px 0 12px' : '0 12px',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
        background: active ? '#151615' : hov ? 'rgba(21,22,21,0.5)' : 'none',
        border: `1px solid ${active ? 'rgba(230,226,216,0.1)' : 'transparent'}`,
        borderRadius: '4px', cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        fontSize: '13px', letterSpacing: '0.01em',
        color: active ? T : M,
        whiteSpace: 'nowrap',
        textDecoration: armed ? 'line-through' : 'none',
        opacity: armed ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}>
        {label}
      </span>
      {onRemove && (hov || active || armed) && (
        <button
          onClick={handleX}
          onMouseEnter={() => setXHov(true)}
          onMouseLeave={() => setXHov(false)}
          style={{
            width: '16px', height: '16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: '2px',
            cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
            color: armed || xHov ? T : F,
            transition: 'color 0.1s',
          }}
        >
          <svg width="7" height="7" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1 1L8 8M8 1L1 8" />
          </svg>
        </button>
      )}
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

function CloseIcon() {
  return <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 1L8 8M8 1L1 8"/></svg>
}
function SendIcon() {
  return <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="6" x2="10" y2="6"/><polyline points="6,2 10,6 6,10"/></svg>
}


// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: T, fontWeight: 500 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ fontFamily: 'monospace', fontSize: '12px', background: S, padding: '0 3px', borderRadius: '2px' }}>{part.slice(1, -1)}</code>
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
        <span style={{ fontSize: '13px', color: F, letterSpacing: '0.03em' }}>
          {isUser ? 'You' : 'Site'}
        </span>
        {!isUser && msg.isRateLimited && (
          <span style={{ fontSize: '9px', color: F, padding: '1px 4px', border: `1px solid ${S}`, borderRadius: '2px', letterSpacing: '0.04em' }}>limit</span>
        )}
      </div>
      <div style={{ fontSize: '13px', color: M, lineHeight: 1.6, wordBreak: 'break-word' }}>
        {isUser ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span> : <MdText text={msg.content} />}
      </div>
      <div style={{ fontSize: '13px', color: F, marginTop: '3px', letterSpacing: '0.02em' }}>
        {timeAgo(msg.ts)}
      </div>
    </div>
  )
}

function LoadingRow({ label, bright }: { label?: string; bright?: boolean }) {
  return (
    <div style={{ padding: '9px 10px 9px 12px' }}>
      <div style={{ fontSize: '13px', color: bright ? T : F, letterSpacing: '0.03em', marginBottom: '3px' }}>Site</div>
      <div style={{ fontSize: '13px', color: bright ? M : F }}>{label ?? 'Thinking…'}</div>
    </div>
  )
}

// ─── Pill toggle ─────────────────────────────────────────────────────────────

function PillToggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
    >
      <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.35)', letterSpacing: '0.02em' }}>{label}</span>
      <div style={{
        width: '26px', height: '14px', borderRadius: '7px', flexShrink: 0,
        background: on ? 'rgba(230,226,216,0.18)' : 'rgba(230,226,216,0.06)',
        border: `1px solid ${on ? 'rgba(230,226,216,0.3)' : 'rgba(230,226,216,0.1)'}`,
        position: 'relative', transition: 'background 0.18s, border-color 0.18s',
      }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: on ? 'rgba(230,226,216,0.9)' : 'rgba(230,226,216,0.25)',
          position: 'absolute', top: '1px',
          left: on ? '13px' : '1px',
          transition: 'left 0.18s, background 0.18s',
        }} />
      </div>
    </button>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function AskSitePanel({ onClose, initialChatId, minimal }: { onClose?: () => void; initialChatId?: string | null; minimal?: boolean }) {
  const app = useApp()
  const { activeId, threads, removeThreadSoft } = app

  const [chats,        setChats]        = useState<AskSiteChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId ?? null)
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [capturing,    setCapturing]    = useState(false)
  const [, forceUpdate]  = useState(0)
  const [askContext,   setAskContext]   = useState<AskContextSelection>({ type: 'current' })
  const [liveViewOn,   setLiveViewOn]   = useState(true)
  const [chatArmed,    setChatArmed]    = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onWebState(e: Event) {
      const { url, title } = (e as CustomEvent).detail as { url: string; title: string }
      _web.url = url; _web.title = title; forceUpdate(n => n + 1)
    }
    window.addEventListener('site:web-state', onWebState)
    return () => window.removeEventListener('site:web-state', onWebState)
  }, [])

  // Reset to current thread context when the active thread changes
  useEffect(() => {
    setAskContext({ type: 'current' })
    setInput('')
  }, [activeId])

  // Load chats once on mount — independent of workspace thread
  useEffect(() => {
    const loaded = loadChats('__ask__')
    setChats(loaded)
    setActiveChatId(loaded[0]?.id ?? null)
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats, activeChatId, loading])

  const activeChat = chats.find(c => c.id === activeChatId) ?? null

  function handleDeleteThread(threadId: string) {
    const thread = threads.find(t => t.id === threadId)
    const insertIdx = threads.findIndex(t => t.id === threadId)
    if (!thread) return
    removeThreadSoft(threadId)
    window.dispatchEvent(new CustomEvent('site:thread-removed', { detail: { proj: thread, insertIdx } }))
    if (askContext.type === 'thread' && askContext.threadId === threadId) {
      setAskContext({ type: 'current' })
    }
  }

  function handleDeleteClick() {
    if (!activeChatId) return
    if (!chatArmed) { setChatArmed(true); return }
    setChatArmed(false)
    setChats(prev => {
      const next = prev.filter(c => c.id !== activeChatId)
      saveChats('__ask__', next)
      setActiveChatId(next[0]?.id ?? null)
      return next
    })
  }

  async function handleSend(msg?: string) {
    const content = (msg ?? input).trim()
    if (!content || loading || capturing) return
    setInput('')

    const userMsg: AskSiteMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user', content, ts: Date.now(), usedContext: true,
    }

    let chat = activeChat ?? createChat('__ask__')
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
      saveChats('__ask__', next); return next
    })

    let screenshot: string | undefined
    if (liveViewOn) {
      setCapturing(true)
      screenshot = await captureWindow() ?? undefined
      setCapturing(false)
    }

    setLoading(true)
    const ctx = await buildContext(app, askContext)
    const res = await askSiteAI({ messages: chatWithUser.messages, context: ctx, screenshot })

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
      saveChats('__ask__', next); return next
    })
    setLoading(false)
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      ...(minimal ? {} : { border: `1px solid ${BR}`, borderRadius: '4px', background: BG }),
    }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, userSelect: 'none' }}>
        {/* Row 1: back + label — hidden in minimal/tab mode */}
        {!minimal && (
          <div style={{
            height: '38px',
            display: 'flex', alignItems: 'center',
            padding: '0 8px 0 6px', gap: '2px',
            borderBottom: `1px solid ${BR}`,
          }}>
            {onClose && (
              <IconBtn onClick={onClose} title="Back to sources">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="7,1 3,5 7,9" />
                </svg>
              </IconBtn>
            )}
            <span style={{ fontSize: '13px', color: T, letterSpacing: '0.01em', flex: 1 }}>Ask Site</span>
          </div>
        )}
        {/* Row 2: context tab strip — scrollable */}
        <div
          className="tab-strip"
          style={{
            display: 'flex', alignItems: 'center',
            padding: '0 8px', gap: '2px',
            height: '44px',
            borderBottom: `1px solid ${BR}`,
            overflowX: 'auto',
          }}
        >
          <CtxTab
            label={threads.find(t => t.id === activeId)?.name || 'Current Thread'}
            active={askContext.type === 'current'}
            onClick={() => setAskContext({ type: 'current' })}
            onRemove={threads.length > 1 ? () => handleDeleteThread(activeId ?? '') : undefined}
          />
          {threads.filter(t => t.id !== activeId).map(t => (
            <CtxTab
              key={t.id}
              label={t.name || 'Untitled'}
              active={askContext.type === 'thread' && askContext.threadId === t.id}
              onClick={() => setAskContext({ type: 'thread', threadId: t.id, threadName: t.name || 'Untitled' })}
              onRemove={() => handleDeleteThread(t.id)}
            />
          ))}
        </div>
        {/* Row 3: chat actions — title, new, delete */}
        <div style={{
          height: '32px', display: 'flex', alignItems: 'center',
          padding: '0 6px 0 12px', gap: '2px',
          borderBottom: `1px solid ${BR}`,
        }}>
          <span style={{
            flex: 1, fontSize: '11px', color: F, letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            opacity: chatArmed ? 0.4 : 1,
            textDecoration: chatArmed ? 'line-through' : 'none',
            transition: 'opacity 0.15s',
          }}>
            {activeChat?.title ?? (chats.length > 0 ? `${chats.length} conversation${chats.length !== 1 ? 's' : ''}` : 'No conversations')}
          </span>
          {activeChat && (
            <IconBtn onClick={handleDeleteClick} title="Delete this conversation">
              <CloseIcon />
            </IconBtn>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      {(capturing || loading) && (
        <div style={{
          height: '2px', flexShrink: 0,
          background: capturing ? 'rgba(230,226,216,0.9)' : 'rgba(230,226,216,0.45)',
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }} />
      )}

      {/* ── Messages / empty state ── */}
      {activeChat && activeChat.messages.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {activeChat.messages.map((msg, i) => (
            <MessageRow key={msg.id} msg={msg} last={i === activeChat.messages.length - 1 && !loading} />
          ))}
          {capturing && <LoadingRow label="Reading screen…" bright />}
          {loading && !capturing && <LoadingRow />}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }} />
      )}

      {/* ── Composer ── */}
      <div style={{ flexShrink: 0, padding: minimal ? '0 10px 14px' : '0 8px 10px' }}>
        {/* Metadata row: context label + live view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 2px 5px', gap: '6px' }}>
          <span style={{ flex: 1, fontSize: '11px', color: 'rgba(230,226,216,0.3)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Using: {askContext.type === 'thread' ? askContext.threadName : (threads.find(t => t.id === activeId)?.name || 'This Thread')}
          </span>
          <PillToggle label="Live view" on={liveViewOn} onToggle={() => setLiveViewOn(v => !v)} />
        </div>
        {/* Input row */}
        <InputRow inputRef={inputRef} input={input} loading={loading} setInput={setInput} handleSend={handleSend} />
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
        placeholder="Ask this thread..."
        disabled={loading}
        spellCheck={false}
        style={{
          flex: 1, height: '30px',
          background: S, border: `1px solid ${BR}`,
          borderRadius: '4px', color: T,
          fontSize: '13px', padding: '0 10px',
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
