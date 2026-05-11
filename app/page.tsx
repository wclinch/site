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
            Read sources.<br />Write beside them.
          </h1>

          <p style={{ fontSize: '15px', color: '#777', lineHeight: 1.8, margin: '0 0 40px', maxWidth: '480px' }}>
            Load PDFs, images, and web pages on the left. Write your draft on the right. Everything in one window — no switching tabs, no losing your place.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <a href="/app" className="cta-link">Open App →</a>
            <span style={{ fontSize: '12px', color: '#555', letterSpacing: '0.02em' }}>
              Runs locally. No account.
            </span>
          </div>
        </section>

        {/* How it works */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '40px' }}>
            How it works
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {([
              ['Add references', 'Drop PDFs or images, or paste a URL from the left panel. Organize them into projects or keep them floating.'],
              ['Pin a working stack', 'Drag the sources you\'re actively pulling from into the Stack at the bottom-left. Click any item to hot-swap it into the viewer — images go up top, PDFs and URLs to the bottom pane by default. Click a row\'s arrow to flip a PDF or URL up into the image pane instead.'],
              ['Open in split view', 'Drag a source into the center panel to view it. Hit the expand icon to fullscreen. Multiple references open at once.'],
              ['Write', 'Your draft lives on the right, tied to the current project. Write directly as you reference. Saves to your machine as you type.'],
              ['Export', 'Use the draft menu to save as .txt or .md when you\'re done.'],
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

        {/* Storage */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', marginBottom: '32px' }}>
            Yours, on your machine
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '20px', color: '#bbb', fontWeight: 500, marginBottom: '6px', letterSpacing: '-0.01em' }}>250&nbsp;MB</div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>
                Local storage for your files. No subscription, no renewal — it&apos;s yours as long as the app is installed.
              </div>
            </div>
            <div>
              <div style={{ fontSize: '20px', color: '#bbb', fontWeight: 500, marginBottom: '6px', letterSpacing: '-0.01em' }}>Reset anytime</div>
              <div style={{ fontSize: '13px', color: '#777', lineHeight: 1.7 }}>
                A built-in &ldquo;reset all data&rdquo; wipes every file and source on your machine. Draft text is kept in case the click was accidental.
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section style={{ borderTop: '1px solid #111', maxWidth: '620px', width: '100%', margin: '0 auto', padding: '64px 24px' }}>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.75, margin: '0 0 28px' }}>
            Files, projects, and drafts stay on your machine. No server, no account, no sync — just a workspace that opens when you need it.
          </p>
          <a href="/app" className="text-cta">Open App →</a>
        </section>

      </main>

      <footer style={{ borderTop: '1px solid #111', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '620px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.08em' }}>
          Runs locally on your machine · 250MB limit · 3 projects max
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
