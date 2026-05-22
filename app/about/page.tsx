import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: '#8C887F', lineHeight: 1.8, margin: 0 }
const Label: React.CSSProperties = { fontSize: '10px', color: '#8C887F', letterSpacing: '0.12em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '24px 0', borderBottom: '1px solid #252725', display: 'flex', flexDirection: 'column' as const, gap: '12px' }

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#070807' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '560px', width: '100%', margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '10px', color: '#8C887F', letterSpacing: '0.12em', textTransform: 'uppercase', paddingBottom: '16px', borderBottom: '1px solid #252725' }}>
          About Site
        </span>

        <div style={Section}>
          <p style={P}>
            Site keeps your documents, saved pages, and the web together in a session — so you can leave and come back without rebuilding your setup.
          </p>
          <p style={P}>
            macOS, desktop app.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Why it exists</span>
          <p style={P}>
            Focused work means juggling a document, open tabs, and pages saved along the way. Keeping that together while you work isn't the problem. Starting over the next day is.
          </p>
          <p style={P}>
            Site holds it together for the life of a task. Leave and come back — everything is where you left it.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Sessions</span>
          <p style={P}>
            A session holds the documents you've added, the pages you've saved, the web tabs you had open, and what was pinned to each view.
          </p>
          <p style={P}>
            Sessions restore fully when you return. Switch between them freely — each one comes back intact.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Who it's for</span>
          <p style={P}>
            Anyone whose work involves reading, referencing, and the web at the same time — especially if you return to the same task repeatedly. Researchers, writers, analysts, students.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>What it's not</span>
          <p style={P}>
            Not a note editor, a filing system, or a browser replacement. Site holds materials open while you work. It doesn't organize them.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Storage</span>
          <p style={P}>
            <span style={{ color: '#8C887F' }}>Free: 150 MB.</span>{' '}
            <span style={{ color: '#8C887F' }}>Pro: 5 GB.</span>{' '}
            Saved pages store title, URL, and timestamp only — they don't count toward storage.
          </p>
          <p style={P}>
            <span style={{ color: '#8C887F' }}>Site → Reset Site Data…</span> in the menu clears all local data. This cannot be undone.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Support</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#8C887F', textDecoration: 'underline', textDecorationColor: '#5E5A54', textUnderlineOffset: '3px' }}>
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
