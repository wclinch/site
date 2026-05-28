import { useState, useEffect } from 'react'
import type { ContextMenu } from '../appTypes'

export interface SelectionState {
  selectedIds: Set<string>
  anchorId: string | null
  contextMenu: ContextMenu | null
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  setContextMenu: (m: ContextMenu | null) => void
}

export function useSelection(): SelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchorId,    setAnchorId]    = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  return { selectedIds, anchorId, contextMenu, setSelectedIds, setAnchorId, setContextMenu }
}
