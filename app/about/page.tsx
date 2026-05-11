import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const mono: React.CSSProperties = {
  fontFamily: 'inherit',
  background: '#111',
  border: '1px solid #1a1a1a',
  borderRadius: '3px',
  padding: '1px 6px',
  fontSize: '12px',
  color: '#777',
  letterSpacing: '0.02em',
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span style={mono}>{children}</span>
}

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #1a1a1a' }}>
          About
        </span>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>What Site is</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            A minimal, local-first research workspace for reading and writing side-by-side. Load PDFs, images, and web pages. Organize them into projects or keep them floating. Write your draft beside them. Everything in one window, on your machine.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>How to use it</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>1. Add sources</span> — drop PDFs or images into the left panel, or paste a URL. New sources are floating by default.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>2. Organize with projects</span> — click <span style={{ color: '#999' }}>+ New project</span> in the left panel, type a name, and press Enter. Drag floating sources into a project folder, or right-click to move them. Up to 3 projects.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>3. Open in split view</span> — drag an image into the top viewer pane, drag a PDF or URL into the bottom pane. Hit the expand icon to fullscreen either one. Hit X to close it.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>4. Write</span> — type in the draft panel on the right. The draft is tied to the active project and saves as you type.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>5. Export</span> — use the <span style={{ color: '#999' }}>···</span> menu to save as <span style={{ color: '#999' }}>.txt</span> or <span style={{ color: '#999' }}>.md</span>.
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Interactions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { keys: ['Drop file'],             desc: 'Add to sources (PDF or image)' },
              { keys: ['Add URL'],               desc: 'Embed a web page as a reference' },
              { keys: ['New project'],           desc: 'Type a name and press Enter to create a project folder' },
              { keys: ['Right-click project'],   desc: 'Rename or delete the project' },
              { keys: ['Drag source → folder'],  desc: 'Move a floating source into a project' },
              { keys: ['Right-click source'],    desc: 'Rename, move to a project, or remove' },
              { keys: ['Drag image'],            desc: 'Drop into the top viewer pane' },
              { keys: ['Drag PDF / URL'],        desc: 'Drop into the bottom viewer pane' },
              { keys: ['Expand (↗)'],           desc: 'Fullscreen that pane in the center column' },
              { keys: ['X'],                     desc: 'Close source from viewer' },
              { keys: ['··· (draft)'],           desc: 'Export or clear the draft' },
              { keys: ['Storage badge'],         desc: 'Click to see current usage and reset all data' },
              { keys: ['Esc'],                   desc: 'Close menus' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, minWidth: '160px' }}>
                  {row.keys.map((k, j) => <Kbd key={j}>{k}</Kbd>)}
                </div>
                <span style={{ fontSize: '13px', color: '#777', lineHeight: 1.5 }}>{row.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Layout</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            Three columns. Left: source list and project folders. Center: split viewer (image top, PDF/URL bottom). Right: draft editor.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Reference types</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>PDF</span> — renders with selectable text. Scanned or image-only PDFs display but text won't be selectable.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>Image</span> — PNG, JPG, WEBP, GIF. Loads in the top viewer pane.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>URL</span> — embeds the page in the bottom viewer pane. Sites that block embedding show an open-in-browser link instead.
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Where your work lives</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            On your machine. Files sit in IndexedDB, project structure and drafts in localStorage — no cloud, no account, nothing leaves the device. Capped at 250&nbsp;MB and up to 3 projects.
          </p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'right' }}>
          <BackButton />
        </div>

      </main>
    </div>
  )
}
