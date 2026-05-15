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

          <h1 style={{ fontSize: '32px', fontWeight: 500, color: '#bbb', lineHeight: 1.25, margin: '0 0 20px', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            Files and the live web. One window.
          </h1>

          <p style={{ fontSize: '15px', color: '#777', lineHeight: 1.8, margin: '0 0 40px', maxWidth: '480px' }}>
            Open files alongside a live browser. Save pages, read documents, and return to exactly where you left off.
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
              ['Stack',    'The left column. Sources (files) on the top half, Sites (saved pages) on the bottom.'],
              ['Source',   'The center column. Two stacked panels — Source 1 and Source 2. Each opens a file from the Stack independently.'],
              ['Research', 'The right column. A live browser with a URL bar. Save the current page to Sites.'],
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
                Uploaded Sources in IndexedDB. Saved Sites store metadata only and do not count toward storage.
              </div>
            </div>
            <div>
              <div style={{ fontSize: '20px', color: '#bbb', fontWeight: 500, marginBottom: '6px', letterSpacing: '-0.01em' }}>Resume in place</div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>
                Quit and reopen. The Stack, open files, and Research URL all restore automatically.
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.75, margin: '0 0 28px' }}>
            Files, saved pages, and your place in Research stay on the device. No server. No account. No sync.
          </p>
          <a href="/app" className="text-cta">Open App →</a>
        </section>

      </main>

      <footer style={{ borderTop: '1px solid #111', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '620px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.08em' }}>
          Beta · 250&nbsp;MB Sources
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
