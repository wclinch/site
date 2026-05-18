import Nav from '@/components/Nav'

const SECTION: React.CSSProperties = {
  padding: '20px 0',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const LABEL: React.CSSProperties = {
  fontSize: '11px',
  color: '#555',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const BODY: React.CSSProperties = {
  fontSize: '14px',
  color: '#666',
  lineHeight: 1.75,
  margin: 0,
}

const NOTE: React.CSSProperties = {
  fontSize: '12px',
  color: '#444',
  lineHeight: 1.75,
  margin: 0,
}

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#080808' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        {/* Welcome */}
        <div style={{ ...SECTION, gap: '0', paddingBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#bbb', lineHeight: 1.3, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Keep your documents, saved pages, and Web tabs together.
          </h1>
          <p style={{ ...BODY, color: '#666', marginBottom: '24px' }}>
            Come back where you left off.
          </p>
          <a href="/app" style={{ alignSelf: 'flex-start', fontSize: '13px', color: '#aaa', textDecoration: 'none', letterSpacing: '0.04em' }}>Open Site →</a>
        </div>

        {/* Install */}
        <div style={SECTION}>
          <span style={LABEL}>Install</span>
          <p style={BODY}>
            Drag <span style={{ color: '#888' }}>Site.app</span> to your Applications folder, then double-click to open.
          </p>
          <p style={BODY}>
            macOS will block Site on first launch because it is not notarized. The included <span style={{ color: '#777' }}>Read me first.txt</span> has two ways to clear it — takes under a minute.
          </p>
          <p style={NOTE}>After the first launch, macOS remembers Site and will not prompt again.</p>
        </div>

        {/* How it works */}
        <div style={SECTION}>
          <span style={LABEL}>How it works</span>
          {([
            ['Web',       'Browse, search, and navigate. Send any page to View or save it to Pages without losing your place.'],
            ['Documents', 'Add PDFs and images. Hold them in View while you keep browsing in Web.'],
            ['Pages',     'Save Web pages to the workspace. Pages are unlimited and do not count toward storage.'],
            ['Workspace', 'Everything in a workspace — Documents, Pages, Views, and Web tabs — comes back when you return.'],
          ] as const).map(([label, body]) => (
            <p key={label} style={BODY}>
              <span style={{ color: '#888' }}>{label}</span> — {body}
            </p>
          ))}
        </div>

        {/* Free */}
        <div style={SECTION}>
          <span style={LABEL}>Free</span>
          <p style={BODY}>Start with one workspace. No account required.</p>
          {(['1 workspace', '10 Documents', '150 MB Documents', 'Unlimited Pages'] as const).map(f => (
            <p key={f} style={NOTE}>{f}</p>
          ))}
        </div>

        {/* Pro */}
        <div style={SECTION}>
          <span style={LABEL}>Pro</span>
          <p style={BODY}>Unlimited workspaces and more Documents. $8.99 / month.</p>
          {(['Unlimited workspaces', 'Unlimited Documents', '5 GB Documents', 'Unlimited Pages'] as const).map(f => (
            <p key={f} style={NOTE}>{f}</p>
          ))}
        </div>

        {/* Support */}
        <div style={SECTION}>
          <span style={LABEL}>Support</span>
          <p style={BODY}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#777', textDecoration: 'none' }}>
              Official_Site_Support@protonmail.com
            </a>
          </p>
        </div>

      </main>
    </div>
  )
}
