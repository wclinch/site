import Image from 'next/image'
import Nav from '@/components/Nav'

// ─── Section icons ────────────────────────────────────────────────────────────

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5E5A54" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h7l3 3v11H4V2z" /><path d="M11 2v4h3" />
      <line x1="6" y1="8" x2="12" y2="8" /><line x1="6" y1="11" x2="12" y2="11" /><line x1="6" y1="14" x2="9" y2="14" />
    </svg>
  )
}

function IconView() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5E5A54" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1" />
      <line x1="5" y1="8" x2="13" y2="8" /><line x1="5" y1="11" x2="10" y2="11" />
    </svg>
  )
}

function IconWeb() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5E5A54" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" />
      <path d="M9 2c-2 2-3 4-3 7s1 5 3 7M9 2c2 2 3 4 3 7s-1 5-3 7" />
      <line x1="2" y1="9" x2="16" y2="9" />
    </svg>
  )
}

function IconResume() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5E5A54" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6l4 2" /><circle cx="9" cy="9" r="7" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div style={{ background: '#070807', minHeight: '100vh', color: '#8C887F' }}>
      <Nav />

      {/* ── Hero ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="land-section" style={{ paddingTop: '110px', paddingBottom: '80px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 400,
            color: '#E6E2D8',
            lineHeight: 1.15,
            margin: '0 0 22px',
            letterSpacing: '-0.025em',
            maxWidth: '700px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Keep documents, pages, and the web in one session.
          </h1>

          <p style={{
            fontSize: '15px',
            color: '#5E5A54',
            lineHeight: 1.75,
            margin: '0 auto 44px',
            maxWidth: '460px',
            letterSpacing: '0.01em',
          }}>
            Leave and come back. Everything is exactly where you left it.
          </p>

          <a href="/app" className="hero-cta">Open Site →</a>
        </div>

        {/* Screenshot */}
        <div className="land-section" style={{ paddingBottom: '100px' }}>
          <div style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #252725',
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
          A task lives across a dozen tabs, a PDF somewhere else, notes in a third app.
          Every time you come back, you start over.
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
              Add PDFs and images to a session. They stay open in View while you keep browsing.
            </p>
          </div>

          <div className="feature-card">
            <IconView />
            <div className="feature-title">View</div>
            <p className="feature-body">
              A reading pane that stays open. Hold any document or page while you work elsewhere.
            </p>
          </div>

          <div className="feature-card">
            <IconWeb />
            <div className="feature-title">Web</div>
            <p className="feature-body">
              Browse with tabs. Save any page to the session or send it to View without interrupting your flow.
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
              Leave. Come back.<br />Pick up exactly where you left off.
            </h2>
          </div>
          <div style={{ flex: 1, minWidth: '260px', paddingTop: '52px' }}>
            <p className="resume-sub">
              Everything in a session — documents, saved pages, views, web tabs — saves automatically.
              Switch sessions without losing anything.
            </p>
            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'Web tabs reopen where you left them',
                'Documents stay loaded',
                'Saved pages persist across sessions',
                'Multiple sessions, each fully separate',
              ].map(line => (
                <div key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#5E5A54', marginTop: '2px' }}>—</span>
                  <span style={{ fontSize: '13px', color: '#5E5A54', letterSpacing: '0.01em', lineHeight: 1.5 }}>{line}</span>
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
            <div className="pricing-price-sub">No sign-in required</div>
            <div style={{ height: '32px' }} />
            {[
              '1 session',
              'Up to 10 documents',
              '150 MB storage',
              'Unlimited saved pages',
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
            <div className="pricing-price">$8.99</div>
            <div className="pricing-price-sub">per month</div>
            <div style={{ height: '32px' }} />
            {[
              'Unlimited sessions',
              'Unlimited documents',
              '5 GB storage',
              'Unlimited saved pages',
            ].map(f => (
              <div key={f} className="pricing-feature">{f}</div>
            ))}
            <a href="/app" className="pricing-cta">Upgrade to Pro →</a>
          </div>

        </div>
      </div>

      <div className="land-divider" />

      {/* ── Footer ── */}
      <footer style={{ padding: '0 20px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #252725' }}>
        <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Site</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ width: '1px', height: '14px', background: '#252725', marginRight: '2px', flexShrink: 0 }} />
          <a href="/about"   className="footer-link">About</a>
          <span style={{ color: '#252725', fontSize: '14px', lineHeight: 1, userSelect: 'none' }}>·</span>
          <a href="/privacy" className="footer-link">Privacy</a>
          <span style={{ color: '#252725', fontSize: '14px', lineHeight: 1, userSelect: 'none' }}>·</span>
          <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" className="footer-link">Support</a>
        </div>
      </footer>
    </div>
  )
}
