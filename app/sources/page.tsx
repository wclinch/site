import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

export default function Sources() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #1a1a1a' }}>
          Documents and Pages
        </span>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            Documents are files you add to the session. Pages are web pages you save. Web is where you browse.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Documents</span> — PDFs and images added to the session. Open them in View 1 or View 2 to hold them while you keep browsing.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Pages</span> — Web pages saved from Web. Click a page to open it in Web, or use 1 or 2 to open it in a view.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>View 1 / View 2</span> — Hold a document or page while you keep browsing. Each view is independent and restores on return.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Web</span> — Browse, search, navigate. Use 1 or 2 to send the current page to a view. Use Save to keep it in Pages.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Session</span> — Documents, Pages, Views, and Web tabs all come back when you return. Double-click a session tab to rename it.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
