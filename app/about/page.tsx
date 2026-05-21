import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }
const Label: React.CSSProperties = { fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '20px 0', borderBottom: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column' as const, gap: '10px' }

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e' }}>
          About Site
        </span>

        <div style={Section}>
          <p style={P}>
            Site keeps the materials for a task in one place — documents, saved pages, and web tools — so you can start working immediately and pick up exactly where you stopped.
          </p>
          <p style={P}>
            It is a desktop app for macOS.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Why Site exists</span>
          <p style={P}>
            Most focused work involves a cluster of things: a paper or brief to read, a handful of tabs open for reference, notes or pages saved along the way. Keeping that cluster together while you work isn't hard. Reassembling it the next day is.
          </p>
          <p style={P}>
            Site holds the cluster together for the duration of a task. Leave and come back — everything is where you left it.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Sessions</span>
          <p style={P}>
            A session is a named context. It holds the documents you've added, the pages you've saved, the web tabs you had open, and whichever documents you had pinned to the reader panes.
          </p>
          <p style={P}>
            Sessions restore fully when you return. Switch between sessions the same way — each one comes back intact.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Who it's for</span>
          <p style={P}>
            Site is useful for people whose work involves reading, referencing, and browsing at the same time. Researchers, writers, analysts, students — anyone who regularly opens the same cluster of files and tabs for a recurring task.
          </p>
          <p style={P}>
            It works best when you have distinct tasks you return to, each with its own materials.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>What Site is not</span>
          <p style={P}>
            Site is not a note-taking app, a document editor, or a permanent filing system. It doesn't organize your files — it holds them open while you work.
          </p>
          <p style={P}>
            It's also not a full browser replacement. The web panel is for browsing as part of a task, not for managing bookmarks or a browsing history across everything you do.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Storage</span>
          <p style={P}>
            <span style={{ color: '#999' }}>Free: 150 MB</span> for documents.{' '}
            <span style={{ color: '#999' }}>Pro: 5 GB.</span>{' '}
            Saved pages store metadata only (title, URL, timestamp) and do not count toward storage.
          </p>
          <p style={P}>
            <span style={{ color: '#999' }}>Site → Reset Site Data…</span> in the desktop menu clears all local state. This cannot be undone.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Support</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#999', textDecoration: 'underline', textDecorationColor: '#333', textUnderlineOffset: '3px' }}>
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
