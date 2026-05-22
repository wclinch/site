import Image from 'next/image'
import Nav from '@/components/Nav'

// ─── Section icons ────────────────────────────────────────────────────────────

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#3a3a3a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h7l3 3v11H4V2z" /><path d="M11 2v4h3" />
      <line x1="6" y1="8" x2="12" y2="8" /><line x1="6" y1="11" x2="12" y2="11" /><line x1="6" y1="14" x2="9" y2="14" />
    </svg>
  )
}

function IconView() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#3a3a3a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1" />
      <line x1="5" y1="8" x2="13" y2="8" /><line x1="5" y1="11" x2="10" y2="11" />
    </svg>
  )
}

function IconWeb() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#3a3a3a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" />
      <path d="M9 2c-2 2-3 4-3 7s1 5 3 7M9 2c2 2 3 4 3 7s-1 5-3 7" />
      <line x1="2" y1="9" x2="16" y2="9" />
    </svg>
  )
}

function IconResume() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#3a3a3a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6l4 2" /><circle cx="9" cy="9" r="7" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div style={{ background: '#060606', minHeight: '100vh', color: '#777' }}>
      <Nav />

      {/* ── Hero ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="land-section" style={{ paddingTop: '110px', paddingBottom: '80px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 400,
            color: '#aaaaaa',
            lineHeight: 1.15,
            margin: '0 0 22px',
            letterSpacing: '-0.025em',
            maxWidth: '700px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Sessions for focused work.
          </h1>

          <p style={{
            fontSize: '15px',
            color: '#666',
            lineHeight: 1.75,
            margin: '0 auto 44px',
            maxWidth: '460px',
            letterSpacing: '0.01em',
          }}>
            Documents, saved pages, and the live web — held together in a session.
            Leave and come back to the same setup.
          </p>

          <a href="/app" className="hero-cta">Open Site →</a>
        </div>

        {/* Screenshot */}
        <div className="land-section" style={{ paddingBottom: '100px' }}>
          <div style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #232523',
            boxShadow: '0 60px 160px rgba(0,0,0,0.7)',
          }}>
            <Image src="/image.png" alt="Site app" width={1600} height={1000} style={{ width: '100%', height: 'auto', display: 'block' }} priority />
          </div>
        </div>
      </div>

      <div className="land-divider" />

      {/* ── Problem ── */}
      <div className="land-section" style={{ paddingTop: '100px', paddingBottom: '100px' }}>
        <div className="section-label" style={{ marginBottom: '32px' }}>The problem</div>
        <p className="problem-text">
          A task lives in a dozen open tabs. The PDF is somewhere else.
          Notes in a third app. Every restart begins by hunting things down.
        </p>
      </div>

      <div className="land-divider" />

      {/* ── How it works ── */}
      <div className="land-section" style={{ paddingTop: '100px', paddingBottom: '100px' }}>
        <div className="section-label" style={{ marginBottom: '48px' }}>How it works</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

          <div className="feature-card">
            <IconDoc />
            <div className="feature-title">Documents</div>
            <p className="feature-body">
              PDFs and images. Hold them open in View while you keep browsing.
              They stay with the session.
            </p>
          </div>

          <div className="feature-card">
            <IconView />
            <div className="feature-title">View</div>
            <p className="feature-body">
              A focused reading pane. Open any document or page without losing
              the rest of your setup.
            </p>
          </div>

          <div className="feature-card">
            <IconWeb />
            <div className="feature-title">Web</div>
            <p className="feature-body">
              The live web, with tabs. Send any page to View or save it for later,
              without leaving the session.
            </p>
          </div>

        </div>
      </div>

      <div className="land-divider" />

      {/* ── Resume ── */}
      <div className="land-section" style={{ paddingTop: '100px', paddingBottom: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '80px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div className="section-label" style={{ marginBottom: '32px' }}>Sessions</div>
            <h2 className="resume-headline">
              Leave. Come back.<br />Pick up exactly where you stopped.
            </h2>
          </div>
          <div style={{ flex: 1, minWidth: '260px', paddingTop: '52px' }}>
            <p className="resume-sub">
              Documents, saved pages, views, and web tabs — saved automatically with
              the session. Switch between sessions without losing anything.
            </p>
            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'Tabs reopen where you left them',
                'Documents stay loaded',
                'Saved pages persist across sessions',
                'Each session is fully isolated',
              ].map(line => (
                <div key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#3a3a3a', marginTop: '2px' }}>—</span>
                  <span style={{ fontSize: '13px', color: '#545454', letterSpacing: '0.01em', lineHeight: 1.5 }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="land-divider" />

      {/* ── Pricing ── */}
      <div className="land-section" style={{ paddingTop: '100px', paddingBottom: '120px' }}>
        <div className="section-label" style={{ marginBottom: '48px' }}>Pricing</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'stretch' }}>

          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-name">Free</div>
            <div className="pricing-price">$0</div>
            <div className="pricing-price-sub">No account required</div>
            <div style={{ height: '32px' }} />
            {[
              '1 session',
              '10 Documents',
              '150 MB document storage',
              'Unlimited Pages',
            ].map(f => (
              <div key={f} className="pricing-feature">{f}</div>
            ))}
            <a href="/app" className="pricing-cta">Open Site →</a>
          </div>

          {/* Pro */}
          <div className="pricing-card pricing-card-pro">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="pricing-name">Pro</div>
            </div>
            <div className="pricing-price" style={{ color: '#666' }}>$8.99</div>
            <div className="pricing-price-sub">per month</div>
            <div style={{ height: '32px' }} />
            {[
              'Unlimited sessions',
              'Unlimited Documents',
              '5 GB document storage',
              'Unlimited Pages',
            ].map(f => (
              <div key={f} className="pricing-feature">{f}</div>
            ))}
            <a href="/app" className="pricing-cta">Upgrade to Pro →</a>
          </div>

        </div>
      </div>

      <div className="land-divider" />

      {/* ── Footer ── */}
      <footer style={{ padding: '32px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', maxWidth: '1080px', margin: '0 auto' }}>
        <span style={{ fontSize: '11px', color: '#222', letterSpacing: '0.06em' }}>Site</span>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="/about"   className="footer-link">About</a>
          <a href="/privacy" className="footer-link">Privacy</a>
          <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" className="footer-link">Support</a>
        </div>
      </footer>
    </div>
  )
}
