import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: '#999', lineHeight: 1.8, margin: 0 }
const Label: React.CSSProperties = { fontSize: '10px', color: '#777', letterSpacing: '0.12em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '24px 0', borderBottom: '1px solid #232523', display: 'flex', flexDirection: 'column' as const, gap: '12px' }

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#080808' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '560px', width: '100%', margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '10px', color: '#777', letterSpacing: '0.12em', textTransform: 'uppercase', paddingBottom: '16px', borderBottom: '1px solid #232523' }}>
          About Site
        </span>

        <div style={Section}>
          <p style={P}>
            Site holds the materials for a task in one session — documents, saved pages, and the live web — so you can pick up exactly where you stopped.
          </p>
          <p style={P}>
            A desktop app for macOS.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Why Site exists</span>
          <p style={P}>
            Focused work involves a cluster of things: a paper to read, a handful of tabs open for reference, pages saved along the way. Keeping that cluster together while you work is easy. Reassembling it the next day is not.
          </p>
          <p style={P}>
            Site holds it together for the duration of a task. Leave and come back — everything is where you left it.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Sessions</span>
          <p style={P}>
            A session is a named context. It holds the documents you've added, the pages you've saved, the web tabs you had open, and what was pinned to each view.
          </p>
          <p style={P}>
            Sessions restore fully when you return. Switch between them the same way — each one comes back intact.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Who it's for</span>
          <p style={P}>
            People whose work involves reading, referencing, and the web at the same time. Researchers, writers, analysts, students — anyone who returns to the same cluster of files and pages for a recurring task.
          </p>
          <p style={P}>
            It works best when you have distinct tasks you return to, each with its own materials.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>What Site is not</span>
          <p style={P}>
            Not a note-taking app, a document editor, or a permanent filing system. Site holds materials open while you work — it doesn't organize them for you.
          </p>
          <p style={P}>
            Not a replacement for your daily browser. The web pane is for browsing as part of a task, not for managing bookmarks or history across everything you do.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Storage</span>
          <p style={P}>
            <span style={{ color: '#bbb' }}>Free: 150 MB</span> for documents.{' '}
            <span style={{ color: '#bbb' }}>Pro: 5 GB.</span>{' '}
            Saved pages store metadata only (title, URL, timestamp) and do not count toward storage.
          </p>
          <p style={P}>
            <span style={{ color: '#bbb' }}>Site → Reset Site Data…</span> in the desktop menu clears all local state. This cannot be undone.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Support</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20support" style={{ color: '#aaa', textDecoration: 'underline', textDecorationColor: '#444', textUnderlineOffset: '3px' }}>
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
