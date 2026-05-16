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
          <div style={{ fontSize: '11px', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>
            Site Beta
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#bbb', lineHeight: 1.3, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Welcome to Site
          </h1>
          <p style={{ ...BODY, color: '#666', marginBottom: '24px' }}>
            A persistent research workspace. Add sources, browse, and save pages — everything stays with your workspace when you come back.
          </p>
          <a href="/app" style={{ alignSelf: 'flex-start', fontSize: '13px', color: '#777', textDecoration: 'underline', textDecorationColor: '#333', textUnderlineOffset: '3px', letterSpacing: '0.04em' }}>Open Site →</a>
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

        {/* License */}
        <div style={SECTION}>
          <span style={LABEL}>License</span>
          <p style={BODY}>Paste your license key when Site prompts you on first open.</p>
          <p style={NOTE}>One-time purchase. No subscription.</p>
        </div>

        {/* How it works */}
        <div style={SECTION}>
          <span style={LABEL}>How it works</span>
          {([
            ['Research',  'Browser tabs on the right. Search the web, navigate URLs, and save any page to Sites.'],
            ['Sources',   'Add PDFs and images to Sources. Open them side by side in Source 1 and Source 2.'],
            ['Workspace', 'Everything in a workspace — sources, saved pages, open tabs — is restored when you return.'],
            ['Save As',   'Name and save the current workspace. Switch between workspaces from the top bar.'],
          ] as const).map(([label, body]) => (
            <p key={label} style={BODY}>
              <span style={{ color: '#888' }}>{label}</span> — {body}
            </p>
          ))}
        </div>

        {/* Storage */}
        <div style={SECTION}>
          <span style={LABEL}>Storage</span>
          <p style={BODY}>250 MB for uploaded Sources. Saved Sites store metadata only and do not count toward storage.</p>
          <p style={NOTE}><span style={{ color: '#555' }}>Site → Reset Site Data…</span> clears all local data. This cannot be undone.</p>
        </div>

        {/* Support */}
        <div style={SECTION}>
          <span style={LABEL}>Support</span>
          <p style={BODY}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#777', textDecoration: 'underline', textDecorationColor: '#2a2a2a', textUnderlineOffset: '3px' }}>
              Official_Site_Support@protonmail.com
            </a>
          </p>
          <p style={NOTE}>Site is in beta. Rough edges are expected — your feedback helps.</p>
        </div>

      </main>

      <footer style={{ padding: '20px', maxWidth: '580px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.08em' }}>Site Beta</span>
      </footer>
    </div>
  )
}
