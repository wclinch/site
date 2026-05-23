'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

type Section = 'about' | 'sources' | 'view' | 'web' | 'asksite' | 'activity' | 'sessions' | 'transfer' | 'free' | 'pro'

// ─── Exact tokens from the live app ──────────────────────────────────────────
const T  = '#E6E2D8'
const M  = 'rgba(230,226,216,0.65)'
const F  = 'rgba(230,226,216,0.45)'
const S  = '#151615'
const BG = '#070807'
const BR = 'rgba(230,226,216,0.1)'

// ─── Nav items ────────────────────────────────────────────────────────────────
type NavItem = { key: Section; label: string; meta: string }

const NAV: NavItem[] = [
  { key: 'about',    label: 'About Site',  meta: 'macOS · Desktop only' },
  { key: 'sources',  label: 'Sources',     meta: 'Saved materials in the session' },
  { key: 'view',     label: 'View',        meta: 'Active working stack' },
  { key: 'web',      label: 'Web',         meta: 'Browse and save pages' },
  { key: 'asksite',  label: 'Ask Site',    meta: 'Session-aware intelligence' },
  { key: 'activity', label: 'Activity',    meta: 'Recent actions and undo' },
  { key: 'sessions', label: 'Sessions',    meta: 'Separate containers for work' },
  { key: 'transfer', label: 'Transfer',    meta: 'Move sources between sessions' },
]
const PLANS: NavItem[] = [
  { key: 'free', label: 'Free', meta: '$0 · 2 sessions · 250MB' },
  { key: 'pro',  label: 'Pro',  meta: '$4.99/mo · 2GB · Ask Site (40/day)' },
]

const CHIP: Record<Section, string> = {
  about:    'About Site',
  sources:  'Sources',
  view:     'View',
  web:      'Web',
  asksite:  'Ask Site',
  activity: 'Activity',
  sessions: 'Sessions',
  transfer: 'Transfer',
  free:     'Free',
  pro:      'Pro',
}

const SECTION_ORDER: Section[] = ['about', 'sources', 'view', 'web', 'asksite', 'activity', 'sessions', 'transfer', 'free', 'pro']
// Sections that make sense as View tabs (exclude pricing plans)
const VIEW_SECTIONS: Section[] = ['about', 'sources', 'view', 'web', 'asksite', 'activity', 'sessions', 'transfer']
const DOCS_KEYS  = new Set<Section>(['about', 'sources', 'view', 'web', 'asksite', 'activity'])
const PAGES_KEYS = new Set<Section>(['sessions', 'transfer', 'free', 'pro'])

// ─── Icons — exact copies from live components ────────────────────────────────
function IconBack()     { return <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,1 1,6 6,11"/></svg> }
function IconForward()  { return <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,1 6,6 1,11"/></svg> }
function IconReload()   { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.2"/><polyline points="7.5,0.5 9,2 7.5,3.5"/></svg> }
function IconHome()     { return <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 6.5L7 1.5l5.5 5M3 8v4.5h3V9.5h2v3h3V8"/></svg> }
function IconBookmark() { return <svg width="9" height="12" viewBox="0 0 9 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h7v10l-3.5-2L1 11V1z"/></svg> }
function IconSearch()   { return <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4.5"/><line x1="9.5" y1="9.5" x2="13" y2="13"/></svg> }
function IconExpand()   { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,4 1,1 4,1"/><polyline points="8,1 11,1 11,4"/><polyline points="11,8 11,11 8,11"/><polyline points="4,11 1,11 1,8"/></svg> }
function IconCollapse() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,1 4,4 1,4"/><polyline points="8,1 8,4 11,4"/><polyline points="11,8 8,8 8,11"/><polyline points="1,8 4,8 4,11"/></svg> }
function IconClose()    { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 1L8 8M8 1L1 8"/></svg> }
function IconPlus()     { return <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg> }
function IconSidebar()  { return <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="0.7" y="0.7" width="12.6" height="9.6" rx="1.5"/><line x1="4.7" y1="0.7" x2="4.7" y2="10.3"/></svg> }
function IconSend()     { return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="10" x2="6" y2="2"/><polyline points="2,6 6,2 10,6"/></svg> }

// ─── Shared buttons — exact from live app ────────────────────────────────────
function NavBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      width: '30px', height: '30px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none', border: 'none', borderRadius: '4px',
      cursor: disabled ? 'default' : 'pointer',
      color: disabled ? F : M, padding: 0, outline: 'none', lineHeight: 0,
      transition: 'color 0.15s',
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = T }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = disabled ? F : M }}
    >{children}</button>
  )
}

function RightBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      height: '32px', padding: '0 9px',
      background: 'none', border: 'none', borderRadius: '3px',
      color: M, fontSize: '13px', letterSpacing: '0.02em',
      cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
      transition: 'color 0.12s', whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => (e.currentTarget.style.color = T)}
      onMouseLeave={e => (e.currentTarget.style.color = M)}
    >{children}</button>
  )
}

function PaneIconBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: '26px', height: '26px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none', border: 'none', borderRadius: '3px',
      color: F, cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
      transition: 'color 0.12s',
    }}
      onMouseEnter={e => (e.currentTarget.style.color = T)}
      onMouseLeave={e => (e.currentTarget.style.color = F)}
    >{children}</button>
  )
}

function TabBarBtn({ children, borderLeft = true, onClick }: { children: React.ReactNode; borderLeft?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '44px', height: '44px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none', border: 'none',
      borderLeft: borderLeft ? `1px solid ${BR}` : 'none',
      color: M, cursor: 'pointer', padding: 0, outline: 'none',
      transition: 'color 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.color = T)}
      onMouseLeave={e => (e.currentTarget.style.color = M)}
    >{children}</button>
  )
}

// ─── Nav row — matches StackRow exactly ──────────────────────────────────────
function NavRow({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start',
        padding: '10px 8px 10px 14px',
        cursor: 'pointer', userSelect: 'none',
        background: active || hov ? S : 'transparent',
        borderLeft: `2px solid ${active ? M : hov ? S : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px', lineHeight: '1.45', letterSpacing: '0.01em', color: T,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.label}</div>
        <div style={{ fontSize: '11px', color: F, marginTop: '2px', letterSpacing: '0.01em' }}>{item.meta}</div>
      </div>
    </div>
  )
}

// ─── Center content ───────────────────────────────────────────────────────────
function Txt({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <p style={{ fontSize: '13px', color: dim ? F : M, lineHeight: 1.85, margin: '0 0 14px', maxWidth: '520px' }}>{children}</p>
}
function Divider() { return <div style={{ height: '1px', background: S, margin: '20px 0' }} /> }
function TableRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '9px 0', borderBottom: `1px solid ${S}` }}>
      <span style={{ fontSize: '12px', color: F, width: '130px', flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: '12px', color: M }}>{v}</span>
    </div>
  )
}

function SectionContent({ s }: { s: Section }) {
  const title = (t: string) => <p style={{ fontSize: '16px', color: T, margin: '0 0 18px', letterSpacing: '-0.01em' }}>{t}</p>

  if (s === 'about') return (
    <>
      <p style={{ fontSize: '22px', fontWeight: 400, color: T, margin: '0 0 16px', letterSpacing: '-0.01em' }}>Site</p>
      <Txt>Live sessions for source-heavy work. Keep sources, web tabs, activity, and AI context together.</Txt>
      <Txt dim>Sessions restore completely on open — sources loaded, tabs at their last URL, View intact. Sessions are isolated containers. Not a note editor. Not a filing system.</Txt>
      <Divider />
      <Txt dim>macOS only. All data stays on your device. No setup required.</Txt>
    </>
  )

  if (s === 'sources') return (
    <>
      {title('Sources')}
      <Txt>Sources are saved materials in the session — PDFs, images, screenshots, notes, and web pages. Add with + in the shelf, or drop files onto the View.</Txt>
      <Txt dim>Click any source to open it in the View stack. Opening a source doesn't remove it from the shelf. Sources stay until you explicitly remove them.</Txt>
      <Divider />
      <Txt dim>All sources are stored locally via IndexedDB. Nothing leaves your device. Free: 250MB. Pro: 2GB.</Txt>
    </>
  )

  if (s === 'view') return (
    <>
      {title('View')}
      <Txt>The View is the center panel — the active working set. Open sources from the shelf into it. Each opens as a tab. Stack multiple to work through them.</Txt>
      <Txt dim>PDFs, images, notes, and saved pages all open in the same View stack. Switch between open items by clicking their tabs.</Txt>
      <Divider />
      <Txt dim>Browse on the right. Work through sources in the View. Ask Site about the session.</Txt>
    </>
  )

  if (s === 'web') return (
    <>
      {title('Web')}
      <Txt>A full browser in the right panel. Tabs restore on every open. Type any site name — github, figma, chatgpt — no full URL needed. Prefix with ? to force a Google search.</Txt>
      <Txt dim>Bookmark a page to save it to your session's Sources. Tabs are per-session and don't carry over unless pinned.</Txt>
      <Divider />
      <Txt dim>Pin a tab with the dot. Move a page from Web into the View stack by dragging it.</Txt>
    </>
  )

  if (s === 'asksite') return (
    <>
      {title('Ask Site')}
      <Txt>Ask Site understands the full session — active View, View stack, sources, Web, and activity.</Txt>
      <Txt dim>Ask about what's open, visible, or saved in the current session. Get summaries, comparisons, and context from your open documents and active browser.</Txt>
      <Divider />
      <Txt dim>Pro only. 40 messages per day. No setup — included with Pro subscription.</Txt>
    </>
  )

  if (s === 'activity') return (
    <>
      {title('Activity')}
      <Txt>Activity logs recent state changes in the session — what opened, what moved, what changed.</Txt>
      <Txt dim>Every source move and transfer is recorded. Undo transfers with a timed undo option. Free plan includes basic activity. Pro extends the history window.</Txt>
    </>
  )

  if (s === 'sessions') return (
    <>
      {title('Sessions')}
      <Txt>Sessions are separate containers for work. Each holds its own sources, browser tabs, and View state. Switching is instant — everything picks up exactly where it left off.</Txt>
      <Txt dim>Create with +. Rename by double-clicking the tab. Drag to reorder. Pin with the dot to lock to the left. Close with ×.</Txt>
      <Divider />
      <Txt dim>Sessions persist through restarts. Closing and reopening restores sources, tab URLs, and View state. Free: 2 sessions. Pro: unlimited.</Txt>
    </>
  )

  if (s === 'transfer') return (
    <>
      {title('Transfer')}
      <Txt>Move and copy sources, pages, and tabs between sessions. Drag any source from the shelf onto a session tab to add it there.</Txt>
      <Txt dim>Hold for 600ms — the session peeks open. Drop anywhere inside. Release outside to cancel and return to the original session.</Txt>
      <Divider />
      <Txt dim>Every move logs in Activity with a timed undo. Full session transfer is a Pro feature.</Txt>
    </>
  )

  if (s === 'free') return (
    <>
      {title('Free')}
      <p style={{ fontSize: '13px', color: F, margin: '0 0 20px', maxWidth: '520px' }}>Start without an account.</p>
      <div style={{ maxWidth: '480px', borderTop: `1px solid ${BR}` }}>
        {([
          ['Price',     '$0 — no account required'],
          ['Sessions',  '2 active sessions'],
          ['Storage',   '250MB'],
          ['Web',       'Full browser, tabs restore'],
          ['View',      'Full View stack'],
          ['Activity',  'Basic'],
          ['Ask Site',  'Not included'],
        ] as [string, string][]).map(([k, v]) => <TableRow key={k} k={k} v={v} />)}
      </div>
    </>
  )

  if (s === 'pro') return (
    <>
      {title('Pro')}
      <p style={{ fontSize: '13px', color: F, margin: '0 0 20px', maxWidth: '520px' }}>More room, full session transfer, and Ask Site.</p>
      <div style={{ maxWidth: '480px', borderTop: `1px solid ${BR}` }}>
        {([
          ['Price',            '$4.99 / month or $39.99 / year'],
          ['Sessions',         'Unlimited'],
          ['Storage',          '2GB'],
          ['Pinned sessions',  'Yes'],
          ['Session transfer', 'Full — move and copy'],
          ['Activity history', 'Extended'],
          ['Ask Site',         '40 messages / day'],
        ] as [string, string][]).map(([k, v]) => <TableRow key={k} k={k} v={v} />)}
      </div>
      <div style={{ marginTop: '20px' }}>
        <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: '12px', color: T, textDecoration: 'none',
          border: `1px solid ${BR}`, borderRadius: '3px',
          padding: '7px 18px', background: S,
          letterSpacing: '0.02em', transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = BR)}
        >Get Pro →</a>
      </div>
    </>
  )

  return null
}

// ─── Pricing panel ────────────────────────────────────────────────────────────
function PricingPanel() {
  const rows: [string, string, string][] = [
    ['Price',            '$0',                '$4.99 / month'],
    ['',                 '',                  '$39.99 / year'],
    ['Sessions',         '2',                 'Unlimited'],
    ['Storage',          '250MB',             '2GB'],
    ['Pinned sessions',  '—',                 'Yes'],
    ['Session transfer', '—',                 'Full'],
    ['Activity history', 'Basic',             'Extended'],
    ['Ask Site',         '—',                 '40 / day'],
  ]
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 16px' }}>
      <div style={{ display: 'flex', gap: '8px', padding: '0 0 8px', borderBottom: `1px solid ${BR}`, marginBottom: '2px' }}>
        <span style={{ flex: 1, fontSize: '11px', color: F, letterSpacing: '0.03em' }}>Feature</span>
        <span style={{ width: '88px', flexShrink: 0, fontSize: '11px', color: T, letterSpacing: '0.03em' }}>Free</span>
        <span style={{ width: '88px', flexShrink: 0, fontSize: '11px', color: T, letterSpacing: '0.03em' }}>Pro</span>
      </div>
      {rows.map(([feature, free, pro], i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', padding: '7px 0', borderBottom: `1px solid ${S}` }}>
          <span style={{ flex: 1, fontSize: '11px', color: M }}>{feature}</span>
          <span style={{ width: '88px', flexShrink: 0, fontSize: '11px', color: free === '—' ? F : M }}>{free}</span>
          <span style={{ width: '88px', flexShrink: 0, fontSize: '11px', color: pro === '—' ? F : M }}>{pro}</span>
        </div>
      ))}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${BR}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: F }}>Free — no account required. Open Site and start.</div>
        <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: '11px', color: T, textDecoration: 'none',
          border: `1px solid ${BR}`, borderRadius: '3px',
          padding: '5px 14px', background: S,
          letterSpacing: '0.02em', transition: 'border-color 0.15s', alignSelf: 'flex-start',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = BR)}
        >Get Pro →</a>
      </div>
    </div>
  )
}

// ─── Globe icon (matches real WebHomePage) ───────────────────────────────────
function IconGlobe() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22" cy="22" r="18"/>
      <ellipse cx="22" cy="22" rx="8" ry="18"/>
      <line x1="4" y1="22" x2="40" y2="22"/>
      <line x1="6" y1="14" x2="38" y2="14"/>
      <line x1="6" y1="30" x2="38" y2="30"/>
    </svg>
  )
}

// ─── Web home mock — bottom portion of right panel ───────────────────────────
function WebHomeMock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{ height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${BR}`, background: BG }}>
        <TabBarBtn borderLeft={false}><IconExpand /></TabBarBtn>
        <div style={{ width: '1px', height: '14px', background: 'rgba(230,226,216,0.2)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', padding: '0 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            height: '34px', padding: '0 12px', borderRadius: '4px', flexShrink: 0,
            background: S, border: `1px solid ${BR}`, userSelect: 'none',
          }}>
            <span style={{ fontSize: '13px', letterSpacing: '0.02em', color: T }}>New tab</span>
          </div>
          <button style={{
            width: '28px', height: '28px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: F, cursor: 'pointer', lineHeight: 0, outline: 'none',
            transition: 'color 0.12s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = M)}
            onMouseLeave={e => (e.currentTarget.style.color = F)}
          ><IconPlus /></button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', padding: '0 12px', borderBottom: `1px solid ${BR}`, background: BG }}>
        <NavBtn disabled><IconBack /></NavBtn>
        <NavBtn disabled><IconForward /></NavBtn>
        <NavBtn><IconReload /></NavBtn>
        <NavBtn><IconHome /></NavBtn>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
          <span style={{ position: 'absolute', left: '9px', color: M, pointerEvents: 'none', lineHeight: 0 }}><IconSearch /></span>
          <input
            placeholder="Search or enter URL"
            spellCheck={false}
            style={{
              flex: 1, width: '100%', height: '28px', background: S, border: `1px solid ${BR}`,
              borderRadius: '4px', color: T,
              fontSize: '12px', padding: '0 10px 0 28px',
              outline: 'none', fontFamily: 'inherit', letterSpacing: '0.01em',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.25)')}
            onBlur={e  => (e.currentTarget.style.borderColor = BR)}
          />
        </div>
        <button style={{
          width: '28px', height: '26px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: `1px solid transparent`, borderRadius: '4px',
          color: M, cursor: 'pointer', padding: 0, outline: 'none', lineHeight: 0,
          transition: 'color 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = T)}
          onMouseLeave={e => (e.currentTarget.style.color = M)}
        ><IconBookmark /></button>
      </div>

      {/* Home page content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
        <div style={{ color: 'rgba(230,226,216,0.3)', lineHeight: 0 }}><IconGlobe /></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '260px' }}>
          <span style={{ position: 'absolute', left: '10px', color: M, pointerEvents: 'none', lineHeight: 0 }}><IconSearch /></span>
          <input
            placeholder="Search or enter URL"
            spellCheck={false}
            style={{
              width: '100%', height: '32px', background: S, border: `1px solid ${BR}`,
              borderRadius: '4px', color: T,
              fontSize: '12px', padding: '0 10px 0 30px',
              outline: 'none', fontFamily: 'inherit', letterSpacing: '0.01em',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.25)')}
            onBlur={e  => (e.currentTarget.style.borderColor = BR)}
          />
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Google', 'ChatGPT', 'Wikipedia'].map(label => (
            <button key={label} style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '12px', color: F, cursor: 'pointer',
              fontFamily: 'inherit', letterSpacing: '0.01em',
              transition: 'color 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = M)}
              onMouseLeave={e => (e.currentTarget.style.color = F)}
            >{label}</button>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: F, letterSpacing: '0.03em' }}>? query → Google</span>
      </div>
    </div>
  )
}

// ─── Ask Site demo panel — click to advance, no typing ───────────────────────
const DEMO_STEPS = [
  { role: 'user' as const, text: 'What do I have open?' },
  { role: 'site' as const, text: 'Eight sources in the shelf — About Site, Sources, View, Web, Ask Site, Activity, Sessions, and Transfer. Active View shows "About Site." No web page open in the browser.' },
  { role: 'user' as const, text: "What's the difference between sources and the View?" },
  { role: 'site' as const, text: 'Sources are saved materials in the shelf — they persist in the session. The View is the active working set, what you have open right now. Opening a source adds it to the View stack without removing it from the shelf.' },
]

function AskSiteMockPanel() {
  const msgs = DEMO_STEPS

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px 0 10px', borderBottom: `1px solid ${BR}`, background: BG }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          height: '28px', padding: '0 12px',
          borderRadius: '4px', background: S, border: `1px solid ${BR}`,
          fontSize: '13px', color: T, letterSpacing: '0.01em', userSelect: 'none', flexShrink: 0,
        }}>Ask Site</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {msgs.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', color: F, letterSpacing: '0.02em' }}>Ask the current session.</span>
          </div>
        ) : (
          msgs.map((msg, i) => (
            <div key={i} style={{ padding: '9px 10px 9px 12px', borderBottom: i < msgs.length - 1 ? `1px solid ${S}` : 'none' }}>
              <div style={{ fontSize: '12px', color: F, letterSpacing: '0.03em', marginBottom: '3px' }}>
                {msg.role === 'user' ? 'You' : 'Site'}
              </div>
              <div style={{ fontSize: '12px', color: M, lineHeight: 1.6 }}>{msg.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Static input — display only */}
      <div style={{ flexShrink: 0, padding: '6px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            flex: 1, height: '30px',
            background: S, border: `1px solid ${BR}`,
            borderRadius: '4px', display: 'flex', alignItems: 'center',
            padding: '0 10px', cursor: 'default', userSelect: 'none',
          }}>
            <span style={{ fontSize: '12px', color: F, letterSpacing: '0.01em' }}>
              Ask about what&apos;s open, visible, or saved here…
            </span>
          </div>
          <div style={{
            width: '30px', height: '30px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: `1px solid transparent`,
            borderRadius: '4px', color: F, lineHeight: 0,
          }}><IconSend /></div>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [active,           setActive]           = useState<Section>('about')
  const [filter,           setFilter]           = useState<'all' | 'docs' | 'pages'>('all')
  const [fade,             setFade]             = useState(false)
  const [viewFocused,      setViewFocused]      = useState(false)
  const [researchFocused,  setResearchFocused]  = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const visibleItems: NavItem[] =
    filter === 'docs'  ? [...NAV, ...PLANS].filter(i => DOCS_KEYS.has(i.key)) :
    filter === 'pages' ? [...NAV, ...PLANS].filter(i => PAGES_KEYS.has(i.key)) :
    [...NAV, ...PLANS]

  const navigate = useCallback((s: Section) => {
    if (s === active) return
    setFade(true)
    setTimeout(() => { setActive(s); setFade(false) }, 80)
  }, [active])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = SECTION_ORDER.indexOf(active)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); navigate(SECTION_ORDER[(idx + 1) % SECTION_ORDER.length])
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); navigate(SECTION_ORDER[(idx - 1 + SECTION_ORDER.length) % SECTION_ORDER.length])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, navigate])

  return (
    <div style={{
      background: '#040504', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      gap: '16px',
    }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { display: none; } ::placeholder { color: rgba(230,226,216,0.45); }`}</style>

      {/* ── Header ── */}
      <div style={{ width: '100%', maxWidth: '1260px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: T, letterSpacing: '0.06em' }}>Site</span>
        <span style={{ fontSize: '12px', color: F }}>Live sessions for source-heavy work.</span>
      </div>

      {/* ── Window ── */}
      <div style={{
        width: '100%', maxWidth: '1260px',
        height: 'calc(100vh - 120px)', maxHeight: '820px', minHeight: '560px',
        background: BG, borderRadius: '11px',
        border: `1px solid ${BR}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── ProjectBar ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          height: '60px', flexShrink: 0,
          borderBottom: `1px solid ${BR}`, overflow: 'hidden',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', overflow: 'hidden', paddingLeft: '20px' }}>
            <div style={{ display: 'flex', gap: '6px', marginRight: '12px', flexShrink: 0 }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28C840' }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center',
              height: '36px', padding: '0 8px 0 12px', gap: '4px', flexShrink: 0,
              background: S, border: `1px solid ${S}`, borderRadius: '4px',
              cursor: 'default', userSelect: 'none',
            }}>
              <span style={{ fontSize: '13px', letterSpacing: '0.01em', color: T }}>Site</span>
              <button style={{
                width: '20px', height: '20px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, outline: 'none', lineHeight: 0, color: M, transition: 'color 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = T)}
                onMouseLeave={e => (e.currentTarget.style.color = M)}
              ><IconClose /></button>
            </div>
            <button style={{
              width: '24px', height: '24px', flexShrink: 0, marginLeft: '2px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none',
              color: F, cursor: 'pointer', padding: 0, outline: 'none', transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = M)}
              onMouseLeave={e => (e.currentTarget.style.color = F)}
            ><IconPlus /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 8px', flexShrink: 0 }}>
            <div style={{ width: '1px', height: '14px', background: 'rgba(230,226,216,0.2)', marginRight: '2px', flexShrink: 0 }} />
            <RightBtn>Ask Site</RightBtn>
            <span style={{ color: 'rgba(230,226,216,0.3)', fontSize: '14px', lineHeight: 1, margin: '0 2px', userSelect: 'none' }}>·</span>
            <RightBtn>Account</RightBtn>
          </div>
        </div>

        {/* ── 3-panel layout ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', padding: '0 7px 7px 7px' }}>

          {/* ── Left: Source shelf ── */}
          <div style={{ width: (viewFocused || sidebarCollapsed) ? 0 : '22%', minWidth: (viewFocused || sidebarCollapsed) ? 0 : '190px', maxWidth: '250px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.22s ease' }}>
            <div style={{ flex: 1, minHeight: 0, padding: '7px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                border: `1px solid ${BR}`, borderRadius: '4px', background: BG, overflow: 'hidden',
              }}>
                {/* Shelf header */}
                <div style={{
                  height: '52px', flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  padding: '0 8px 0 10px',
                  background: BG, borderBottom: `1px solid ${BR}`, userSelect: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                    {(['all', 'docs', 'pages'] as const).map(f => (
                      <button key={f} onClick={() => setFilter(f)} style={{
                        height: '34px', padding: '0 14px',
                        background: filter === f ? S : 'none',
                        border: `1px solid ${filter === f ? S : 'transparent'}`,
                        borderRadius: '4px', cursor: 'pointer', outline: 'none',
                        fontSize: '13px', letterSpacing: '0.01em',
                        color: filter === f ? T : M,
                        fontFamily: 'inherit', fontWeight: 400,
                        transition: 'color 0.1s, background 0.1s',
                      }}
                        onMouseEnter={e => { if (filter !== f) e.currentTarget.style.color = T }}
                        onMouseLeave={e => { if (filter !== f) e.currentTarget.style.color = M }}
                      >{f === 'all' ? 'All' : f === 'docs' ? 'Documents' : 'Pages'}</button>
                    ))}
                  </div>
                  <button onClick={() => setSidebarCollapsed(v => !v)} style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: M, lineHeight: 0, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = T)}
                    onMouseLeave={e => (e.currentTarget.style.color = M)}
                  ><IconSidebar /></button>
                </div>
                {/* Source rows */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 0 4px', display: 'flex', flexDirection: 'column' }}>
                  {visibleItems.map((item, i) => {
                    const prevIsPlan = i > 0 && PLANS.includes(item) && !PLANS.includes(visibleItems[i - 1])
                    return (
                      <div key={item.key}>
                        {prevIsPlan && filter === 'all' && (
                          <div style={{ height: '1px', background: 'rgba(230,226,216,0.15)', margin: '4px 0', flexShrink: 0 }} />
                        )}
                        <NavRow item={item} active={active === item.key} onClick={() => navigate(item.key)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Center: View ── */}
          <div style={{ flexGrow: researchFocused ? 0 : 1, flexShrink: 1, flexBasis: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'flex-grow 0.22s ease' }}>
            <div style={{ flex: 1, minHeight: 0, padding: '7px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${BR}`, borderRadius: '4px', overflow: 'hidden' }}>

                {/* View header — tab strip showing open items */}
                <div style={{ height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', gap: '4px', borderBottom: `1px solid ${BR}` }}>
                  {/* Active tab chip */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: '28px', padding: '0 12px', marginLeft: '4px',
                    borderRadius: '4px', background: S, border: `1px solid ${BR}`,
                    fontSize: '13px', color: T, letterSpacing: '0.01em',
                    userSelect: 'none', flexShrink: 0,
                    maxWidth: '200px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>{CHIP[active]}</span>


                  <div style={{ flex: 1 }} />
                  <PaneIconBtn title={viewFocused ? 'Restore' : 'Expand'} onClick={() => setViewFocused(v => !v)}>
                    {viewFocused ? <IconCollapse /> : <IconExpand />}
                  </PaneIconBtn>
                </div>

                {/* View body */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '36px 44px 40px', opacity: fade ? 0 : 1, transition: 'opacity 0.08s ease' }}>
                  <SectionContent s={active} />
                  <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: F, letterSpacing: '0.02em' }}>No account required to start.</span>
                    <a href="/app" style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: '12px', color: T, textDecoration: 'none',
                      border: `1px solid ${BR}`, borderRadius: '3px',
                      padding: '7px 18px', background: S,
                      letterSpacing: '0.02em', transition: 'border-color 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(230,226,216,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = BR)}
                    >Open Site →</a>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Right: Ask Site (top) + Web home (bottom) ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, padding: '7px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                border: `1px solid ${BR}`, borderRadius: '4px', overflow: 'hidden',
              }}>
                {/* Ask Site — top 50% */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <AskSiteMockPanel />
                </div>

                {/* Divider */}
                <div style={{ height: '1px', flexShrink: 0, background: BR }} />

                {/* Web home — bottom 50% */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <WebHomeMock />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ width: '100%', maxWidth: '1260px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: F }}>macOS only</span>
        <span style={{ fontSize: '11px', color: F }}>No account required to start</span>
      </div>
    </div>
  )
}
