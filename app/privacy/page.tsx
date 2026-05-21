import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: '#777', lineHeight: 1.75, margin: 0 }
const Label: React.CSSProperties = { fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '20px 0', borderBottom: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column' as const, gap: '8px' }

export default function Privacy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '580px', width: '100%', margin: '0 auto', padding: '56px 20px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e' }}>
          Privacy
        </span>

        <div style={Section}>
          <span style={Label}>Overview</span>
          <p style={P}>
            Site stores what is needed to provide the product. Documents are kept on your device. Session data is stored locally. We do not sell user data, and we do not share personal information with third parties except as described below.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Account information</span>
          <p style={P}>
            If you create an account, we store your email address to associate your subscription with your access. This is used only for authentication and subscription management.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Documents and uploaded files</span>
          <p style={P}>
            PDFs and images you add are stored locally on your device using IndexedDB. They are not uploaded to or stored on our servers. They count toward your storage limit and remain on your device until you remove them.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Saved pages and session data</span>
          <p style={P}>
            Saved pages store metadata only — title, URL, hostname, and timestamp — locally on your device. Full page content is not stored. Session state (open tabs, document selections, reader positions) is also stored locally and is not transmitted.
          </p>
          <p style={P}>
            The web panel uses standard browser session and cookie storage so websites can keep you logged in. Site does not read, store, or transmit those credentials.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Payments</span>
          <p style={P}>
            Subscription payments are processed by Polar. Site does not handle or store payment card information directly. When your subscription status is checked, Site contacts Polar to verify access. No other data is shared during that process.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Diagnostics and analytics</span>
          <p style={P}>
            Site does not include third-party analytics. Crash reports or diagnostic data, if collected, are used only to identify and fix problems in the app and are not linked to your documents or browsing activity.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Your data and deletion</span>
          <p style={P}>
            Documents and saved pages can be removed individually from within the app. To remove all local data at once, use <span style={{ color: '#999' }}>Site → Reset Site Data…</span> in the desktop menu. This clears all local files and state and cannot be undone.
          </p>
          <p style={P}>
            To close your account or request deletion of any account-level data, contact us at the address below.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Changes</span>
          <p style={P}>
            This policy may be updated as the product changes. Material changes will be noted in release notes. Continued use of Site after a change means you accept the updated terms.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Contact</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20privacy" style={{ color: '#999', textDecoration: 'underline', textDecorationColor: '#333', textUnderlineOffset: '3px' }}>
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
