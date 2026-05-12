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
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>System</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            A local-first workspace for reading sources and writing beside them. PDFs, images, and web pages coexist with the project's writing surface in a single window. Files, projects, and text remain on the device.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Operation</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>1. Sources</span> — Drop PDFs or images, or paste a URL. Sources are floating until placed in a project.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>2. Projects</span> — Unlimited. Drag sources between projects, or drag a folder header to reorder. Each project holds up to twelve sources.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>3. Viewer</span> — Split surface. Images above, PDFs and URLs below. Either pane fullscreens.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>4. Stack</span> — A pinned working set at the base of the sidebar. Click a source to load it; click the row arrow to flip a PDF or URL to the image pane.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>5. Work</span> — Each project has its own writing surface. Saves as you type. Switching projects loads that project's saved work.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>6. Export</span> — Plain text or Markdown.
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Interactions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { keys: ['Drop file'],             desc: 'Add a PDF or image source' },
              { keys: ['Add URL'],               desc: 'Add a web page as a source' },
              { keys: ['New project'],           desc: 'Name and enter to create' },
              { keys: ['Right-click project'],   desc: 'Rename or delete' },
              { keys: ['Drag folder header'],    desc: 'Reorder projects' },
              { keys: ['Drag source → folder'],  desc: 'Move into a project' },
              { keys: ['Right-click source'],    desc: 'Rename, move, pin, or remove' },
              { keys: ['Drag image'],            desc: 'Load into the top pane' },
              { keys: ['Drag PDF / URL'],        desc: 'Load into the bottom pane' },
              { keys: ['Drag source → Stack'],   desc: 'Pin to the working set (up to 12)' },
              { keys: ['Click stack item'],      desc: 'Load (image → top, PDF/URL → bottom)' },
              { keys: ['Click stack arrow'],     desc: 'Flip a PDF or URL row to the image pane' },
              { keys: ['Drag stack item'],       desc: 'Reorder within the stack' },
              { keys: ['× on stack row'],        desc: 'Unpin and close from the viewer' },
              { keys: ['Expand (↗)'],           desc: 'Fullscreen the pane' },
              { keys: ['X'],                     desc: 'Close from the viewer' },
              { keys: ['··· (work)'],            desc: 'Export or clear the work' },
              { keys: ['Storage badge'],         desc: 'Usage and source reset (work preserved)' },
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
            Three columns. <span style={{ color: '#999' }}>Sidebar</span>: sources, projects, stack. <span style={{ color: '#999' }}>Center</span>: split viewer — references above and below. <span style={{ color: '#999' }}>Right</span>: the active project's work.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Source types</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>PDF</span> — selectable text. Scanned documents render as image-only.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>Image</span> — PNG, JPG, WEBP, GIF. Loads into the top pane.
            </p>
            <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
              <span style={{ color: '#999' }}>URL</span> — embedded page in the bottom pane. Sites that refuse embedding surface an open-in-browser link.
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Storage</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            <span style={{ color: '#999' }}>250&nbsp;MB</span> local. Unlimited projects, twelve sources each. Files in IndexedDB; project structure, work, and the stack in localStorage. Nothing leaves the device.
          </p>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
            The storage indicator in the top bar clears sources and files. <span style={{ color: '#999' }}>Work is preserved.</span> The action is local and cannot be reversed.
          </p>
        </div>

        <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Support</span>
          <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }}>
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
