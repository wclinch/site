'use client'
import { useState } from 'react'
import { useApp } from '@/context/AppContext'
interface RenameSourceDetail { srcId: string; currentLabel: string }

export default function SourceContextMenu() {
  const {
    contextMenu, setContextMenu,
    allSources, selectedIds,
    removeSource, removeSelected,
  } = useApp()

  const [confirmDeleteSrcId, setConfirmDeleteSrcId] = useState<string | null>(null)

  if (!contextMenu) return null
  const src = allSources.find(s => s.id === contextMenu.srcId)
  if (!src) return null

  const isMulti = selectedIds.size > 1

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

  const menuBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 14px',
    cursor: 'pointer', fontSize: '12px', color: 'rgba(230,226,216,0.45)',
    letterSpacing: '0.04em', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: contextMenu.x, top: contextMenu.y,
        background: '#171817', border: '1px solid #232523',
        zIndex: 200, minWidth: '140px',
        overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {!isMulti && (
        <>
          <button
            onClick={handleRename}
            style={menuBtn}
            onMouseEnter={e => (e.currentTarget.style.background = '#232523')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Rename
          </button>
          <div style={{ height: '1px', background: '#232523' }} />
        </>
      )}
      <button
        onClick={handleRemove}
        style={{ ...menuBtn, color: '#c46b5a' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#232523')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        {confirmDeleteSrcId === src.id
          ? 'Confirm'
          : `Remove${isMulti ? ` ${selectedIds.size}` : ''}`}
      </button>
    </div>
  )
}
