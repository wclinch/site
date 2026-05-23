import Nav from '@/components/Nav'
import BackButton from '@/components/BackButton'

const P: React.CSSProperties = { fontSize: '14px', color: 'rgba(230,226,216,0.65)', lineHeight: 1.8, margin: 0 }
const Label: React.CSSProperties = { fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }
const Section: React.CSSProperties = { padding: '24px 0', borderBottom: '1px solid rgba(230,226,216,0.1)', display: 'flex', flexDirection: 'column' as const, gap: '12px' }

export default function Privacy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#070807' }}>
      <Nav />

      <main style={{ flex: 1, maxWidth: '560px', width: '100%', margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column' }}>

        <span style={{ fontSize: '10px', color: 'rgba(230,226,216,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase', paddingBottom: '16px', borderBottom: '1px solid rgba(230,226,216,0.1)' }}>
          Privacy
        </span>

        <div style={Section}>
          <span style={Label}>Overview</span>
          <p style={P}>
            Site stores only what is necessary to run the product. Documents remain on your device. Session state is local. We do not sell user data or share personal information with third parties except as described below.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Account</span>
          <p style={P}>
            If you have an account, we store your email address to associate your subscription with your access. It is used only for authentication and subscription management.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Documents</span>
          <p style={P}>
            PDFs and images you add are stored locally on your device via IndexedDB. They are not uploaded to our servers. They count toward your storage limit and remain on your device until you remove them.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Session data</span>
          <p style={P}>
            Saved pages store metadata only — title, URL, hostname, and timestamp — locally. Full page content is not stored. Session state (tabs, document selections, view positions) is stored locally and is not transmitted.
          </p>
          <p style={P}>
            The web panel uses standard browser session and cookie storage so sites can keep you logged in. Site does not read, store, or transmit those credentials.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Payments</span>
          <p style={P}>
            Subscription payments are processed by Polar. Site does not handle or store payment card data. When subscription status is verified, Site contacts Polar to confirm access. No other data is shared in that process.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Diagnostics</span>
          <p style={P}>
            Site does not include third-party analytics. Crash or diagnostic data, if collected, is used only to identify and fix problems in the application. It is not linked to your documents or browsing activity.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Data deletion</span>
          <p style={P}>
            Documents and saved pages can be removed individually from within the app. To clear all local data at once, use <span style={{ color: 'rgba(230,226,216,0.65)' }}>Site → Reset Site Data…</span> in the desktop menu. This cannot be undone.
          </p>
          <p style={P}>
            To close your account or request deletion of account-level data, contact us at the address below.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Changes</span>
          <p style={P}>
            This policy may be updated as the product changes. Material changes will be noted in release notes. Continued use of Site after a change constitutes acceptance.
          </p>
        </div>

        <div style={Section}>
          <span style={Label}>Contact</span>
          <p style={P}>
            <a href="mailto:Official_Site_Support@protonmail.com?subject=Site%20privacy" style={{ color: 'rgba(230,226,216,0.65)', textDecoration: 'underline', textDecorationColor: 'rgba(230,226,216,0.45)', textUnderlineOffset: '3px' }}>
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
