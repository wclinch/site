'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { INBOX_ID } from '@/context/AppContext'
import type { RenameSourceDetail } from './SourceItem'

export default function SourceContextMenu() {
  const {
    contextMenu, setContextMenu,
    allSources, selectedIds, projects,
    removeSource, removeSelected, moveSourceToProject,
    inStack, addToStack, removeFromStack, atStackLimit,
  } = useApp()

  const [confirmDeleteSrcId, setConfirmDeleteSrcId] = useState<string | null>(null)
  const [projSearch, setProjSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (contextMenu) {
      setProjSearch('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [contextMenu?.srcId])

  if (!contextMenu) return null
  const src = allSources.find(s => s.id === contextMenu.srcId)
  if (!src) return null

  const isMulti = selectedIds.size > 1

  const homeProj = projects.find(p => p.sources.some(s => s.id === src.id))
  const namedProjects = projects.filter(p => p.id !== INBOX_ID)
  const isInInbox = homeProj?.id === INBOX_ID

  function handleRename() {
    const detail: RenameSourceDetail = { srcId: src!.id, currentLabel: src!.label ?? src!.raw }
    window.dispatchEvent(new CustomEvent('proof:rename-source', { detail }))
    setContextMenu(null)
  }

  function handleRemove() {
    if (confirmDeleteSrcId === src!.id) {
      if (isMulti) removeSelected()
      else removeSource(src!.id)
      setConfirmDeleteSrcId(null)
      setContextMenu(null)
    } else {
      setConfirmDeleteSrcId(src!.id)
    }
  }

  function handleMoveTo(targetProjId: string) {
    moveSourceToProject(src!.id, targetProjId)
    setContextMenu(null)
  }

  const menuBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 14px',
    cursor: 'pointer', fontSize: '12px', color: '#777',
    letterSpacing: '0.04em', fontFamily: 'inherit',
  }

  // All possible move targets
  const allTargets = [
    ...(isInInbox ? [] : [{ id: INBOX_ID, name: 'Floating' }]),
    ...namedProjects.filter(p => p.id !== homeProj?.id),
  ]

  const q = projSearch.trim().toLowerCase()
  const moveTargets = q
    ? allTargets.filter(t => t.name.toLowerCase().includes(q))
    : allTargets

  const showSearch = allTargets.length > 3

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: contextMenu.x, top: contextMenu.y,
        background: '#0f0f0f', border: '1px solid #222',
        zIndex: 200, minWidth: '180px',
        overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {!isMulti && (
        <>
          <button
            onClick={handleRename}
            style={menuBtn}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Rename
          </button>
          <div style={{ height: '1px', background: '#1e1e1e' }} />
          {(() => {
            const pinned = inStack(src.id)
            const disabled = !pinned && atStackLimit
            return (
              <>
                <button
                  onClick={() => {
                    if (pinned) removeFromStack(src.id)
                    else if (!disabled) addToStack(src.id)
                    setContextMenu(null)
                  }}
                  disabled={disabled}
                  title={disabled ? 'Source stack is full' : undefined}
                  style={{
                    ...menuBtn,
                    color: disabled ? '#3a3a3a' : pinned ? '#5ca8a0' : '#777',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#1e1e1e' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {pinned ? 'Unpin from stack' : 'Pin to stack'}
                </button>
                <div style={{ height: '1px', background: '#1e1e1e' }} />
              </>
            )
          })()}
        </>
      )}

      {!isMulti && allTargets.length > 0 && (
        <>
          {showSearch && (
            <div style={{ padding: '6px 10px' }}>
              <input
                ref={searchRef}
                value={projSearch}
                onChange={e => setProjSearch(e.target.value)}
                placeholder="Move to..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && moveTargets.length === 1) handleMoveTo(moveTargets[0].id)
                  if (e.key === 'Escape') setContextMenu(null)
                  e.stopPropagation()
                }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#161616', border: '1px solid #2a2a2a',
                  borderRadius: '3px', padding: '5px 8px',
                  fontSize: '11px', color: '#bbb', fontFamily: 'inherit',
                  outline: 'none', letterSpacing: '0.03em',
                }}
              />
            </div>
          )}
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            {moveTargets.map(t => (
              <button
                key={t.id}
                onClick={() => handleMoveTo(t.id)}
                style={{ ...menuBtn, color: '#555' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#888' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#555' }}
              >
                → {t.id === INBOX_ID ? 'Floating' : t.name.length > 22 ? t.name.slice(0, 20) + '…' : t.name}
              </button>
            ))}
            {moveTargets.length === 0 && (
              <div style={{ padding: '8px 14px', fontSize: '11px', color: '#444' }}>No projects found</div>
            )}
          </div>
          <div style={{ height: '1px', background: '#1e1e1e' }} />
        </>
      )}

      <button
        onClick={handleRemove}
        style={{ ...menuBtn, color: '#c55' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        {confirmDeleteSrcId === src.id
          ? 'Remove?'
          : `Remove${isMulti ? ` ${selectedIds.size}` : ''}`}
      </button>
    </div>
  )
}
