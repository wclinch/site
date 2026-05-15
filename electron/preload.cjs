const { contextBridge, ipcRenderer } = require('electron')

// All research functions take `panelId` ('A' or 'B') as their first argument.
// Event subscriptions also take `panelId` and filter internally so each
// ResearchBrowser component only receives events for its own panel.
contextBridge.exposeInMainWorld('electronAPI', {
  research: {
    navigate:  (pid, url)  => ipcRenderer.send('research:navigate',   pid, url),
    setBounds: (pid, rect) => ipcRenderer.send('research:set-bounds', pid, rect),
    goBack:    (pid)       => ipcRenderer.send('research:go-back',    pid),
    goForward: (pid)       => ipcRenderer.send('research:go-forward', pid),
    reload:    (pid)       => ipcRenderer.send('research:reload',     pid),
    newTab:    (pid, url)  => ipcRenderer.send('research:new-tab',    pid, url),
    closeTab:  (pid, id)   => ipcRenderer.send('research:close-tab',  pid, id),
    switchTab: (pid, id)   => ipcRenderer.send('research:switch-tab', pid, id),
    getState:  (pid)       => ipcRenderer.invoke('research:get-state', pid),
    getTabs:   (pid)       => ipcRenderer.invoke('research:get-tabs',  pid),

    onUrlChanged: (pid, cb) => {
      const fn = (_e, p, url, back, fwd) => { if (p === pid) cb(url, back, fwd) }
      ipcRenderer.on('research:url-changed', fn)
      return () => ipcRenderer.removeListener('research:url-changed', fn)
    },
    onTitleChanged: (pid, cb) => {
      const fn = (_e, p, title) => { if (p === pid) cb(title) }
      ipcRenderer.on('research:title-changed', fn)
      return () => ipcRenderer.removeListener('research:title-changed', fn)
    },
    onLoadingChanged: (pid, cb) => {
      const fn = (_e, p, loading) => { if (p === pid) cb(loading) }
      ipcRenderer.on('research:loading-changed', fn)
      return () => ipcRenderer.removeListener('research:loading-changed', fn)
    },
    onCanNavigate: (pid, cb) => {
      const fn = (_e, p, back, fwd) => { if (p === pid) cb(back, fwd) }
      ipcRenderer.on('research:can-navigate', fn)
      return () => ipcRenderer.removeListener('research:can-navigate', fn)
    },
    onTabUpdated: (pid, cb) => {
      const fn = (_e, p, id, state) => { if (p === pid) cb(id, state) }
      ipcRenderer.on('research:tab-updated', fn)
      return () => ipcRenderer.removeListener('research:tab-updated', fn)
    },
    onTabsChanged: (pid, cb) => {
      const fn = (_e, p, tabs, activeTabId) => { if (p === pid) cb(tabs, activeTabId) }
      ipcRenderer.on('research:tabs-changed', fn)
      return () => ipcRenderer.removeListener('research:tabs-changed', fn)
    },
    // Global — both panels recalc on fullscreen/minimize restore.
    onBoundsRecalc: (cb) => {
      const fn = () => cb()
      ipcRenderer.on('research:recalc-bounds', fn)
      return () => ipcRenderer.removeListener('research:recalc-bounds', fn)
    },
    loadWorkspace: (tabs) => ipcRenderer.send('research:load-workspace', tabs),
  },
})
