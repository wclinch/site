'use client'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import type { Thread, SavedResearchTab, ViewTab } from '@/lib/types'
import type { ThreadInheritOpts } from '../appTypes'
import { newThread } from '@/lib/storage'
import { deleteFile, deleteContent } from '@/lib/idb'
import { migrateToViewTabs } from './useViewTabs'

function notifyStorageChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('site-storage-changed'))
}

interface WorkspaceActionsParams {
  threads: Thread[]
  activeId: string | null
  namedThreadCount: number
  setThreads: Dispatch<SetStateAction<Thread[]>>
  setActiveId: Dispatch<SetStateAction<string | null>>
  setSelectedIds: (ids: Set<string>) => void
  setAnchorId: (id: string | null) => void
  threadsRef: RefObject<Thread[]>
  viewTabsRef: RefObject<ViewTab[]>
  activeViewTabIdRef: RefObject<string | null>
  setViewTabs: Dispatch<SetStateAction<ViewTab[]>>
  setActiveViewTabId: Dispatch<SetStateAction<string | null>>
  readResearchTabs: () => SavedResearchTab[]
  loadResearchTabs: (tabs: SavedResearchTab[], threadId?: string) => void
}

export interface WorkspaceActionsResult {
  switchThread: (id: string) => void
  newThread: (opts?: ThreadInheritOpts) => void
  removeThread: (targetId?: string) => void
  removeThreadSoft: (targetId: string) => void
  commitThreadRemoval: (thread: Thread) => void
  restoreThread: (thread: Thread, insertIdx: number) => void
}

export function useWorkspaceActions({
  threads, activeId, namedThreadCount,
  setThreads, setActiveId,
  setSelectedIds, setAnchorId,
  threadsRef, viewTabsRef, activeViewTabIdRef,
  setViewTabs, setActiveViewTabId,
  readResearchTabs, loadResearchTabs,
}: WorkspaceActionsParams): WorkspaceActionsResult {

  function switchThread(id: string) {
    if (id === activeId) return
    const curId        = activeId
    const curTabs      = viewTabsRef.current
    const curActiveTab = curTabs.find(t => t.id === activeViewTabIdRef.current)
    const researchTabs = readResearchTabs()

    setThreads(ps => ps.map(p => p.id === curId
      ? { ...p, viewTabs: curTabs, activeViewTabId: activeViewTabIdRef.current, researchTabs }
      : p))

    const newProj = threads.find(p => p.id === id)
    setActiveId(id)
    setSelectedIds(new Set())
    setAnchorId(null)

    const { viewTabs: newTabs, activeViewTabId: newActiveId } =
      migrateToViewTabs(newProj, threads.flatMap(p => p.sources))
    setViewTabs(newTabs)
    setActiveViewTabId(newActiveId)

    if (typeof window !== 'undefined') {
      const newActiveTab = newTabs.find(t => t.id === newActiveId)
      if (curActiveTab?.url || !newActiveTab?.url) {
        ;(window as any).electronAPI?.view?.clear?.('1')
      }
    }

    loadResearchTabs(newProj?.researchTabs ?? [], id)
  }

  function _newThread(opts?: ThreadInheritOpts) {
    const curId        = activeId
    const curTabs      = viewTabsRef.current
    const researchTabs = readResearchTabs()

    if (curId) {
      setThreads(ps => ps.map(p => p.id === curId
        ? { ...p, viewTabs: curTabs, activeViewTabId: activeViewTabIdRef.current, researchTabs }
        : p))
    }

    const p = newThread(namedThreadCount + 1)
    const usedNames = new Set(threadsRef.current.map(w => w.name))
    let sessionName = 'New Thread'
    if (usedNames.has(sessionName)) {
      for (let i = 2; i <= threadsRef.current.length + 2; i++) {
        const candidate = `New Thread ${i}`
        if (!usedNames.has(candidate)) { sessionName = candidate; break }
      }
    }
    p.name = sessionName
    if (opts) {
      p.originThreadId          = opts.originThreadId
      p.originThreadTitle       = opts.originThreadTitle
      p.inheritedContextSummary = opts.inheritedContextSummary
    }
    setThreads(ps => [...ps, p])
    setActiveId(p.id)
    setViewTabs([])
    setActiveViewTabId(null)
    setSelectedIds(new Set())
    setAnchorId(null)
    if (typeof window !== 'undefined') {
      ;(window as any).electronAPI?.view?.clear?.('1')
    }

    loadResearchTabs([], p.id)
  }

  function _removeThreadCore(id: string, reap: boolean) {
    if (threads.length <= 1) return
    const thread = threads.find(p => p.id === id)
    if (!thread) return

    const sourceIds = thread.sources.map(s => s.id)
    function reapSources() {
      if (reap && sourceIds.length) {
        Promise.allSettled(sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
          .then(notifyStorageChanged)
      }
    }

    if (id !== activeId) {
      setThreads(ps => ps.filter(p => p.id !== id))
      reapSources()
      return
    }

    const remaining = threads.filter(p => p.id !== id)
    const idx       = threads.findIndex(p => p.id === id)

    setThreads(remaining)
    setSelectedIds(new Set())
    setAnchorId(null)

    if (remaining.length === 0) {
      setActiveId(null)
      setViewTabs([])
      setActiveViewTabId(null)
      if (typeof window !== 'undefined') (window as any).electronAPI?.view?.clear?.('1')
      loadResearchTabs([])
    } else {
      const nextThread = remaining[Math.max(0, idx - 1)]
      setActiveId(nextThread.id)
      const { viewTabs: nTabs, activeViewTabId: nActiveId } =
        migrateToViewTabs(nextThread, threadsRef.current.flatMap(p => p.sources))
      setViewTabs(nTabs)
      setActiveViewTabId(nActiveId)
      if (typeof window !== 'undefined') {
        const newActiveTab = nTabs.find(t => t.id === nActiveId)
        if (!newActiveTab?.url) (window as any).electronAPI?.view?.clear?.('1')
      }
      loadResearchTabs(nextThread.researchTabs ?? [], nextThread.id)
    }

    reapSources()
  }

  function removeThread(targetId?: string) {
    const id = targetId ?? activeId
    if (!id) return
    _removeThreadCore(id, true)
  }

  function removeThreadSoft(targetId: string) {
    _removeThreadCore(targetId, false)
  }

  function commitThreadRemoval(thread: Thread) {
    const sourceIds = thread.sources.map(s => s.id)
    if (sourceIds.length) {
      Promise.allSettled(sourceIds.flatMap(sid => [deleteFile(sid), deleteContent(sid)]))
        .then(notifyStorageChanged)
    }
  }

  function restoreThread(thread: Thread, insertIdx: number) {
    setThreads(ps => {
      const next = [...ps]
      next.splice(insertIdx, 0, thread)
      return next
    })
    setActiveId(thread.id)
    const { viewTabs: rTabs, activeViewTabId: rActiveId } =
      migrateToViewTabs(thread, threadsRef.current.flatMap(p => p.sources))
    setViewTabs(rTabs)
    setActiveViewTabId(rActiveId)
    loadResearchTabs(thread.researchTabs ?? [], thread.id)
  }

  return {
    switchThread, newThread: _newThread,
    removeThread, removeThreadSoft, commitThreadRemoval, restoreThread,
  }
}
