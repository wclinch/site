'use client'
import { useState, useEffect, useRef, Dispatch, SetStateAction, RefObject } from 'react'
import type { Thread, Source, ViewTab } from '@/lib/types'
import { uid } from '@/lib/storage'

// Migrates a project's persisted state into the ViewTab model.
// Handles both the current model (proj.viewTabs) and the legacy two-pane model
// (sel1/sel2/view1Page/view2Page). URL-type view tabs are intentionally dropped
// on restore — they open in the research browser, not the center pane.
export function migrateToViewTabs(
  proj: Thread | undefined,
  allSrcs: Source[] = [],
): { viewTabs: ViewTab[]; activeViewTabId: string | null } {
  if (!proj) return { viewTabs: [], activeViewTabId: null }
  if (proj.viewTabs !== undefined) {
    return {
      viewTabs: proj.viewTabs ?? [],
      activeViewTabId: proj.activeViewTabId ?? proj.viewTabs?.[0]?.id ?? null,
    }
  }
  // Legacy migration: sel1/sel2/view1Page/view2Page
  const tabs: ViewTab[] = []
  let firstId: string | null = null
  function add(tab: ViewTab) { tabs.push(tab); if (!firstId) firstId = tab.id }
  if (proj.view1Page) {
    add({ id: uid(), url: proj.view1Page.url, title: proj.view1Page.title, srcId: proj.view1Page.srcId })
  } else if (proj.sel1 && allSrcs.find(s => s.id === proj.sel1)) {
    add({ id: uid(), srcId: proj.sel1 })
  }
  if (proj.view2Page) {
    add({ id: uid(), url: proj.view2Page.url, title: proj.view2Page.title, srcId: proj.view2Page.srcId })
  } else if (proj.sel2 && allSrcs.find(s => s.id === proj.sel2)) {
    add({ id: uid(), srcId: proj.sel2 })
  }
  return { viewTabs: tabs, activeViewTabId: firstId }
}

export interface ViewTabsHookResult {
  // Public API — these flow into AppState
  viewTabs: ViewTab[]
  activeViewTabId: string | null
  activeViewTab: ViewTab | null
  openInView: (srcId: string) => void
  openUrlInView: (url: string, title: string, srcId?: string) => void
  closeViewTab: (tabId: string) => void
  switchViewTab: (tabId: string) => void
  reorderViewTabs: (fromId: string, toId: string) => void
  // Internal helpers — used by workspace and source functions in AppContext
  setViewTabs: Dispatch<SetStateAction<ViewTab[]>>
  setActiveViewTabId: Dispatch<SetStateAction<string | null>>
  viewTabsRef: RefObject<ViewTab[]>
  activeViewTabIdRef: RefObject<string | null>
}

export function useViewTabs(): ViewTabsHookResult {
  const [viewTabs,        setViewTabs]        = useState<ViewTab[]>([])
  const [activeViewTabId, setActiveViewTabId] = useState<string | null>(null)

  const viewTabsRef        = useRef<ViewTab[]>([])
  const activeViewTabIdRef = useRef<string | null>(null)

  useEffect(() => { viewTabsRef.current = viewTabs },              [viewTabs])
  useEffect(() => { activeViewTabIdRef.current = activeViewTabId }, [activeViewTabId])

  const activeViewTab = viewTabs.find(t => t.id === activeViewTabId) ?? null

  function openInView(srcId: string) {
    const tabs = viewTabsRef.current
    const activeTab = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (activeTab && !activeTab.srcId && !activeTab.url) {
      setViewTabs(ts => ts.map(t => t.id === activeTab.id ? { id: t.id, srcId } : t))
      return
    }
    const tabId = uid()
    setViewTabs(ts => [...ts, { id: tabId, srcId }])
    setActiveViewTabId(tabId)
    ;(window as any).electronAPI?.view?.clear?.('1')
  }

  function openUrlInView(url: string, title: string, srcId?: string) {
    const tabs = viewTabsRef.current
    const existing = tabs.find(t => t.url === url)
    if (existing) { setActiveViewTabId(existing.id); return }
    const activeTab = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (activeTab && !activeTab.srcId && !activeTab.url) {
      setViewTabs(ts => ts.map(t => t.id === activeTab.id ? { id: t.id, url, title, srcId } : t))
      return
    }
    const tabId = uid()
    setViewTabs(ts => [...ts, { id: tabId, url, title, srcId }])
    setActiveViewTabId(tabId)
  }

  function closeViewTab(tabId: string) {
    const tabs = viewTabsRef.current
    const idx = tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    const closedTab = tabs[idx]
    const newTabs = tabs.filter(t => t.id !== tabId)
    setViewTabs(newTabs)
    if (activeViewTabIdRef.current === tabId) {
      const newActiveId = newTabs[Math.max(0, idx - 1)]?.id ?? null
      setActiveViewTabId(newActiveId)
      const newActiveTab = newTabs.find(t => t.id === newActiveId)
      if (closedTab.url && !newActiveTab?.url) {
        ;(window as any).electronAPI?.view?.clear?.('1')
      }
    }
  }

  function reorderViewTabs(fromId: string, toId: string) {
    setViewTabs(tabs => {
      const from = tabs.findIndex(t => t.id === fromId)
      const to   = tabs.findIndex(t => t.id === toId)
      if (from === -1 || to === -1 || from === to) return tabs
      const next = [...tabs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function switchViewTab(tabId: string) {
    const tabs = viewTabsRef.current
    const target = tabs.find(t => t.id === tabId)
    if (!target) return
    const current = tabs.find(t => t.id === activeViewTabIdRef.current)
    if (current?.url && !target.url) {
      ;(window as any).electronAPI?.view?.clear?.('1')
    }
    setActiveViewTabId(tabId)
  }

  return {
    viewTabs, activeViewTabId, activeViewTab,
    openInView, openUrlInView, closeViewTab, switchViewTab, reorderViewTabs,
    setViewTabs, setActiveViewTabId, viewTabsRef, activeViewTabIdRef,
  }
}
