// Captures the current Site app window as a base64 PNG.
// Uses Electron's webContents.capturePage() via IPC — no screen recording
// permission needed since we're rendering our own content.
// Returns null in non-Electron environments or if capture fails.
export async function captureWindow(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (window as any).electronAPI
  if (typeof api?.captureWindow !== 'function') return null
  try {
    return await api.captureWindow()
  } catch {
    return null
  }
}
