import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.8, margin: 0 }
const Label: React.CSSProperties = { fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '24px 0', borderBottom: '1px solid rgba(230,226,216,0.1)', display: 'flex', flexDirection: 'column' as const, gap: '12px' }

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#070807' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '560px', width: '100%', margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase', paddingBottom: '16px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
          About Site
        </span>

        <div style={Section}>
          <p style={P}>
            Site is a macOS desktop application. It holds documents, browser tabs, and saved pages together in a named session. Sessions restore completely on open.
          </p>
          <p style={P}>
            macOS. Desktop only.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Why it exists</span>
          <p style={P}>
            Work on a task involves documents, open tabs, and accumulated references — simultaneously. Standard tools don't preserve that state across closes. Every restart means reconstruction.
          </p>
          <p style={P}>
            Site holds session state for the duration of a task. Close it, come back, and nothing has changed.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Sessions</span>
          <p style={P}>
            A session contains: documents attached to it, web tabs at their last URL, saved pages, and view state. All of it persists. Sessions are isolated — switching between them loses nothing in either.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Who it's for</span>
          <p style={P}>
            Researchers, analysts, and writers who return to the same task repeatedly. Anyone whose work requires holding documents and references open alongside an active browser.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>What it's not</span>
          <p style={P}>
            Not a note editor. Not a filing system. Not a browser replacement. Site holds materials open during work — it does not organize them.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Storage</span>
          <p style={P}>
            <span style={{ color: 'rgba(230,226,216,0.65)' }}>Free: 250 MB.</span>{' '}
            <span style={{ color: 'rgba(230,226,216,0.65)' }}>Pro: 2 GB.</span>{' '}
            Saved pages store title, URL, and timestamp only — they do not count toward storage.
          </p>
          <p style={P}>
            <span style={{ color: 'rgba(230,226,216,0.65)' }}>Site → Reset Site Data…</span> in the menu clears all local data. This cannot be undone.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Support</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: 'rgba(230,226,216,0.65)', textDecoration: 'underline', textDecorationColor: 'rgba(230,226,216,0.45)', textUnderlineOffset: '3px' }}>
              Official_Site_Support@protonmail.com
            </a>
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
