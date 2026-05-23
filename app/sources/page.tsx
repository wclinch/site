import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

export default function Sources() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: 'rgba(230,226,216,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
          Documents and Pages
        </span>

        <div style={{ padding: '20px 0', borderBottom: '1px solid rgba(230,226,216,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Documents</span> — PDFs and images saved to the session shelf.
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Pages</span> — Web pages saved to the session. Click to reopen in the browser.
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>View</span> — The center reading stack. Open sources into it as tabs.
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Web</span> — Built-in browser with tabs. Bookmark a page to save it to the session.
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Session</span> — Everything restores when you return. Double-click a session tab to rename it.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
