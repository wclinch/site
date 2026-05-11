import Nav from '@/components/Nav'

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#080808' }}>
      <Nav />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Hero */}
        <section style={{ maxWidth: '620px', width: '100%', margin: '0 auto', padding: '96px 24px 80px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '32px' }}>
            Site
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 500, color: '#bbb', lineHeight: 1.25, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
            Structured for thought.
          </h1>

          <p style={{ fontSize: '15px', color: '#777', lineHeight: 1.8, margin: '0 0 40px', maxWidth: '480px' }}>
            A source-native workspace for reading and writing. PDFs, images, and web pages on one side. Draft on the other. One window, on the device.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <a href="/app" className="cta-link">Open App →</a>
            <span style={{ fontSize: '12px', color: '#555', letterSpacing: '0.02em' }}>
              Local-first. No account.
            </span>
          </div>
        </section>

        {/* Architecture */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '40px' }}>
            Architecture
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {([
              ['Sources', 'PDFs, images, and web pages. Drop into the sidebar or paste a URL. Floating by default; organized into projects on demand.'],
              ['Stack',   'A pinned working set at the base of the sidebar. Click any source to load it into the viewer. The pane arrow flips a PDF or URL to the image pane when needed.'],
              ['Viewer',  'A split surface. Images above. PDFs and URLs below. Either pane fullscreens.'],
              ['Draft',   'Tied to the active project. Saves to local storage as you type.'],
              ['Export',  'Plain text or Markdown. From the draft menu.'],
            ] as const).map(([title, body]) => (
              <div key={title} style={{ display: 'flex', gap: '24px' }}>
                <div style={{ width: '4px', flexShrink: 0, background: '#1a1a1a', borderRadius: '2px', alignSelf: 'stretch' }} />
                <div>
                  <div style={{ fontSize: '13px', color: '#aaa', fontWeight: 500, marginBottom: '6px' }}>{title}</div>
                  <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* On the device */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '32px' }}>
            On the device
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '20px', color: '#bbb', fontWeight: 500, marginBottom: '6px', letterSpacing: '-0.01em' }}>250&nbsp;MB</div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>
                Local storage. Files in IndexedDB; structure and drafts in localStorage. Nothing transmitted.
              </div>
            </div>
            <div>
              <div style={{ fontSize: '20px', color: '#bbb', fontWeight: 500, marginBottom: '6px', letterSpacing: '-0.01em' }}>Reset, contained</div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>
                The storage indicator clears sources and files. Draft text is preserved.
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.75, margin: '0 0 28px' }}>
            Files, projects, and drafts remain on the device. No server. No account. No sync.
          </p>
          <a href="/app" className="text-cta">Open App →</a>
        </section>

      </main>

      <footer style={{ borderTop: '1px solid #111', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '620px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.08em' }}>
          Local · 250&nbsp;MB · 3 projects
        </span>
        <div style={{ display: 'flex', gap: '20px' }}>
          <a href="/about"   className="footer-link">About</a>
          <a href="/privacy" className="footer-link">Privacy</a>
          <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" className="footer-link">Support</a>
        </div>
      </footer>
    </div>
  )
}
