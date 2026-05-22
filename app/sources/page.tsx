import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

export default function Sources() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#5E5A54', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #252725' }}>
          Documents and Pages
        </span>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #252725', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '14px', color: '#8C887F', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Documents</span> — PDFs and images. Open in View 1 or View 2 to hold them while you browse.
          </p>
          <p style={{ fontSize: '14px', color: '#8C887F', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Pages</span> — Web pages saved to the session. Click to reopen in Web, or use 1 / 2 to open in a view.
          </p>
          <p style={{ fontSize: '14px', color: '#8C887F', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>View</span> — A reading pane that stays open. Use 1 or 2 to hold a document or page alongside everything else.
          </p>
          <p style={{ fontSize: '14px', color: '#8C887F', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Web</span> — Browse with tabs. Press 1 or 2 to send the current page to a view. Press Save to add it to Pages.
          </p>
          <p style={{ fontSize: '14px', color: '#8C887F', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#E6E2D8' }}>Session</span> — Everything comes back when you return. Double-click a session tab to rename it.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
