const { contextBridge, ipcRenderer } = require('electron')

// Expose research-browser IPC to the renderer under window.electronAPI.research.
// Each onXxx registration returns a cleanup function so callers can remove
// the listener in a useEffect cleanup (avoids duplicate listeners on re-mount).
contextBridge.exposeInMainWorld('electronAPI', {
  research: {
    navigate:  (url)  => ipcRenderer.send('research:navigate',   url),
    setBounds: (rect) => ipcRenderer.send('research:set-bounds', rect),
    goBack:    ()     => ipcRenderer.send('research:go-back'),
    goForward: ()     => ipcRenderer.send('research:go-forward'),
    reload:    ()     => ipcRenderer.send('research:reload'),
    getState:  ()     => ipcRenderer.invoke('research:get-state'),

    onUrlChanged: (cb) => {
      const fn = (_e, url, back, fwd) => cb(url, back, fwd)
      ipcRenderer.on('research:url-changed', fn)
      return () => ipcRenderer.removeListener('research:url-changed', fn)
    },
    onTitleChanged: (cb) => {
      const fn = (_e, title) => cb(title)
      ipcRenderer.on('research:title-changed', fn)
      return () => ipcRenderer.removeListener('research:title-changed', fn)
    },
    onLoadingChanged: (cb) => {
      const fn = (_e, loading) => cb(loading)
      ipcRenderer.on('research:loading-changed', fn)
      return () => ipcRenderer.removeListener('research:loading-changed', fn)
    },
    onCanNavigate: (cb) => {
      const fn = (_e, back, fwd) => cb(back, fwd)
      ipcRenderer.on('research:can-navigate', fn)
      return () => ipcRenderer.removeListener('research:can-navigate', fn)
    },
    onBoundsRecalc: (cb) => {
      const fn = () => cb()
      ipcRenderer.on('research:recalc-bounds', fn)
      return () => ipcRenderer.removeListener('research:recalc-bounds', fn)
    },
  },
})
