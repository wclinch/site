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
            Site keeps your research workspace together. Come back where you left off.
          </p>
          <a href="/app" className="cta-link" style={{ alignSelf: 'flex-start' }}>Open Site</a>
        </div>

        {/* Open */}
        <div style={SECTION}>
          <span style={LABEL}>Open</span>
          <p style={BODY}>
            Drag <span style={{ color: '#888' }}>Site.app</span> into your Applications folder. Then double-click to open.
          </p>
          <p style={BODY}>
            macOS will block the app once because Site is not notarized. See <span style={{ color: '#777' }}>Read me first.txt</span> in the download for instructions to get past the prompt.
          </p>
          <p style={NOTE}>After first launch macOS remembers Site. You will not see the prompt again.</p>
        </div>

        {/* Unlock */}
        <div style={SECTION}>
          <span style={LABEL}>Unlock</span>
          <p style={BODY}>Enter the license key from your purchase when Site asks for it.</p>
          <p style={NOTE}>One-time beta access. No subscription.</p>
        </div>

        {/* How Site works */}
        <div style={SECTION}>
          <span style={LABEL}>How Site works</span>
          {([
            ['Research',  'Search the web and open tools in Research tabs on the right. Save any page to Sites.'],
            ['Sources',   'Add PDFs and files to Sources. Open them in Source 1 and Source 2 in the center.'],
            ['Workspace', 'Sources, Sites, and Research tabs restore with each workspace. Come back later and everything is still there.'],
            ['Save As',   'Name a workspace to save it. Switch between workspaces at the top.'],
          ] as const).map(([label, body]) => (
            <p key={label} style={BODY}>
              <span style={{ color: '#888' }}>{label}</span> — {body}
            </p>
          ))}
        </div>

        {/* Storage */}
        <div style={SECTION}>
          <span style={LABEL}>Storage</span>
          <p style={BODY}>250 MB for uploaded Sources. Saved Sites do not count toward storage.</p>
          <p style={BODY}><span style={{ color: '#888' }}>Site → Reset Site Data…</span> clears all local data. Cannot be reversed.</p>
        </div>

        {/* Beta */}
        <div style={SECTION}>
          <span style={LABEL}>Beta</span>
          <p style={BODY}>Site is in beta. Expect rough edges. Your feedback helps shape the product.</p>
        </div>

        {/* Support */}
        <div style={SECTION}>
          <span style={LABEL}>Support</span>
          <p style={BODY}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#777', textDecoration: 'underline', textDecorationColor: '#2a2a2a', textUnderlineOffset: '3px' }}>
              Official_Site_Support@protonmail.com
            </a>
          </p>
        </div>

      </main>

      <footer style={{ padding: '20px', maxWidth: '580px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.08em' }}>Site Beta</span>
      </footer>
    </div>
  )
}
