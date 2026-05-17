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
            Documents are uploaded files. Pages are saved web pages. Web is where you browse.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Documents</span> — Uploaded files: PDFs and images. They appear in the Documents panel on the left. Open them in View 1 or View 2 in the center.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Pages</span> — Web pages saved from the Web panel. They appear in the Pages section on the left. Pin them to View 1 or View 2, or open them in Web.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>View 1 / View 2</span> — The two panes in the center column. Each holds one Document or Page independently. Click a Document to open it in View 1, or toggle the arrow to prefer View 2.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Web</span> — Browser tabs on the right. Navigate URLs, search, and save pages to Pages using the Save button in the URL bar.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>Workspace</span> — Everything in a workspace auto-saves. Documents, Pages, open Views, and Web tabs all come back when you return. Double-click a workspace tab to rename it.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
