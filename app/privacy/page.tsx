import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

export default function Privacy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #1a1a1a' }}>
          Privacy
        </span>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>The short version</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            Your data never leaves your computer. Site runs locally — no account, no servers, no tracking. Everything you load and write is stored on your machine.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Where your work is stored</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            PDFs and images are stored in IndexedDB on your machine. Project names, draft text, source labels, and URL references live in <code style={{ color: '#999' }}>localStorage</code>. None of it is transmitted anywhere.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>What we collect</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            Nothing. No telemetry, no account, no servers to reach. The app has no network calls of its own — any traffic you see is the embedded web pages you chose to load.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Deleting your data</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            Remove individual sources and projects from inside the app — there&apos;s no other copy. To remove everything at once, click the storage indicator in the top bar (or use <span style={{ color: '#999' }}>Site → Reset Site Data…</span> on desktop) and confirm. The action runs locally; nothing is sent anywhere.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
